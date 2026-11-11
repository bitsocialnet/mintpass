import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ethers, network } from "hardhat";
import { mine, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { deployAndRecord, refuseExistingRecord } from "../scripts/deploy-record";

// The record file is the deploy script's only "already deployed" flag on mainnet and sepolia. If a run
// can end with the contract sent but no record (RPC error, crash or Ctrl-C while waiting for the
// receipt), a re-run deploys a second contract.
describe("deploy record", function () {
  let snapshot: string;
  let dir: string;

  beforeEach(async function () {
    snapshot = await network.provider.send("evm_snapshot");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mintpass-deploy-record-"));
  });

  afterEach(async function () {
    await network.provider.send("evm_setAutomine", [true]);
    await network.provider.send("evm_revert", [snapshot]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function setup(deployerIndex = 0) {
    const signers = await ethers.getSigners();
    const deployer = signers[deployerIndex];
    const feed = await ethers.deployContract("MockAggregator", [8, 2500n * 10n ** 8n]);
    const factory = await ethers.getContractFactory("MintPass");
    const passArgs = (name: string, symbol: string, payout = signers[1].address) => [
      name,
      symbol,
      payout,
      feed.target,
      7200,
      [{ duration: 365 * 86400, priceUsdCents: 3000 }],
    ];
    const args = passArgs("5chan Pass", "5PASS");
    const file = path.join(dir, "5chan-pass-mainnet.json");
    const nonce = await deployer.getNonce("pending");
    const expected = ethers.getCreateAddress({ from: deployer.address, nonce });
    const run = () =>
      deployAndRecord({
        file,
        factory,
        args,
        deployer,
        confirmations: 1,
        fields: { contract: "MintPass", deployment: "5chan-pass", network: "mainnet", chainId: 1 },
        log: () => {},
      });
    return { deployer, passArgs, file, nonce, expected, run };
  }

  const readRecord = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

  function refusal(file: string): string {
    try {
      refuseExistingRecord(file);
    } catch (error) {
      return (error as Error).message;
    }
    expect.fail("refuseExistingRecord did not refuse the record");
  }

  it("saves the record with the contract's address before the deploy transaction is mined", async function () {
    const { deployer, file, nonce, expected, run } = await setup();
    await network.provider.send("evm_setAutomine", [false]);

    let settled = false;
    const deploying = run().finally(() => (settled = true));
    // Wait until the deploy transaction is in the mempool. From here on an RPC error, a crash or
    // Ctrl-C ends the run with the contract possibly landing on chain.
    while (!settled && (await deployer.getNonce("pending")) === nonce) await new Promise((r) => setTimeout(r, 10));
    expect(settled, "deployAndRecord settled before the transaction was mined").to.equal(false);

    expect(fs.existsSync(file), "no record while the deploy transaction is pending").to.equal(true);
    expect(readRecord(file)).to.include({ status: "broadcasting", address: expected, nonce, deployer: deployer.address });
    expect(() => refuseExistingRecord(file)).to.throw(expected);

    await mine(1);
    const { address, txHash, receipt } = await deploying;
    expect(address).to.equal(expected);
    expect(await ethers.provider.getCode(expected)).to.not.equal("0x");
    expect(readRecord(file)).to.include({ status: "deployed", address: expected, nonce, txHash, blockNumber: receipt.blockNumber });
    expect(() => refuseExistingRecord(file)).to.throw(`already deployed on mainnet at ${expected}`);
  });

  it("keeps the broadcasting record intact when completing it fails part-way, for example on a full disk", async function () {
    const { file, nonce, expected, run } = await setup();
    // Patch fs as the script sees it; the namespace imported above is a read-only copy.
    const nodeFs = require("fs");
    const writeFileSync = nodeFs.writeFileSync;
    nodeFs.writeFileSync = (target: unknown, data: unknown, ...rest: unknown[]) => {
      if (String(data).includes('"status": "deployed"')) {
        writeFileSync(target, String(data).slice(0, 40));
        throw Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" });
      }
      return writeFileSync(target, data, ...rest);
    };
    try {
      await expect(run()).to.be.rejectedWith("ENOSPC");
    } finally {
      nodeFs.writeFileSync = writeFileSync;
    }

    // The contract landed but the update failed: the record must still name its address and nonce.
    expect(await ethers.provider.getCode(expected)).to.not.equal("0x");
    expect(readRecord(file)).to.include({ status: "broadcasting", address: expected, nonce });
  });

  it("keeps the record when sending the deploy fails, since a failed send may still have been broadcast", async function () {
    const { deployer, file, nonce, expected, run } = await setup(5);
    await setBalance(deployer.address, 0n);

    await expect(run()).to.be.rejected;
    expect(readRecord(file)).to.include({ status: "broadcasting", address: expected, nonce });
    // The send was rejected, so the nonce is still unused and the deploy could still go out. The
    // operator has to know how to settle that before the record may be deleted.
    expect(await deployer.getNonce("latest")).to.equal(nonce);
    const message = refusal(file);
    expect(message).to.include(expected);
    expect(message).to.include(`Nonce ${nonce} not used yet`);
    expect(message).to.include("0 ETH transfer");
  });

  it("names the pass to look for, since another deploy from the same key can take the recorded nonce", async function () {
    const { deployer, passArgs, file, nonce, expected, run } = await setup(5);
    const balance = await ethers.provider.getBalance(deployer.address);
    await setBalance(deployer.address, 0n);
    await expect(run()).to.be.rejected;

    // The operator funds the key and deploys the other pass, which takes the 5chan Pass record's
    // nonce and lands at its recorded address. Code there is not the 5chan Pass.
    await setBalance(deployer.address, balance);
    const other = await ethers.deployContract("MintPass", passArgs("Seedit Gold", "SGOLD"), deployer);
    await other.waitForDeployment();
    expect(other.target).to.equal(expected);
    expect(await other.name()).to.equal("Seedit Gold");
    expect(readRecord(file)).to.include({ status: "broadcasting", address: expected, nonce });

    const message = refusal(file);
    expect(message).to.include('name() "5chan Pass"');
    expect(message).to.include('symbol() "5PASS"');
    expect(message).to.include("has no code, holds another contract");
    expect(message).to.not.include("has code, that is the deployment");
  });

  it("lists every recorded constructor value, since the same pass with other values can take the recorded nonce", async function () {
    const { deployer, passArgs, file, nonce, expected, run } = await setup(5);
    const balance = await ethers.provider.getBalance(deployer.address);
    await setBalance(deployer.address, 0n);
    await expect(run()).to.be.rejected;

    // A 5chan Pass with another payout (a second run with other settings, or a replacement sent by
    // hand) takes the record's nonce. name() and symbol() match the record; payout() does not.
    await setBalance(deployer.address, balance);
    const otherPayout = (await ethers.getSigners())[2].address;
    const other = await ethers.deployContract("MintPass", passArgs("5chan Pass", "5PASS", otherPayout), deployer);
    await other.waitForDeployment();
    expect(other.target).to.equal(expected);
    const [name, symbol, payout, priceFeed, maxStaleness, plans] = readRecord(file).constructorArgs;
    expect([await other.name(), await other.symbol()]).to.deep.equal([name, symbol]);
    expect(await other.payout()).to.not.equal(payout);
    expect(readRecord(file)).to.include({ status: "broadcasting", address: expected, nonce });

    const message = refusal(file);
    expect(message).to.include(`initial payout ${payout}`);
    expect(message).to.include(`priceFeed() ${priceFeed}`);
    expect(message).to.include(`maxStaleness() ${maxStaleness}`);
    expect(message).to.include(`plans() ${JSON.stringify(plans)}`);
    expect(message).to.include("holds this pass deployed with any other value, such as another initial payout");
  });

  it("compares the payout the pass was deployed with, since the payout can be rotated after deploying", async function () {
    const { file, nonce, expected, run } = await setup();
    // The deploy lands, but the run stops before completing the record: it is left as it was before sending.
    await run();
    const { txHash, blockNumber, ...sent } = readRecord(file);
    fs.writeFileSync(file, JSON.stringify({ ...sent, status: "broadcasting" }));
    expect(readRecord(file)).to.include({ status: "broadcasting", address: expected, nonce });

    // Before the operator re-runs, the payout hands its role to another address.
    const signers = await ethers.getSigners();
    const pass = await ethers.getContractAt("MintPass", expected);
    await pass.connect(signers[1]).proposePayout(signers[3].address);
    await pass.connect(signers[3]).acceptPayout();

    // This is the deployment: every recorded value matches, except that payout() has moved on.
    const [name, symbol, payout, priceFeed, maxStaleness, plans] = sent.constructorArgs;
    expect([await pass.name(), await pass.symbol(), await pass.priceFeed(), await pass.maxStaleness()]).to.deep.equal([
      name,
      symbol,
      priceFeed,
      BigInt(maxStaleness),
    ]);
    const onChainPlans = (await pass.plans()).map((p) => ({ duration: Number(p.duration), priceUsdCents: Number(p.priceUsdCents) }));
    expect(onChainPlans).to.deep.equal(plans);
    expect(await pass.payout()).to.equal(signers[3].address).and.not.equal(payout);
    const [first] = await pass.queryFilter(pass.filters.PayoutChanged());
    expect(first.args.previousPayout).to.equal(payout);

    // The message must not ask for the current payout(), which would send the operator to "delete and deploy again".
    const message = refusal(file);
    expect(message).to.not.include(`payout() ${payout}`);
    expect(message).to.include(`initial payout ${payout}`);
    expect(message).to.include("the previousPayout of the first PayoutChanged event");
  });
});

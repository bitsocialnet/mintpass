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
    const passArgs = (name: string, symbol: string) => [
      name,
      symbol,
      signers[1].address,
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
    expect(message).to.include("has no code or holds another contract");
    expect(message).to.not.include("has code, that is the deployment");
  });
});

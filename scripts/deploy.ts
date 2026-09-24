/**
 * Deploy one MintPass instance.
 *
 *   DEPLOYMENT=5chan-pass|seedit-gold  which instance (see deploy/config.ts)
 *   PAYOUT_ADDRESS=0x...               receives all proceeds (required)
 *   DRY_RUN=0                          actually send the transaction. ANY other value, or unset,
 *                                      is a dry run: read the feed, simulate the constructor,
 *                                      estimate gas and cost, print everything, send nothing.
 *   DEPLOYER_PRIVATE_KEY=0x...         only needed when DRY_RUN=0 on mainnet/sepolia
 *
 *   yarn hardhat run scripts/deploy.ts --network mainnet|sepolia
 *
 * `--network hardhat` with FORK_URL set runs against a local fork (FORK_NETWORK selects which
 * network's parameters to use, default mainnet); there DRY_RUN=0 deploys to the fork and runs a
 * smoke purchase. Nothing is ever sent to a live chain from the `hardhat` network.
 */
import * as fs from "fs";
import * as path from "path";
import { ethers, network } from "hardhat";
import { DEPLOYMENTS, NETWORKS, type DeploymentKey, type TargetNetwork } from "../deploy/config";

const feedAbi = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80)",
];

function fail(message: string): never {
  throw new Error(message);
}

function weiFor(cents: bigint, answer: bigint, decimals: bigint): bigint {
  const num = cents * 10n ** (18n + decimals);
  const den = answer * 100n;
  return (num + den - 1n) / den;
}

async function main() {
  const deploymentKey = (process.env.DEPLOYMENT ?? "") as DeploymentKey;
  const deployment = DEPLOYMENTS[deploymentKey] ?? fail(`DEPLOYMENT must be one of: ${Object.keys(DEPLOYMENTS).join(", ")}`);

  const isLocal = network.name === "hardhat";
  const targetName = (isLocal ? process.env.FORK_NETWORK ?? "mainnet" : network.name) as TargetNetwork;
  const target = NETWORKS[targetName] ?? fail(`Unsupported network "${network.name}". Use mainnet or sepolia.`);
  const dryRun = process.env.DRY_RUN !== "0";

  const payoutRaw = process.env.PAYOUT_ADDRESS ?? fail("PAYOUT_ADDRESS is required");
  if (!ethers.isAddress(payoutRaw)) fail(`PAYOUT_ADDRESS is not an address: ${payoutRaw}`);
  const payout = ethers.getAddress(payoutRaw);
  if (payout === ethers.ZeroAddress) fail("PAYOUT_ADDRESS must not be the zero address");

  const provider = ethers.provider;
  const chainId = Number((await provider.getNetwork()).chainId);
  if (!isLocal && chainId !== target.chainId) fail(`RPC chainId ${chainId} != expected ${target.chainId}`);

  // --- Feed checks (read-only) ---------------------------------------------------------------
  if ((await provider.getCode(target.priceFeed)) === "0x") {
    fail(`No code at the ${targetName} price feed ${target.priceFeed}${isLocal ? " (is FORK_URL set?)" : ""}`);
  }
  const feed = new ethers.Contract(target.priceFeed, feedAbi, provider);
  const [description, decimals, round, latestBlock] = await Promise.all([
    feed.description() as Promise<string>,
    feed.decimals() as Promise<bigint>,
    feed.latestRoundData(),
    provider.getBlock("latest"),
  ]);
  const answer: bigint = round.answer;
  const age = BigInt(latestBlock!.timestamp) - BigInt(round.updatedAt);
  if (description !== "ETH / USD") fail(`Feed description is "${description}", expected "ETH / USD"`);
  if (answer <= 0n) fail(`Feed answer is not positive: ${answer}`);

  const payoutCode = await provider.getCode(payout);

  const constructorArgs = [
    deployment.name,
    deployment.symbol,
    payout,
    target.priceFeed,
    target.maxStalenessSeconds,
    deployment.plans,
  ] as const;

  // --- Build and simulate the deploy transaction -----------------------------------------------
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const from = deployer?.address ?? payout; // any address works for simulation
  const factory = await ethers.getContractFactory("MintPass");
  const deployTx = await factory.getDeployTransaction(...constructorArgs);
  const gas = await provider.estimateGas({ ...deployTx, from }); // reverts if the constructor would revert
  const fee = await provider.getFeeData();
  const maxFeePerGas = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;

  console.log("MintPass deployment");
  console.log("========================");
  console.log(`mode            ${dryRun ? "DRY RUN (nothing will be sent)" : "LIVE"}`);
  console.log(`network         ${network.name}${isLocal ? ` (local, ${targetName} parameters)` : ""} chainId ${chainId}`);
  console.log(`deployment      ${deploymentKey}: "${deployment.name}" (${deployment.symbol})`);
  console.log(`payout          ${payout}${payoutCode === "0x" ? "" : "  (a contract: it must accept plain ETH transfers)"}`);
  console.log(`price feed      ${target.priceFeed} "${description}", ${decimals} decimals`);
  console.log(`feed answer     $${ethers.formatUnits(answer, decimals)} (age ${age}s, max ${target.maxStalenessSeconds}s)`);
  if (age > BigInt(target.maxStalenessSeconds)) console.log("WARNING         feed answer is currently stale: purchases would revert right now");
  deployment.plans.forEach((p, i) => {
    const wei = weiFor(BigInt(p.priceUsdCents), answer, decimals);
    console.log(
      `plan ${i}          ${p.duration / 86400} days for $${(p.priceUsdCents / 100).toFixed(2)} = ${ethers.formatEther(wei)} ETH now`,
    );
  });
  console.log(`deployer        ${deployer?.address ?? "(none: DEPLOYER_PRIVATE_KEY not set)"}`);
  console.log(`deploy gas      ${gas} (~${ethers.formatEther(gas * maxFeePerGas)} ETH at ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei max fee)`);
  console.log(`init code hash  ${ethers.keccak256(deployTx.data)}`);

  if (dryRun) {
    console.log("\nDRY RUN: no transaction sent. Re-run with DRY_RUN=0 to deploy.");
    return;
  }

  if (!deployer) fail("DEPLOYER_PRIVATE_KEY is required when DRY_RUN=0");

  // A saved record means this deployment already exists; refuse to create a second contract.
  const outDir = path.join(__dirname, "..", "deployments");
  const base = path.join(outDir, `${deploymentKey}-${network.name}`);
  if (!isLocal && fs.existsSync(`${base}.json`)) {
    fail(`${path.relative(process.cwd(), `${base}.json`)} exists: ${deploymentKey} is already deployed on ${network.name}`);
  }
  const balance = await provider.getBalance(deployer.address);
  if (balance < gas * maxFeePerGas) {
    console.log(`WARNING: deployer balance ${ethers.formatEther(balance)} ETH may not cover the deploy`);
  }

  const contract = await factory.connect(deployer).deploy(...constructorArgs);
  const tx = contract.deploymentTransaction()!;
  console.log(`\ntx              ${tx.hash}`);
  const receipt = await tx.wait(isLocal ? 1 : 2);
  const address = await contract.getAddress();
  console.log(`address         ${address}`);
  console.log(`gas used        ${receipt!.gasUsed}`);

  // Record the deployment before anything else can fail, so a later error never hides it.
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    `${base}.json`,
    JSON.stringify(
      {
        contract: "MintPass",
        deployment: deploymentKey,
        network: network.name,
        chainId,
        address,
        txHash: tx.hash,
        blockNumber: receipt!.blockNumber,
        deployer: deployer.address,
        constructorArgs,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  fs.writeFileSync(`${base}.args.js`, `module.exports = ${JSON.stringify(constructorArgs, null, 2)};\n`);
  console.log(`saved           ${base}.json`);

  // --- Post-deploy checks ----------------------------------------------------------------------
  const pass = await ethers.getContractAt("MintPass", address);
  const checks: [string, boolean][] = [
    ["name", (await pass.name()) === deployment.name],
    ["symbol", (await pass.symbol()) === deployment.symbol],
    ["payout", (await pass.payout()) === payout],
    ["priceFeed", (await pass.priceFeed()) === ethers.getAddress(target.priceFeed)],
    ["maxStaleness", (await pass.maxStaleness()) === BigInt(target.maxStalenessSeconds)],
    [
      "plans",
      JSON.stringify((await pass.plans()).map((p) => [Number(p.duration), Number(p.priceUsdCents)])) ===
        JSON.stringify(deployment.plans.map((p) => [p.duration, p.priceUsdCents])),
    ],
    ["ERC-5192", await pass.supportsInterface("0xb45a3c0e")],
    ["ERC-721", await pass.supportsInterface("0x80ac58cd")],
  ];
  for (const [name, ok] of checks) console.log(`check ${name.padEnd(12)} ${ok ? "ok" : "FAILED"}`);
  if (checks.some(([, ok]) => !ok)) fail("post-deploy checks failed");

  if (isLocal) {
    // Smoke purchase on the local fork: a gift from signer 1 to a fresh address.
    const [, buyer] = await ethers.getSigners();
    const holder = ethers.Wallet.createRandom().address;
    const quote = await pass.quote(0);
    const r = await (await pass.connect(buyer).purchase(holder, 0, { value: quote + quote / 50n })).wait();
    console.log(`smoke purchase  quote ${ethers.formatEther(quote)} ETH, gas ${r!.gasUsed}, balanceOf(holder) = ${await pass.balanceOf(holder)}`);
  }

  if (!isLocal) {
    console.log(`\nverify: yarn hardhat verify --network ${network.name} --constructor-args ${path.relative(process.cwd(), `${base}.args.js`)} ${address}`);
    console.log(`explorer: ${target.explorer}/address/${address}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

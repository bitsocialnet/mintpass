/**
 * Deterministic gas numbers on the in-process Hardhat network with a mock feed.
 *   yarn gas
 * The real Chainlink proxy costs a few thousand gas more per purchase than the mock
 * (see the fork test output for real-feed numbers).
 */
import { ethers } from "hardhat";
import { DEPLOYMENTS } from "../deploy/config";

async function main() {
  const [deployer, payout, alice, bob, carol] = await ethers.getSigners();
  const feed = await ethers.deployContract("MockAggregator", [8, 2500n * 10n ** 8n]);
  const { name, symbol, plans } = DEPLOYMENTS["5chan-pass"];

  const factory = await ethers.getContractFactory("MintPass", deployer);
  const pass = await factory.deploy(name, symbol, payout.address, await feed.getAddress(), 7200, plans);
  const deployReceipt = await pass.deploymentTransaction()!.wait();
  const q0 = await pass.quote(0);

  const rows: [string, bigint][] = [["deploy (2 plans)", deployReceipt!.gasUsed]];
  const measure = async (label: string, p: Promise<{ wait: () => Promise<any> }>) => {
    rows.push([label, (await (await p).wait()).gasUsed]);
  };

  await measure("purchase: first mint, very first token, exact pay", pass.connect(alice).purchase(alice.address, 0, { value: q0 }));
  await measure("purchase: first mint, exact pay", pass.connect(bob).purchase(bob.address, 0, { value: q0 }));
  await measure("purchase: first mint (gift), with refund", pass.connect(alice).purchase(carol.address, 0, { value: q0 + q0 / 100n }));
  await measure("purchase: renewal, exact pay", pass.connect(alice).purchase(alice.address, 0, { value: q0 }));
  await measure("purchase: renewal, with refund", pass.connect(bob).purchase(alice.address, 1, { value: (await pass.quote(1)) * 2n }));
  await measure("proposePayout", pass.connect(payout).proposePayout(carol.address));
  await measure("acceptPayout", pass.connect(carol).acceptPayout());

  const width = Math.max(...rows.map(([l]) => l.length));
  for (const [label, gas] of rows) console.log(`${label.padEnd(width)}  ${gas.toString().padStart(9)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

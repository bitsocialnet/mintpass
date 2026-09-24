import { expect } from "chai";
import { ethers } from "hardhat";
import { reset, setNextBlockBaseFeePerGas } from "@nomicfoundation/hardhat-network-helpers";
import type { MintPass } from "../typechain-types";
import { NETWORKS, DEPLOYMENTS } from "../deploy/config";

// Runs only when FORK_TEST_RPC_URL is set (`yarn test:fork` sets it, defaulting to publicnode).
const RPC = process.env.FORK_TEST_RPC_URL;
const FEED = NETWORKS.mainnet.priceFeed;
const MAX_STALENESS = BigInt(NETWORKS.mainnet.maxStalenessSeconds);
const PLANS = DEPLOYMENTS["5chan-pass"].plans;

const feedAbi = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

(RPC ? describe : describe.skip)("mainnet fork: MintPass against the real Chainlink ETH/USD feed", function () {
  this.timeout(300_000);
  let pass: MintPass;

  before(async function () {
    await reset(RPC); // fork the latest block
    // Hardhat computes the first post-fork base fee above ethers' fee estimate; start from 0.
    await setNextBlockBaseFeePerGas(0);
    const [, payout] = await ethers.getSigners();
    pass = (await ethers.deployContract("MintPass", [
      "5chan Pass",
      "5PASS",
      payout.address,
      FEED,
      MAX_STALENESS,
      PLANS,
    ])) as unknown as MintPass;
  });

  after(async function () {
    await reset(); // back to a clean, non-forked network
  });

  it("the feed is the ETH / USD proxy with 8 decimals and a fresh, sane answer", async function () {
    const feed = new ethers.Contract(FEED, feedAbi, ethers.provider);
    expect(await feed.description()).to.equal("ETH / USD");
    expect(await feed.decimals()).to.equal(8n);
    const { answer, updatedAt } = await feed.latestRoundData();
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    console.log(`      ETH/USD = $${ethers.formatUnits(answer, 8)}, answer age ${now - updatedAt}s`);
    expect(answer).to.be.gt(100n * 10n ** 8n);
    expect(answer).to.be.lt(100_000n * 10n ** 8n);
    expect(now - updatedAt).to.be.lte(MAX_STALENESS);
  });

  it("quote() is ~$30 / ~$60 of ETH, rounded up to the wei", async function () {
    const feed = new ethers.Contract(FEED, feedAbi, ethers.provider);
    const { answer } = await feed.latestRoundData();
    for (const [planId, cents] of [
      [0, 3000n],
      [1, 6000n],
    ] as const) {
      const quote = await pass.quote(planId);
      // USD value in 1e-26 USD units: wei (1e-18 ETH) * answer (1e-8 USD/ETH).
      const valueE26 = quote * answer;
      const targetE26 = cents * 10n ** 24n;
      console.log(`      plan ${planId}: quote ${ethers.formatEther(quote)} ETH = $${ethers.formatUnits(valueE26, 26)}`);
      expect(valueE26).to.be.gte(targetE26); // never undercharges
      expect((quote - 1n) * answer).to.be.lt(targetE26); // and by less than 1 wei
    }
  });

  it("purchases and renews against the real feed", async function () {
    const [, payout, buyer, holder] = await ethers.getSigners();
    const quote = await pass.quote(0);
    const payoutBefore = await ethers.provider.getBalance(payout.address);

    const first = await (await pass.connect(buyer).purchase(holder.address, 0, { value: quote + quote / 100n })).wait();
    expect(await pass.ownerOf(1)).to.equal(holder.address);
    expect(await pass.balanceOf(holder.address)).to.equal(1n);

    const renewal = await (await pass.connect(buyer).purchase(holder.address, 1, { value: (await pass.quote(1)) * 2n })).wait();
    expect(await pass.tokenOf(holder.address)).to.equal(1n);
    expect(await ethers.provider.getBalance(payout.address)).to.be.gt(payoutBefore);
    expect(await ethers.provider.getBalance(await pass.getAddress())).to.equal(0n);
    console.log(`      gas: first mint ${first!.gasUsed}, renewal ${renewal!.gasUsed} (real feed, with refund)`);
  });
});

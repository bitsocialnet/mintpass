import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { MockAggregator, MintPass } from "../typechain-types";

const DAY = 24n * 60n * 60n;
const YEAR = 365n * DAY;
const MAX_STALENESS = 7200n;
const ETH_USD = 2500n * 10n ** 8n; // $2,500.00000000 with 8 decimals
const PLANS = [
  { duration: YEAR, priceUsdCents: 3000n }, // 365 days, $30
  { duration: 3n * YEAR, priceUsdCents: 6000n }, // 3 * 365 days, $60
];

/** Reference implementation: ceil(cents * 10^(18+decimals) / (answer * 100)). */
function expectedWei(cents: bigint, answer: bigint, decimals: bigint): bigint {
  const num = cents * 10n ** (18n + decimals);
  const den = answer * 100n;
  return (num + den - 1n) / den;
}

/** Decimal string -> fixed-point integer with `decimals` digits, truncating extra fraction digits. */
function toUnits(value: string, decimals: number): bigint {
  const [whole, frac = ""] = value.split(".");
  return BigInt(whole + frac.slice(0, decimals).padEnd(decimals, "0"));
}

async function deployPass(opts: {
  name?: string;
  symbol?: string;
  payout: string;
  feed: string;
  maxStaleness?: bigint;
  plans?: { duration: bigint; priceUsdCents: bigint }[];
}): Promise<MintPass> {
  return ethers.deployContract("MintPass", [
    opts.name ?? "5chan Pass",
    opts.symbol ?? "5PASS",
    opts.payout,
    opts.feed,
    opts.maxStaleness ?? MAX_STALENESS,
    opts.plans ?? PLANS,
  ]) as unknown as Promise<MintPass>;
}

async function fixture() {
  const [deployer, payout, alice, bob, carol, mallory] = await ethers.getSigners();
  const feed = (await ethers.deployContract("MockAggregator", [8, ETH_USD])) as unknown as MockAggregator;
  const pass = await deployPass({ payout: payout.address, feed: await feed.getAddress() });
  const passAddress = await pass.getAddress();
  const plan0Wei = expectedWei(3000n, ETH_USD, 8n); // 0.012 ETH
  const plan1Wei = expectedWei(6000n, ETH_USD, 8n); // 0.024 ETH
  return { deployer, payout, alice, bob, carol, mallory, feed, pass, passAddress, plan0Wei, plan1Wei };
}

async function blockTimestampOf(tx: { wait: () => Promise<any> }): Promise<bigint> {
  const receipt = await tx.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  return BigInt(block!.timestamp);
}

/** Move time forward and publish a fresh feed answer so purchases are not rejected as stale. */
async function advance(feed: MockAggregator, seconds: bigint, answer: bigint = ETH_USD) {
  await time.increase(seconds);
  await feed.setAnswer(answer);
}

describe("MintPass", function () {
  describe("deployment", function () {
    it("stores the constructor configuration", async function () {
      const { pass, payout, feed } = await loadFixture(fixture);
      expect(await pass.name()).to.equal("5chan Pass");
      expect(await pass.symbol()).to.equal("5PASS");
      expect(await pass.payout()).to.equal(payout.address);
      expect(await pass.priceFeed()).to.equal(await feed.getAddress());
      expect(await pass.maxStaleness()).to.equal(MAX_STALENESS);
      expect(await pass.planCount()).to.equal(2n);
      const plans = await pass.plans();
      expect(plans.map((p) => [p.duration, p.priceUsdCents])).to.deep.equal([
        [YEAR, 3000n],
        [3n * YEAR, 6000n],
      ]);
    });

    it("rejects a zero payout", async function () {
      const { pass, feed } = await loadFixture(fixture);
      await expect(deployPass({ payout: ethers.ZeroAddress, feed: await feed.getAddress() }))
        .to.be.revertedWithCustomError(pass, "InvalidPayout")
        .withArgs(ethers.ZeroAddress);
    });

    it("rejects the contract itself as payout", async function () {
      const { pass, feed, deployer } = await loadFixture(fixture);
      const nonce = await ethers.provider.getTransactionCount(deployer.address);
      const predicted = ethers.getCreateAddress({ from: deployer.address, nonce });
      await expect(deployPass({ payout: predicted, feed: await feed.getAddress() }))
        .to.be.revertedWithCustomError(pass, "InvalidPayout")
        .withArgs(predicted);
    });

    it("rejects a zero or code-less feed", async function () {
      const { pass, payout, alice } = await loadFixture(fixture);
      await expect(deployPass({ payout: payout.address, feed: ethers.ZeroAddress }))
        .to.be.revertedWithCustomError(pass, "InvalidFeed")
        .withArgs(ethers.ZeroAddress);
      await expect(deployPass({ payout: payout.address, feed: alice.address }))
        .to.be.revertedWithCustomError(pass, "InvalidFeed")
        .withArgs(alice.address);
    });

    it("rejects a contract that is not a feed", async function () {
      const { payout, passAddress } = await loadFixture(fixture);
      // MintPass has no decimals(): the constructor's sanity call reverts.
      await expect(deployPass({ payout: payout.address, feed: passAddress })).to.be.reverted;
    });

    it("rejects a feed with more than 18 decimals", async function () {
      const { pass, payout } = await loadFixture(fixture);
      const feed19 = await ethers.deployContract("MockAggregator", [19, ETH_USD]);
      await expect(deployPass({ payout: payout.address, feed: await feed19.getAddress() }))
        .to.be.revertedWithCustomError(pass, "UnsupportedFeedDecimals")
        .withArgs(19);
    });

    it("rejects a zero max staleness", async function () {
      const { pass, payout, feed } = await loadFixture(fixture);
      await expect(
        deployPass({ payout: payout.address, feed: await feed.getAddress(), maxStaleness: 0n }),
      ).to.be.revertedWithCustomError(pass, "InvalidMaxStaleness");
    });

    it("rejects an empty plan list", async function () {
      const { pass, payout, feed } = await loadFixture(fixture);
      await expect(
        deployPass({ payout: payout.address, feed: await feed.getAddress(), plans: [] }),
      ).to.be.revertedWithCustomError(pass, "NoPlans");
    });

    it("rejects plans with a zero duration or a zero price", async function () {
      const { pass, payout, feed } = await loadFixture(fixture);
      const f = await feed.getAddress();
      await expect(
        deployPass({ payout: payout.address, feed: f, plans: [PLANS[0], { duration: 0n, priceUsdCents: 1n }] }),
      )
        .to.be.revertedWithCustomError(pass, "InvalidPlanConfig")
        .withArgs(1);
      await expect(
        deployPass({ payout: payout.address, feed: f, plans: [{ duration: DAY, priceUsdCents: 0n }] }),
      )
        .to.be.revertedWithCustomError(pass, "InvalidPlanConfig")
        .withArgs(0);
    });
  });

  describe("ERC-165 and ERC-5192", function () {
    it("reports the expected interfaces", async function () {
      const { pass } = await loadFixture(fixture);
      expect(await pass.supportsInterface("0xb45a3c0e")).to.equal(true); // ERC-5192
      expect(await pass.supportsInterface("0x80ac58cd")).to.equal(true); // ERC-721
      expect(await pass.supportsInterface("0x5b5e139f")).to.equal(true); // ERC-721 Metadata
      expect(await pass.supportsInterface("0x01ffc9a7")).to.equal(true); // ERC-165
      expect(await pass.supportsInterface("0x780e9d63")).to.equal(false); // ERC-721 Enumerable
      expect(await pass.supportsInterface("0xffffffff")).to.equal(false); // ERC-165 invalid id
      expect(await pass.supportsInterface("0x00000000")).to.equal(false);
    });

    it("uses the ERC-5192 id the voting gate checks (selector of locked(uint256))", async function () {
      expect(ethers.id("locked(uint256)").slice(0, 10)).to.equal("0xb45a3c0e");
    });

    it("locked() is true for minted tokens and reverts for nonexistent ones", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await expect(pass.locked(1)).to.be.revertedWithCustomError(pass, "ERC721NonexistentToken").withArgs(1);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      expect(await pass.locked(1)).to.equal(true);
      await expect(pass.locked(0)).to.be.revertedWithCustomError(pass, "ERC721NonexistentToken").withArgs(0);
      await expect(pass.locked(2)).to.be.revertedWithCustomError(pass, "ERC721NonexistentToken").withArgs(2);
    });

    it("emits Locked on mint but not on renewal", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei }))
        .to.emit(pass, "Locked")
        .withArgs(1);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei })).not.to.emit(
        pass,
        "Locked",
      );
    });
  });

  describe("pricing", function () {
    it("quotes $30 and $60 at $2,500/ETH exactly", async function () {
      const { pass } = await loadFixture(fixture);
      expect(await pass.quote(0)).to.equal(ethers.parseEther("0.012"));
      expect(await pass.quote(1)).to.equal(ethers.parseEther("0.024"));
    });

    it("rounds up when the division is inexact, and quote - 1 wei is rejected", async function () {
      const { pass, feed, alice } = await loadFixture(fixture);
      const answer = 266_320_000_001n; // $2,663.20000001
      await feed.setAnswer(answer);
      const floor = (3000n * 10n ** 26n) / (answer * 100n);
      const quote = await pass.quote(0);
      expect((3000n * 10n ** 26n) % (answer * 100n)).to.not.equal(0n);
      expect(quote).to.equal(floor + 1n);
      expect(quote).to.equal(expectedWei(3000n, answer, 8n));
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: quote - 1n }))
        .to.be.revertedWithCustomError(pass, "InsufficientPayment")
        .withArgs(quote, quote - 1n);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: quote })).to.emit(pass, "Purchased");
    });

    it("matches the reference formula across prices, plans and feed decimals", async function () {
      const { pass, feed } = await loadFixture(fixture);
      const usdPrices = ["0.01", "1", "999.99", "1234.56789", "2663.2", "3333.33333333", "100000", "12345678.9"];
      for (const decimals of [0n, 6n, 8n, 18n]) {
        await feed.setDecimals(Number(decimals));
        for (const usd of usdPrices) {
          const answer = toUnits(usd, Number(decimals));
          if (answer === 0n) continue; // "0.01" truncates to 0 with 0 decimals
          await feed.setAnswer(answer);
          expect(await pass.quote(0)).to.equal(expectedWei(3000n, answer, decimals), `$${usd} dec ${decimals}`);
          expect(await pass.quote(1)).to.equal(expectedWei(6000n, answer, decimals), `$${usd} dec ${decimals}`);
        }
      }
    });

    it("gives the same USD value regardless of feed decimals", async function () {
      const { pass, feed } = await loadFixture(fixture);
      await feed.setDecimals(18);
      await feed.setAnswer(2500n * 10n ** 18n);
      expect(await pass.quote(0)).to.equal(ethers.parseEther("0.012"));
      await feed.setDecimals(0);
      await feed.setAnswer(2500n);
      expect(await pass.quote(0)).to.equal(ethers.parseEther("0.012"));
    });

    it("handles extreme answers without overflow and never quotes 0", async function () {
      const { pass, feed } = await loadFixture(fixture);
      await feed.setAnswer(1n); // $0.00000001 per ETH
      expect(await pass.quote(0)).to.equal(3n * 10n ** 27n); // 3000 * 1e26 / 100
      await feed.setAnswer(10n ** 40n); // absurdly expensive ETH
      expect(await pass.quote(0)).to.equal(1n);
    });

    it("follows feed updates", async function () {
      const { pass, feed } = await loadFixture(fixture);
      await feed.setAnswer(5000n * 10n ** 8n);
      expect(await pass.quote(0)).to.equal(ethers.parseEther("0.006"));
      await feed.setAnswer(1250n * 10n ** 8n);
      expect(await pass.quote(0)).to.equal(ethers.parseEther("0.024"));
    });

    it("rejects an unknown plan", async function () {
      const { pass, alice } = await loadFixture(fixture);
      await expect(pass.quote(2)).to.be.revertedWithCustomError(pass, "InvalidPlan").withArgs(2);
      await expect(pass.connect(alice).purchase(alice.address, 2, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(pass, "InvalidPlan")
        .withArgs(2);
      await expect(pass.quote(ethers.MaxUint256)).to.be.revertedWithCustomError(pass, "InvalidPlan");
    });
  });

  describe("price feed validation", function () {
    it("rejects a zero answer", async function () {
      const { pass, feed, alice } = await loadFixture(fixture);
      await feed.setAnswer(0);
      await expect(pass.quote(0)).to.be.revertedWithCustomError(pass, "InvalidPrice").withArgs(0);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(pass, "InvalidPrice")
        .withArgs(0);
    });

    it("rejects a negative answer", async function () {
      const { pass, feed, alice } = await loadFixture(fixture);
      await feed.setAnswer(-1);
      await expect(pass.quote(0)).to.be.revertedWithCustomError(pass, "InvalidPrice").withArgs(-1);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(pass, "InvalidPrice")
        .withArgs(-1);
    });

    it("rejects updatedAt == 0", async function () {
      const { pass, feed, alice } = await loadFixture(fixture);
      await feed.setRound(ETH_USD, 0);
      await expect(pass.quote(0)).to.be.revertedWithCustomError(pass, "StalePrice").withArgs(0);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(pass, "StalePrice")
        .withArgs(0);
    });

    it("rejects an updatedAt in the future", async function () {
      const { pass, feed, alice } = await loadFixture(fixture);
      const future = BigInt(await time.latest()) + 3600n;
      await feed.setRound(ETH_USD, future);
      await expect(pass.quote(0)).to.be.revertedWithCustomError(pass, "StalePrice").withArgs(future);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(pass, "StalePrice")
        .withArgs(future);
    });

    it("accepts an answer exactly maxStaleness old and rejects one second older", async function () {
      const { pass, feed, alice, plan0Wei } = await loadFixture(fixture);
      const t0 = BigInt(await time.latest()) + 100n;
      await feed.setRound(ETH_USD, t0);

      await time.setNextBlockTimestamp(t0 + MAX_STALENESS);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei })).to.emit(pass, "Purchased");

      await time.setNextBlockTimestamp(t0 + MAX_STALENESS + 1n);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei }))
        .to.be.revertedWithCustomError(pass, "StalePrice")
        .withArgs(t0);
    });

    it("quote reverts once the answer is stale, and recovers on the next update", async function () {
      const { pass, feed } = await loadFixture(fixture);
      const updatedAt = (await feed.latestRoundData()).updatedAt;
      await time.increase(MAX_STALENESS * 2n);
      await expect(pass.quote(0)).to.be.revertedWithCustomError(pass, "StalePrice").withArgs(updatedAt);
      await feed.setAnswer(ETH_USD);
      expect(await pass.quote(0)).to.equal(ethers.parseEther("0.012"));
    });

    it("propagates a reverting feed", async function () {
      const { pass, feed, alice } = await loadFixture(fixture);
      await feed.setShouldRevert(true);
      await expect(pass.quote(0)).to.be.revertedWith("MockAggregator: reverted");
      await expect(
        pass.connect(alice).purchase(alice.address, 0, { value: ethers.parseEther("1") }),
      ).to.be.revertedWith("MockAggregator: reverted");
    });

    it("rejects a feed whose decimals grow past 18 after deployment", async function () {
      const { pass, feed } = await loadFixture(fixture);
      await feed.setDecimals(19);
      await expect(pass.quote(0)).to.be.revertedWithCustomError(pass, "UnsupportedFeedDecimals").withArgs(19);
    });
  });

  describe("purchase", function () {
    it("mints token 1 to the buyer on exact payment and forwards the payment", async function () {
      const { pass, alice, payout, passAddress, plan0Wei } = await loadFixture(fixture);
      const tx = pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await expect(tx).to.changeEtherBalances([alice, payout, passAddress], [-plan0Wei, plan0Wei, 0n]);
      const ts = await blockTimestampOf(await tx);
      await expect(tx).to.emit(pass, "Transfer").withArgs(ethers.ZeroAddress, alice.address, 1);
      await expect(tx)
        .to.emit(pass, "Purchased")
        .withArgs(alice.address, alice.address, 1, 0, plan0Wei, ts + YEAR);
      expect(await pass.ownerOf(1)).to.equal(alice.address);
      expect(await pass.tokenOf(alice.address)).to.equal(1n);
      expect(await pass.expiresAt(1)).to.equal(ts + YEAR);
      expect(await pass.balanceOf(alice.address)).to.equal(1n);
      expect(await pass.isValid(alice.address)).to.equal(true);
    });

    it("returns the token id", async function () {
      const { pass, alice, bob, plan0Wei } = await loadFixture(fixture);
      expect(await pass.connect(alice).purchase.staticCall(alice.address, 0, { value: plan0Wei })).to.equal(1n);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      expect(await pass.connect(bob).purchase.staticCall(bob.address, 0, { value: plan0Wei })).to.equal(2n);
      expect(await pass.connect(bob).purchase.staticCall(alice.address, 0, { value: plan0Wei })).to.equal(1n);
    });

    it("refunds overpayment to the payer and keeps exactly the quote", async function () {
      const { pass, alice, payout, passAddress, plan0Wei } = await loadFixture(fixture);
      const sent = plan0Wei + ethers.parseEther("0.5");
      const tx = pass.connect(alice).purchase(alice.address, 0, { value: sent });
      await expect(tx).to.changeEtherBalances([alice, payout, passAddress], [-plan0Wei, plan0Wei, 0n]);
      await expect(tx).to.emit(pass, "Purchased").withArgs(alice.address, alice.address, 1, 0, plan0Wei, (v: bigint) => v > 0n);
    });

    it("rejects underpayment without side effects", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei - 1n }))
        .to.be.revertedWithCustomError(pass, "InsufficientPayment")
        .withArgs(plan0Wei, plan0Wei - 1n);
      await expect(pass.connect(alice).purchase(alice.address, 0))
        .to.be.revertedWithCustomError(pass, "InsufficientPayment")
        .withArgs(plan0Wei, 0);
      expect(await pass.tokenOf(alice.address)).to.equal(0n);
      expect(await pass.balanceOf(alice.address)).to.equal(0n);
    });

    it("rejects the zero address as recipient", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await expect(
        pass.connect(alice).purchase(ethers.ZeroAddress, 0, { value: plan0Wei }),
      ).to.be.revertedWithCustomError(pass, "InvalidRecipient");
    });

    it("sells the 3-year plan for $60", async function () {
      const { pass, alice, payout, plan1Wei } = await loadFixture(fixture);
      const tx = pass.connect(alice).purchase(alice.address, 1, { value: plan1Wei });
      await expect(tx).to.changeEtherBalances([alice, payout], [-plan1Wei, plan1Wei]);
      const ts = await blockTimestampOf(await tx);
      expect(await pass.expiresAt(1)).to.equal(ts + 3n * YEAR);
    });

    it("assigns sequential ids per new holder; renewals do not consume ids", async function () {
      const { pass, alice, bob, carol, plan0Wei } = await loadFixture(fixture);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await pass.connect(bob).purchase(bob.address, 0, { value: plan0Wei });
      await pass.connect(carol).purchase(carol.address, 1, { value: plan0Wei * 2n });
      expect(await pass.tokenOf(alice.address)).to.equal(1n);
      expect(await pass.tokenOf(bob.address)).to.equal(2n);
      expect(await pass.tokenOf(carol.address)).to.equal(3n);
      expect(await pass.ownerOf(3)).to.equal(carol.address);
    });

    it("rejects plain ETH transfers (no receive/fallback)", async function () {
      const { alice, passAddress } = await loadFixture(fixture);
      await expect(alice.sendTransaction({ to: passAddress, value: 1n })).to.be.reverted;
    });

    it("never holds ETH", async function () {
      const { pass, alice, bob, passAddress, plan0Wei, plan1Wei } = await loadFixture(fixture);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei + 12345n });
      await pass.connect(bob).purchase(alice.address, 1, { value: plan1Wei * 3n });
      await pass.connect(bob).purchase(bob.address, 1, { value: plan1Wei });
      expect(await ethers.provider.getBalance(passAddress)).to.equal(0n);
    });
  });

  describe("gifting (payer != recipient)", function () {
    it("mints to `to`, charges and refunds the payer", async function () {
      const { pass, alice, bob, payout, plan0Wei } = await loadFixture(fixture);
      const sent = plan0Wei + 1000n;
      const tx = pass.connect(alice).purchase(bob.address, 0, { value: sent });
      await expect(tx).to.changeEtherBalances([alice, bob, payout], [-plan0Wei, 0n, plan0Wei]);
      await expect(tx).to.emit(pass, "Purchased").withArgs(alice.address, bob.address, 1, 0, plan0Wei, (v: bigint) => v > 0n);
      expect(await pass.ownerOf(1)).to.equal(bob.address);
      expect(await pass.balanceOf(bob.address)).to.equal(1n);
      expect(await pass.tokenOf(alice.address)).to.equal(0n);
      expect(await pass.balanceOf(alice.address)).to.equal(0n);
    });

    it("lets a third party renew someone else's pass", async function () {
      const { pass, alice, bob, plan0Wei } = await loadFixture(fixture);
      const ts = await blockTimestampOf(await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei }));
      await pass.connect(bob).purchase(alice.address, 0, { value: plan0Wei });
      expect(await pass.expiresAt(1)).to.equal(ts + 2n * YEAR);
      expect(await pass.tokenOf(bob.address)).to.equal(0n);
    });

    it("mints to a contract without calling onERC721Received", async function () {
      const { pass, alice, feed, plan0Wei } = await loadFixture(fixture);
      const feedAddress = await feed.getAddress(); // not an ERC721Receiver
      await pass.connect(alice).purchase(feedAddress, 0, { value: plan0Wei });
      expect(await pass.ownerOf(1)).to.equal(feedAddress);
      expect(await pass.balanceOf(feedAddress)).to.equal(1n);
    });
  });

  describe("one token per address, renewal and expiry", function () {
    it("renewing keeps the same token and emits no Transfer", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      const tx = pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await expect(tx).not.to.emit(pass, "Transfer");
      await expect(tx).to.emit(pass, "Purchased");
      expect(await pass.tokenOf(alice.address)).to.equal(1n);
      expect(await pass.balanceOf(alice.address)).to.equal(1n);
      await expect(pass.ownerOf(2)).to.be.revertedWithCustomError(pass, "ERC721NonexistentToken");
    });

    it("renewal while active extends from the current expiry", async function () {
      const { pass, feed, alice, plan0Wei, plan1Wei } = await loadFixture(fixture);
      const t0 = await blockTimestampOf(await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei }));
      await advance(feed, 100n * DAY);
      const tx = pass.connect(alice).purchase(alice.address, 1, { value: plan1Wei });
      await expect(tx)
        .to.emit(pass, "Purchased")
        .withArgs(alice.address, alice.address, 1, 1, plan1Wei, t0 + YEAR + 3n * YEAR);
      expect(await pass.expiresAt(1)).to.equal(t0 + 4n * YEAR);
    });

    it("renewals stack", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      const t0 = await blockTimestampOf(await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei }));
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      expect(await pass.expiresAt(1)).to.equal(t0 + 3n * YEAR);
    });

    it("renewal after expiry restarts from now", async function () {
      const { pass, feed, alice, plan0Wei } = await loadFixture(fixture);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await advance(feed, 2n * YEAR);
      const tx = await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      const ts = await blockTimestampOf(tx);
      expect(await pass.expiresAt(1)).to.equal(ts + YEAR);
      expect(await pass.tokenOf(alice.address)).to.equal(1n);
    });

    it("balanceOf is 1 until expiresAt, 0 from expiresAt on, and 1 again after renewal", async function () {
      const { pass, feed, alice, plan0Wei } = await loadFixture(fixture);
      const probe = await ethers.deployContract("BalanceProbe");
      const passAddress = await pass.getAddress();
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      const expiry = await pass.expiresAt(1);

      await time.setNextBlockTimestamp(expiry - 1n);
      await probe.record(passAddress, alice.address);
      expect(await probe.lastTimestamp()).to.equal(expiry - 1n);
      expect(await probe.lastBalance()).to.equal(1n);
      expect(await probe.lastValid()).to.equal(true);

      await time.setNextBlockTimestamp(expiry);
      await probe.record(passAddress, alice.address);
      expect(await probe.lastTimestamp()).to.equal(expiry);
      expect(await probe.lastBalance()).to.equal(0n);
      expect(await probe.lastValid()).to.equal(false);

      // The token persists after expiry.
      expect(await pass.balanceOf(alice.address)).to.equal(0n);
      expect(await pass.isValid(alice.address)).to.equal(false);
      expect(await pass.ownerOf(1)).to.equal(alice.address);
      expect(await pass.tokenOf(alice.address)).to.equal(1n);
      expect(await pass.locked(1)).to.equal(true);
      expect(await pass.expiresAt(1)).to.equal(expiry);

      await feed.setAnswer(ETH_USD);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      expect(await pass.balanceOf(alice.address)).to.equal(1n);
      expect(await pass.isValid(alice.address)).to.equal(true);
    });

    it("never reports a balance above 1", async function () {
      const { pass, alice, bob, plan1Wei } = await loadFixture(fixture);
      for (let i = 0; i < 3; i++) await pass.connect(bob).purchase(alice.address, 1, { value: plan1Wei });
      expect(await pass.balanceOf(alice.address)).to.equal(1n);
    });

    it("balanceOf(0) reverts as in ERC-721; unknown holders have no pass", async function () {
      const { pass, mallory } = await loadFixture(fixture);
      await expect(pass.balanceOf(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(pass, "ERC721InvalidOwner")
        .withArgs(ethers.ZeroAddress);
      expect(await pass.balanceOf(mallory.address)).to.equal(0n);
      expect(await pass.isValid(mallory.address)).to.equal(false);
      expect(await pass.isValid(ethers.ZeroAddress)).to.equal(false);
      expect(await pass.tokenOf(mallory.address)).to.equal(0n);
      await expect(pass.expiresAt(1)).to.be.revertedWithCustomError(pass, "ERC721NonexistentToken").withArgs(1);
    });

    it("reverts instead of overflowing the uint64 expiry", async function () {
      const { pass, payout, feed, alice } = await loadFixture(fixture);
      const huge = await deployPass({
        payout: payout.address,
        feed: await feed.getAddress(),
        plans: [{ duration: 2n ** 64n - 1n, priceUsdCents: 1n }],
      });
      await expect(huge.connect(alice).purchase(alice.address, 0, { value: ethers.parseEther("1") }))
        .to.be.revertedWithCustomError(pass, "SafeCastOverflowedUintDowncast");
    });
  });

  describe("soulbound", function () {
    async function minted() {
      const f = await loadFixture(fixture);
      await f.pass.connect(f.alice).purchase(f.alice.address, 0, { value: f.plan0Wei });
      return f;
    }

    it("reverts transferFrom and both safeTransferFrom overloads, by the owner", async function () {
      const { pass, alice, bob } = await minted();
      await expect(pass.connect(alice).transferFrom(alice.address, bob.address, 1)).to.be.revertedWithCustomError(
        pass,
        "Soulbound",
      );
      await expect(
        pass.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, 1),
      ).to.be.revertedWithCustomError(pass, "Soulbound");
      await expect(
        pass.connect(alice)["safeTransferFrom(address,address,uint256,bytes)"](alice.address, bob.address, 1, "0x"),
      ).to.be.revertedWithCustomError(pass, "Soulbound");
      expect(await pass.ownerOf(1)).to.equal(alice.address);
    });

    it("reverts transfers attempted by anyone else, including the payout", async function () {
      const { pass, alice, bob, payout } = await minted();
      for (const caller of [bob, payout]) {
        await expect(pass.connect(caller).transferFrom(alice.address, bob.address, 1)).to.be.revertedWithCustomError(
          pass,
          "Soulbound",
        );
      }
    });

    it("reverts transfers to the zero address (no burn via transfer)", async function () {
      const { pass, alice } = await minted();
      await expect(pass.connect(alice).transferFrom(alice.address, ethers.ZeroAddress, 1))
        .to.be.revertedWithCustomError(pass, "ERC721InvalidReceiver")
        .withArgs(ethers.ZeroAddress);
    });

    it("reverts transfers of nonexistent tokens", async function () {
      const { pass, alice, bob } = await minted();
      await expect(pass.connect(alice).transferFrom(alice.address, bob.address, 2))
        .to.be.revertedWithCustomError(pass, "ERC721NonexistentToken")
        .withArgs(2);
    });

    it("still reverts transfers after expiry", async function () {
      const { pass, alice, bob } = await minted();
      await time.increase(2n * YEAR);
      await expect(pass.connect(alice).transferFrom(alice.address, bob.address, 1)).to.be.revertedWithCustomError(
        pass,
        "Soulbound",
      );
    });

    it("reverts approve and setApprovalForAll", async function () {
      const { pass, alice, bob } = await minted();
      await expect(pass.connect(alice).approve(bob.address, 1)).to.be.revertedWithCustomError(pass, "Soulbound");
      await expect(pass.connect(alice).approve(ethers.ZeroAddress, 1)).to.be.revertedWithCustomError(pass, "Soulbound");
      await expect(pass.connect(alice).setApprovalForAll(bob.address, true)).to.be.revertedWithCustomError(
        pass,
        "Soulbound",
      );
      await expect(pass.connect(alice).setApprovalForAll(bob.address, false)).to.be.revertedWithCustomError(
        pass,
        "Soulbound",
      );
      expect(await pass.getApproved(1)).to.equal(ethers.ZeroAddress);
      expect(await pass.isApprovedForAll(alice.address, bob.address)).to.equal(false);
    });

    it("exposes no burn, mint or admin entry points", async function () {
      const { pass } = await loadFixture(fixture);
      const mutating = pass.interface.fragments
        .filter((f): f is typeof f & { name: string; stateMutability: string } => f.type === "function")
        .filter((f) => f.stateMutability !== "view" && f.stateMutability !== "pure")
        .map((f) => f.name)
        .sort();
      expect(mutating).to.deep.equal(["purchase", "safeTransferFrom", "safeTransferFrom", "setPayout", "transferFrom"]);
    });
  });

  describe("payout", function () {
    it("lets the payout rotate itself; proceeds follow the new payout", async function () {
      const { pass, alice, payout, carol, plan0Wei } = await loadFixture(fixture);
      await expect(pass.connect(payout).setPayout(carol.address))
        .to.emit(pass, "PayoutChanged")
        .withArgs(payout.address, carol.address);
      expect(await pass.payout()).to.equal(carol.address);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei })).to.changeEtherBalances(
        [payout, carol],
        [0n, plan0Wei],
      );
      await expect(pass.connect(payout).setPayout(payout.address))
        .to.be.revertedWithCustomError(pass, "NotPayout")
        .withArgs(payout.address);
    });

    it("rejects setPayout from anyone else", async function () {
      const { pass, deployer, mallory } = await loadFixture(fixture);
      for (const caller of [deployer, mallory]) {
        await expect(pass.connect(caller).setPayout(caller.address))
          .to.be.revertedWithCustomError(pass, "NotPayout")
          .withArgs(caller.address);
      }
    });

    it("rejects a zero or self payout", async function () {
      const { pass, payout, passAddress } = await loadFixture(fixture);
      await expect(pass.connect(payout).setPayout(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(pass, "InvalidPayout")
        .withArgs(ethers.ZeroAddress);
      await expect(pass.connect(payout).setPayout(passAddress))
        .to.be.revertedWithCustomError(pass, "InvalidPayout")
        .withArgs(passAddress);
    });

    it("reverts the purchase when the payout rejects ETH, and recovers after rotation", async function () {
      const { feed, alice, carol, plan0Wei } = await loadFixture(fixture);
      const receiver = await ethers.deployContract("RejectingReceiver");
      const pass = await deployPass({ payout: await receiver.getAddress(), feed: await feed.getAddress() });
      await expect(
        pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei }),
      ).to.be.revertedWithCustomError(pass, "PayoutFailed");
      expect(await pass.tokenOf(alice.address)).to.equal(0n);

      // A contract payout can still rotate itself.
      await receiver.setPayout(await pass.getAddress(), carol.address);
      await expect(pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei })).to.changeEtherBalance(
        carol,
        plan0Wei,
      );
    });
  });

  describe("refunds and reentrancy", function () {
    it("reverts an overpaying purchase whose payer rejects the refund; exact payment works", async function () {
      const { pass, passAddress, bob, plan0Wei } = await loadFixture(fixture);
      const payer = await ethers.deployContract("RejectingReceiver");
      await expect(
        payer.purchase(passAddress, bob.address, 0, { value: plan0Wei + 1n }),
      ).to.be.revertedWithCustomError(pass, "RefundFailed");
      await payer.purchase(passAddress, bob.address, 0, { value: plan0Wei });
      expect(await pass.ownerOf(1)).to.equal(bob.address);
    });

    it("blocks a payer that re-enters purchase from its refund (bubbling -> whole tx reverts)", async function () {
      const { pass, passAddress, bob, carol, plan0Wei } = await loadFixture(fixture);
      const attacker = await ethers.deployContract("ReentrantReceiver");
      await attacker.configure(passAddress, false, carol.address, 0);
      await expect(
        attacker.purchase(bob.address, 0, { value: plan0Wei * 2n }),
      ).to.be.revertedWithCustomError(pass, "RefundFailed");
      expect(await pass.tokenOf(bob.address)).to.equal(0n);
      expect(await pass.tokenOf(carol.address)).to.equal(0n);
    });

    it("blocks a payer that re-enters purchase from its refund (swallowing -> only the outer purchase lands)", async function () {
      const { pass, passAddress, payout, bob, carol, plan0Wei } = await loadFixture(fixture);
      const attacker = await ethers.deployContract("ReentrantReceiver");
      const attackerAddress = await attacker.getAddress();
      await attacker.configure(passAddress, true, carol.address, 0);
      const excess = plan0Wei; // enough to pay for the re-entrant purchase
      const tx = attacker.purchase(bob.address, 0, { value: plan0Wei + excess });
      await expect(tx).to.changeEtherBalances([attackerAddress, payout, passAddress], [excess, plan0Wei, 0n]);

      expect(await attacker.reentryAttempts()).to.equal(1n);
      expect(await attacker.reentrySucceeded()).to.equal(false);
      const guardError = pass.interface.getError("ReentrancyGuardReentrantCall")!.selector;
      expect(await attacker.reentryError()).to.equal(guardError);
      expect(await pass.tokenOf(bob.address)).to.equal(1n);
      expect(await pass.tokenOf(carol.address)).to.equal(0n);
    });

    it("blocks a payout that re-enters purchase", async function () {
      const { feed, alice, carol, plan0Wei } = await loadFixture(fixture);
      for (const swallow of [false, true]) {
        const attacker = await ethers.deployContract("ReentrantReceiver");
        const pass = await deployPass({ payout: await attacker.getAddress(), feed: await feed.getAddress() });
        await attacker.configure(await pass.getAddress(), swallow, carol.address, 0);
        const tx = pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
        if (!swallow) {
          await expect(tx).to.be.revertedWithCustomError(pass, "PayoutFailed");
          expect(await pass.tokenOf(alice.address)).to.equal(0n);
        } else {
          await expect(tx).to.changeEtherBalance(await attacker.getAddress(), plan0Wei);
          expect(await attacker.reentrySucceeded()).to.equal(false);
          expect(await attacker.reentryError()).to.equal(
            pass.interface.getError("ReentrancyGuardReentrantCall")!.selector,
          );
          expect(await pass.tokenOf(alice.address)).to.equal(1n);
          expect(await pass.tokenOf(carol.address)).to.equal(0n);
        }
      }
    });
  });

  describe("tokenURI", function () {
    function decode(uri: string) {
      const prefix = "data:application/json;base64,";
      expect(uri.startsWith(prefix)).to.equal(true);
      return JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
    }

    it("returns on-chain JSON with name, description and expiresAt", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      const meta = decode(await pass.tokenURI(1));
      expect(meta.name).to.equal("5chan Pass #1");
      expect(meta.description).to.contain("5chan Pass");
      expect(meta.attributes).to.deep.equal([
        { trait_type: "expiresAt", display_type: "date", value: Number(await pass.expiresAt(1)) },
      ]);
    });

    it("reflects renewals", async function () {
      const { pass, alice, plan0Wei } = await loadFixture(fixture);
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      expect(decode(await pass.tokenURI(1)).attributes[0].value).to.equal(Number(await pass.expiresAt(1)));
    });

    it("escapes JSON special characters in the name", async function () {
      const { payout, feed, alice, plan0Wei } = await loadFixture(fixture);
      const name = 'Seedit "Gold" \\ test';
      const pass = await deployPass({ name, payout: payout.address, feed: await feed.getAddress() });
      await pass.connect(alice).purchase(alice.address, 0, { value: plan0Wei });
      expect(decode(await pass.tokenURI(1)).name).to.equal(`${name} #1`);
    });

    it("reverts for nonexistent tokens", async function () {
      const { pass } = await loadFixture(fixture);
      await expect(pass.tokenURI(1)).to.be.revertedWithCustomError(pass, "ERC721NonexistentToken").withArgs(1);
    });
  });
});

import { expect } from "chai";
import { DEPLOYMENTS, NETWORKS } from "../deploy/config";

// deploy/config.ts becomes immutable contract state; a typo here would ship to mainnet unnoticed.
describe("deploy config", function () {
  const DAY = 24 * 60 * 60;
  const plans = [
    { duration: 365 * DAY, priceUsdCents: 3000 },
    { duration: 1095 * DAY, priceUsdCents: 6000 },
  ];

  it("pins both passes' names, symbols, and plans", function () {
    expect(DEPLOYMENTS).to.deep.equal({
      "5chan-pass": { name: "5chan Pass", symbol: "5PASS", plans },
      "seedit-gold": { name: "Seedit Gold", symbol: "SGOLD", plans },
    });
  });

  it("pins the Chainlink ETH/USD feeds and staleness bounds", function () {
    expect(NETWORKS.mainnet).to.include({ chainId: 1, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", maxStalenessSeconds: 7200 });
    expect(NETWORKS.sepolia).to.include({ chainId: 11155111, priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306", maxStalenessSeconds: 86400 });
  });
});

/**
 * Deployment parameters. Everything here ends up in immutable contract state:
 * there are no setters, so a mistake means a redeploy.
 */

const DAY = 24 * 60 * 60;

export type TargetNetwork = "mainnet" | "sepolia";
export type DeploymentKey = "5chan-pass" | "seedit-gold";

export interface NetworkConfig {
  chainId: number;
  /** Chainlink ETH/USD proxy. */
  priceFeed: string;
  /** Max accepted answer age. The ETH/USD feeds have a 1h heartbeat (0.5% deviation on mainnet). */
  maxStalenessSeconds: number;
  explorer: string;
}

export interface Plan {
  duration: number; // seconds
  priceUsdCents: number; // 3000 = $30.00
}

export interface DeploymentConfig {
  name: string;
  symbol: string;
  plans: Plan[];
}

export const NETWORKS: Record<TargetNetwork, NetworkConfig> = {
  mainnet: {
    chainId: 1,
    priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    // Two heartbeats: tolerates one late/missed heartbeat before purchases start reverting.
    maxStalenessSeconds: 2 * 60 * 60,
    explorer: "https://etherscan.io",
  },
  sepolia: {
    chainId: 11155111,
    priceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    // Testnet feeds are less reliable; a lax bound keeps test deployments usable.
    maxStalenessSeconds: 24 * 60 * 60,
    explorer: "https://sepolia.etherscan.io",
  },
};

const DEFAULT_PLANS: Plan[] = [
  { duration: 365 * DAY, priceUsdCents: 3000 }, // 1 year, $30
  { duration: 3 * 365 * DAY, priceUsdCents: 6000 }, // 3 years, $60
];

export const DEPLOYMENTS: Record<DeploymentKey, DeploymentConfig> = {
  "5chan-pass": { name: "5chan Pass", symbol: "5PASS", plans: DEFAULT_PLANS },
  "seedit-gold": { name: "Seedit Gold", symbol: "SGOLD", plans: DEFAULT_PLANS },
};

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# MintPass - NFT Authentication Middleware for Bitsocial

<img src="public/mintpass.png" alt="MintPass Logo" width="90" align="left" />

MintPass is an NFT-based authentication system that provides verified identity proofs for decentralized communities. It began as an anti‑spam challenge for Bitsocial communities, and it works equally well for other protocols and social applications. Users mint a non‑transferable verification NFT (e.g., after SMS OTP) that communities can check to reduce sybil attacks, such as fake upvotes/downvotes, fake conversations, and users evading bans.

<br clear="left" />

## How people use MintPass

1) Visit `mintpass.org/request`, enter a phone number, and complete SMS OTP.
2) MintPass mints an NFT (on testnet in this reference deployment) to your wallet or records an equivalent “verified” state when on‑chain minting is disabled.
3) Communities (e.g., Bitsocial communities) check ownership of the NFT to treat you as authenticated for anti‑spam.

The request form looks like this:

<p align="center">
  <img src="public/mintpass-request.jpg" alt="MintPass request form screenshot" width="862" />
</p>

## What is Bitsocial?

Bitsocial is p2p and decentralized social media protocol built completely with IPFS/IPNS/pubsub. It doesn't use any central server, central database, public HTTP endpoint or DNS, it is pure peer to peer (except for the web client that can't join a P2P swarm directly, web clients use interchangeable HTTP providers). It allows community owners to retain full ownership over their community. Whitepaper [here](https://github.com/pkc/whitepaper/discussions/2).

MintPass integrates as a challenge so Bitsocial communities can distinguish real users and limit abuse without central servers. Because the artifact is an NFT, other decentralized apps can use the same credential to authenticate users.

## Project Structure

```
mintpass/
├── contracts/   # MintPassV1 smart contract and tooling
├── challenge/   # Bitsocial challenge implementation (“mintpass”)
├── web/         # Next.js website + API (mintpass.org)
├── docs/        # Documentation and specifications
├── tests/       # Cross‑component integration tests
└── scripts/     # Deployment and utilities
```

### Subprojects

- `contracts/`: Solidity contracts (MintPassV1). Versioned, role‑based minting, token types per NFT (type 0 = SMS). See `contracts/README.md`.
- `challenge/`: The Bitsocial challenge that checks for a MintPass NFT and applies additional rules (e.g., transfer cooldowns) to resist sybils.
- `web/`: The user‑facing site and serverless backend. Sends SMS codes, verifies OTP, and mints or records successful verification. See `web/README.md`.

## Privacy and anti‑sybil design (high level)

- Short‑lived operational data (OTP codes, verification markers, rate‑limit state) stored in Redis with TTLs.
- Persistent “mint association” between wallet and phone to prevent duplicate mints.
- Optional IP reputation (VPN/proxy) and phone‑risk checks, optional geoblocking, and per‑IP cooldowns.
- Secrets live only in environment variables; logs avoid PII and never include OTPs or private keys.

## Getting started

1. Run `nvm install && nvm use`
2. Run `corepack enable` once per machine so `yarn` resolves to the pinned Yarn 4 release
3. Use plain `yarn install`, `yarn build`, and `yarn test`

- Contracts: `cd contracts && yarn install && yarn test`
- Challenge: `cd challenge && yarn install && yarn test`
- Web: `cd web && yarn install && yarn dev` then open `http://mintpass.localhost:1355/request`

## Where MintPass is useful

While designed for Bitsocial, any decentralized or serverless social app can use MintPass NFTs as a lightweight proof‑of‑personhood. Apps only need to check ownership of a token type (e.g., type 0 for SMS) to gate actions or increase trust in votes and reports.

## Roadmap and considerations

We plan to support multiple authentication methods alongside SMS OTP to fit different threat models and UX constraints:
- Add a “pay‑to‑mint” option with a small fee that is high enough to deter bulk purchases but low enough for regular users.
- Add additional human‑verification signals (e.g., email, government‑backed KYC providers, or proofs such as biometrics/world‑ID systems) when they can be integrated without compromising decentralization goals.
- Expand admin tooling, heuristics, and optional device signals to further reduce abuse.

These items are exploratory; concrete work will land incrementally and stay configurable so communities can choose what they trust.

## Technology Stack

- **Smart Contracts**: Solidity, Hardhat/Foundry
- **Website**: Next.js, React, Ethereum (ethers)
- **Challenges**: TypeScript, pkc-js integration
- **Deployment**: Base network (L2)

## License

MIT License — see [LICENSE](LICENSE).

Open source and commercial‑friendly. A hosted version is available at [mintpass.org](https://mintpass.org).

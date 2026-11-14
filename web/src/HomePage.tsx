import { Hero } from "./components/Hero";
import { Implementations } from "./components/Implementations";
import { HowItWorks } from "./components/HowItWorks";
import { Uses } from "./components/Uses";
import { Interface } from "./components/Interface";
import { Deploy } from "./components/Deploy";

export function HomePage({ renderedAt }: { renderedAt: string }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        {" "}
        <a className="brand" href="/" aria-label="MintPass home">
          <picture>
            <source srcSet="/mintpass-dark.svg" media="(prefers-color-scheme: dark)" />
            <img src="/mintpass.svg" alt="" width="40" height="29" />
          </picture>
          <span>MintPass</span>
        </a>
        <nav aria-label="Sections">
          {" "}
          <a href="#implementations">Implementations</a> <a href="#how">How it works</a>{" "}
          <a href="#interface">Interface</a> <a href="#deploy">Deploy your own</a>{" "}
          <a href="https://github.com/bitsocialnet/mintpass">GitHub</a>
        </nav>
      </header>

      <main id="main">
        <Hero renderedAt={renderedAt} />

        <ul className="traits" aria-label="What every MintPass has in common">
          <li>
            <strong>Locked to its holder</strong>No transfer, approval or burn. One pass per
            address.
          </li>
          <li>
            <strong>Expires and renews</strong>Time is prepaid. Buying again extends the same token.
          </li>
          <li>
            <strong>Dollar price, ETH payment</strong>Converted on-chain with the Chainlink ETH/USD
            feed.
          </li>
          <li>
            <strong>No admin</strong>No owner, no free mints, no price changes after deployment.
          </li>
        </ul>

        <Implementations />

        <HowItWorks />

        <Uses />

        <Interface />

        <Deploy />
      </main>

      <footer className="site-footer">
        <p>MintPass is open source under the MIT license.</p>
        <nav aria-label="Elsewhere">
          {" "}
          <a href="https://github.com/bitsocialnet/mintpass">Source</a>{" "}
          <a href="https://github.com/bitsocialnet/BSIPs/blob/master/BSIPS/bsip-18.md">BSIP-18</a>{" "}
          <a href="https://bitsocial.net">Bitsocial</a>
        </nav>
      </footer>
    </>
  );
}

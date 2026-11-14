export function Implementations() {
  return (
    <section id="implementations" className="block" aria-labelledby="impl-title">
      <p className="eyebrow">Registry</p>
      <h2 id="impl-title">Known implementations</h2>
      <p className="intro">
        Every pass below is its own deployment of the same contract. Looking for a pass you hold?
        Open its page in the app.
      </p>
      <div className="impl-grid">
        <article className="impl impl-5chan">
          <header>
            <h3>5chan Pass</h3>
            <span className="symbol">5PASS</span>
          </header>
          <p>
            For 5chan, the imageboard with no admins. Holders vote on which boards fill the
            directory and skip captchas on boards that accept the pass.
          </p>
          <dl>
            <div>
              <dt>Plans</dt>
              <dd>$30 for 1 year · $60 for 3 years</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Ethereum mainnet</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>Not deployed yet</dd>
            </div>
          </dl>{" "}
          <a className="button" href="https://5chan.app/#/pass">
            Open in 5chan
          </a>
        </article>
        <article className="impl impl-seedit">
          <header>
            <h3>Seedit Gold</h3>
            <span className="symbol">SGOLD</span>
          </header>
          <p>
            For Seedit, the community forum with no admins. Holders vote on which communities Seedit
            lists by default and skip captchas where Gold is accepted.
          </p>
          <dl>
            <div>
              <dt>Plans</dt>
              <dd>$30 for 1 year · $60 for 3 years</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Ethereum mainnet</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>Not deployed yet</dd>
            </div>
          </dl>{" "}
          <a className="button" href="https://seedit.app/#/gold">
            Open in Seedit
          </a>
        </article>
        <article className="impl impl-yours">
          <header>
            <h3>Your pass</h3>
            <span className="symbol">????</span>
          </header>
          <p>
            Deployed a MintPass for your own app or community? Open a pull request and it gets
            listed here with a link to your page.
          </p>{" "}
          <a className="button" href="#deploy">
            Deploy your own
          </a>
        </article>
      </div>
    </section>
  );
}

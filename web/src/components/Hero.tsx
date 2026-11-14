import { ExampleExpiry } from "./ExampleExpiry";

export function Hero({ renderedAt }: { renderedAt: string }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">ERC-721 · ERC-5192 · MIT</p>
        <h1 id="hero-title">A pass contract any app can deploy.</h1>
        <p className="lede">
          MintPass is one Solidity contract for paid passes that expire and can never change hands.
          Deploy your own, name it after your app, and gate votes, posting or anything else on who
          holds one.
        </p>
        <p className="cta">
          {" "}
          <a className="button primary" href="#deploy">
            Deploy your own
          </a>{" "}
          <a className="button" href="https://github.com/bitsocialnet/mintpass">
            Read the source
          </a>
        </p>
      </div>

      <div
        className="hero-passes"
        role="img"
        aria-label="Three passes: Seedit Gold, 5chan Pass, and an empty outline labelled Your pass"
      >
        <div className="pass pass-yours" aria-hidden="true">
          <p className="pass-name">Your pass</p>
          <p className="pass-issuer">one config entry away</p>
        </div>
        <div className="pass pass-seedit" aria-hidden="true">
          <p className="micro">
            NONTRANSFERABLE NONTRANSFERABLE NONTRANSFERABLE NONTRANSFERABLE NONTRANSFERABLE
          </p>
          <span className="punch"></span>
          <p className="pass-name">Seedit Gold</p>
          <p className="pass-issuer">SGOLD</p>
          <dl className="pass-fields">
            <div>
              <dt>Holder</dt>
              <dd className="mono">0x9c1e…7a40</dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <ExampleExpiry years={3} renderedAt={renderedAt} />
            </div>
          </dl>
        </div>
        <div className="pass pass-5chan" aria-hidden="true">
          <p className="micro">
            NONTRANSFERABLE NONTRANSFERABLE NONTRANSFERABLE NONTRANSFERABLE NONTRANSFERABLE
          </p>
          <span className="punch"></span>
          <img className="seal" src="/mintpass.svg" alt="" width="40" height="29" />
          <p className="pass-name">5chan Pass</p>
          <p className="pass-issuer">5PASS</p>
          <dl className="pass-fields">
            <div>
              <dt>Holder</dt>
              <dd className="mono">0x4d7f…1b97</dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <ExampleExpiry years={1} renderedAt={renderedAt} />
            </div>
          </dl>
          <p className="stamp">Non&#8209;transferable</p>
        </div>
      </div>
    </section>
  );
}

export function Uses() {
  return (
    <section id="uses" className="block" aria-labelledby="uses-title">
      <p className="eyebrow">Consumers</p>
      <h2 id="uses-title">What a pass can gate</h2>
      <div className="uses">
        <article>
          <span className="badge live">Built</span>
          <h3>One holder, one vote</h3>
          <p>
            BSIP-18 pubsub voting counts votes from wallets that hold a pass, through its{" "}
            <code>erc5192-min-balance</code> rule. A pass cannot move, so it backs exactly one vote.
          </p>{" "}
          <a href="https://github.com/bitsocialnet/BSIPs/blob/master/BSIPS/bsip-18.md">
            Read BSIP-18
          </a>
        </article>
        <article>
          <span className="badge live">Built</span>
          <h3>Posting without a captcha</h3>
          <p>
            Communities that run the EVM contract challenge let pass holders post without solving
            anything.
          </p>{" "}
          <a href="https://github.com/bitsocialnet/evm-contract-challenge">
            evm-contract-challenge
          </a>
        </article>
        <article>
          <span className="badge">Possible</span>
          <h3>Whatever you build</h3>
          <p>
            Members-only boards, supporter flair, higher rate limits, paid API tiers. If it can call{" "}
            <code>balanceOf</code>, it can check a pass.
          </p>
        </article>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="block" aria-labelledby="how-title">
      <p className="eyebrow">Mechanics</p>
      <h2 id="how-title">How it works</h2>
      <ol className="flow">
        <li>
          <span className="flow-step">Buy</span>
          <h3>Anyone pays for any address</h3>
          <p>
            {" "}
            <code>purchase(to, planId)</code> takes ETH from the payer and mints to <code>to</code>.
            A user can pay from MetaMask and receive the pass on the address built into their app
            account. Extra ETH is refunded to the payer in the same transaction; a contract wallet
            that cannot receive ETH must send the exact <code>quote</code>.
          </p>
        </li>
        <li>
          <span className="flow-step">Settle</span>
          <h3>The contract prices and forwards</h3>
          <p>
            It reads the Chainlink ETH/USD feed, charges the plan's dollar price, and sends the
            payment straight to the payout address. Nothing is held in the contract.
          </p>
        </li>
        <li>
          <span className="flow-step">Check</span>
          <h3>Apps read one number</h3>
          <p>
            {" "}
            <code>balanceOf(address)</code> is 1 while the pass is valid and 0 otherwise. Anything
            that can read a token balance can honour the pass, with no server in between.
          </p>
        </li>
      </ol>

      <div
        className="timeline"
        role="img"
        aria-label="Timeline: balanceOf is 1 from purchase until expiry, 0 after expiry, and 1 again after renewal"
      >
        <p className="timeline-title">
          <code>balanceOf(holder)</code> over time
        </p>
        <div className="track" aria-hidden="true">
          <span className="seg on">1</span>
          <span className="seg off">0</span>
          <span className="seg on">1</span>
        </div>
        <div className="marks" aria-hidden="true">
          <span>purchase</span>
          <span>expires</span>
          <span>renewed</span>
        </div>
      </div>
      <div className="timeline">
        <p className="timeline-note">
          The token still exists after expiry and <code>ownerOf</code> still returns the holder.
          This departs from ERC-721 on purpose, so existing balance checks respect expiry without
          new code.
        </p>
      </div>
    </section>
  );
}

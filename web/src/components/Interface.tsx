export function Interface() {
  return (
    <section id="interface" className="block" aria-labelledby="interface-title">
      <p className="eyebrow">Reference</p>
      <h2 id="interface-title">Interface</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Function</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>purchase(address to, uint256 planId) payable</code>
              </td>
              <td>
                Mints a pass to <code>to</code>, or renews the one it has. Refunds any excess to the
                payer.
              </td>
            </tr>
            <tr>
              <td>
                <code>quote(uint256 planId)</code>
              </td>
              <td>The plan's price in wei right now, rounded up.</td>
            </tr>
            <tr>
              <td>
                <code>plans()</code>
              </td>
              <td>Every plan: a duration and a price in US cents.</td>
            </tr>
            <tr>
              <td>
                <code>isValid(address)</code>
              </td>
              <td>Whether the address holds an unexpired pass.</td>
            </tr>
            <tr>
              <td>
                <code>balanceOf(address)</code>
              </td>
              <td>1 while the pass is unexpired, otherwise 0.</td>
            </tr>
            <tr>
              <td>
                <code>tokenOf(address)</code>, <code>expiresAt(tokenId)</code>
              </td>
              <td>The holder's token id (0 if none) and when it expires.</td>
            </tr>
            <tr>
              <td>
                <code>locked(tokenId)</code>
              </td>
              <td>Always true (ERC-5192).</td>
            </tr>
            <tr>
              <td>
                <code>proposePayout(address)</code>, <code>acceptPayout()</code>
              </td>
              <td>
                The only privileged action: the payout address hands its role to a new one, in two
                steps.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="aside">
        Full behaviour, revert conditions, gas numbers and risks are in the{" "}
        <a href="https://github.com/bitsocialnet/mintpass#readme">README</a>. The contract has not
        had an external audit.
      </p>
    </section>
  );
}

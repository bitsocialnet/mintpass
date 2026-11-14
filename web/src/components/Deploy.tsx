export function Deploy() {
  return (
    <section id="deploy" className="block" aria-labelledby="deploy-title">
      <p className="eyebrow">Fork it</p>
      <h2 id="deploy-title">Deploy your own</h2>
      <ol className="steps">
        <li>
          <h3>Fork the repository and add your pass.</h3>
          <p>
            In <code>deploy/config.ts</code>, add your key to the <code>DeploymentKey</code> type,
            then a name, a symbol and your plans to <code>DEPLOYMENTS</code>. These become
            immutable, so choose carefully.
          </p>
          <pre>
            <code>
              {
                'export type DeploymentKey = "5chan-pass" | "seedit-gold" | "my-pass";\n\n"my-pass": {\n  name: "My Pass",\n  symbol: "MYPASS",\n  plans: [{ duration: 365 * DAY, priceUsdCents: 3000 }],\n},'
              }
            </code>
          </pre>
        </li>
        <li>
          <h3>Dry run it.</h3>
          <p>
            The script reads the live feed, simulates the deployment and prints the cost. It sends
            nothing unless you set <code>DRY_RUN=0</code>.
          </p>
          <pre>
            <code>{"DEPLOYMENT=my-pass PAYOUT_ADDRESS=0x... yarn deploy --network mainnet"}</code>
          </pre>
        </li>
        <li>
          <h3>Deploy and verify.</h3>
          <p>
            The deploy writes the constructor arguments to <code>deployments/</code>; verify on
            Etherscan with them. Proceeds go to your payout address from the first sale. A multisig
            works.
          </p>
          <pre>
            <code>
              {
                "DEPLOYMENT=my-pass PAYOUT_ADDRESS=0x... DRY_RUN=0 DEPLOYER_PRIVATE_KEY=0x... yarn deploy --network mainnet\nyarn hardhat verify --network mainnet --constructor-args deployments/my-pass-mainnet.args.js <address>"
              }
            </code>
          </pre>
        </li>
        <li>
          <h3>Point your app at it.</h3>
          <p>
            Sell it from your own page with <code>quote</code> and <code>purchase</code>, gate on{" "}
            <code>balanceOf</code>, then open a pull request to be listed above.
          </p>
        </li>
      </ol>
    </section>
  );
}

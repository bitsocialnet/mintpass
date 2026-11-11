/**
 * deployments/<deployment>-<network>.json is the deploy script's only record that a pass is deployed on a
 * live network. It is saved before the deploy transaction is sent, with the address the contract will get
 * (the nonce is fixed up front), so an RPC error, a crash or Ctrl-C after sending can never leave a
 * contract on chain without a record, and a re-run never deploys a second contract.
 */
import * as fs from "fs";
import * as path from "path";
import { ethers, type ContractFactory, type ContractTransactionReceipt, type Signer } from "ethers";

/** Throws if `file` exists: the pass is deployed, or a deploy was (or may have been) sent and can still land. */
export function refuseExistingRecord(file: string): void {
  if (!fs.existsSync(file)) return;
  const name = path.relative(process.cwd(), file);
  let record;
  try {
    record = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error(`${name} exists but is not valid JSON: check it before deploying again`);
  }
  if (record.status === "broadcasting") {
    // Whatever transaction takes the nonce decides what is at the address. Another pass deployed from the same
    // key lands there too, and so does this pass sent with other values (a second run with other settings, or
    // a replacement sent by hand). So neither code at the address nor a matching name proves that this deploy
    // landed: every immutable value has to match the record.
    const [passName, passSymbol, payout, priceFeed, maxStaleness, plans] = record.constructorArgs ?? [];
    const { address, nonce } = record;
    throw new Error(
      [
        `${name} exists: a deploy of ${record.deployment} on ${record.network} was sent, or was about to be, from ` +
          `${record.deployer} with nonce ${nonce}, and the run stopped before its receipt. Only the transaction ` +
          `with nonce ${nonce} can put a contract at ${address}. Check that nonce and the contract at ${address}:`,
        `- Nonce ${nonce} used and ${address} holds this pass with every recorded value: name() "${passName}", ` +
          `symbol() "${passSymbol}", payout() ${payout}, priceFeed() ${priceFeed}, maxStaleness() ${maxStaleness} ` +
          `and plans() ${JSON.stringify(plans)}: that is the deployment. Keep this file.`,
        `- Nonce ${nonce} used and ${address} has no code, holds another contract, or holds this pass with any ` +
          `other value (another deploy from this key took the nonce): this deploy can never land. Delete this ` +
          `file and deploy again.`,
        `- Nonce ${nonce} not used yet (the deployer's confirmed transaction count is ${nonce} or less): the deploy ` +
          `can still land. Wait for it, or use up the nonce with a 0 ETH transfer from the deployer to itself at ` +
          `nonce ${nonce}, with a higher fee if the deploy is still pending, and delete this file once that ` +
          `transfer is mined. Deploying any other pass from this key also uses nonce ${nonce}.`,
      ].join("\n"),
    );
  }
  throw new Error(`${name} exists: ${record.deployment} is already deployed on ${record.network} at ${record.address}`);
}

function writeRecord(file: string, record: Record<string, unknown>): void {
  fs.writeFileSync(file, JSON.stringify({ ...record, timestamp: new Date().toISOString() }, null, 2) + "\n");
}

/**
 * Saves a "broadcasting" record, sends the deploy with the nonce that record names, waits for
 * `confirmations`, then completes the record with status "deployed".
 */
export async function deployAndRecord(opts: {
  file: string;
  factory: ContractFactory;
  args: unknown[];
  deployer: Signer;
  confirmations: number;
  fields: Record<string, unknown>;
  log: (line: string) => void;
}): Promise<{ address: string; txHash: string; receipt: ContractTransactionReceipt }> {
  const from = await opts.deployer.getAddress();
  const nonce = await opts.deployer.getNonce("pending");
  const address = ethers.getCreateAddress({ from, nonce });
  // constructorArgs name the pass (name, symbol) that the guard tells the operator to look for at `address`.
  const record = { ...opts.fields, constructorArgs: opts.args, address, deployer: from, nonce };
  writeRecord(opts.file, { status: "broadcasting", ...record });
  opts.log(`\nrecord          ${path.relative(process.cwd(), opts.file)} (before sending: address ${address}, nonce ${nonce})`);

  const contract = await opts.factory.connect(opts.deployer).deploy(...opts.args, { nonce });
  const tx = contract.deploymentTransaction()!;
  opts.log(`tx              ${tx.hash}`);
  const receipt = (await tx.wait(opts.confirmations))!;
  writeRecord(opts.file, { status: "deployed", ...record, txHash: tx.hash, blockNumber: receipt.blockNumber });
  return { address, txHash: tx.hash, receipt };
}

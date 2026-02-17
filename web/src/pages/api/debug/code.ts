import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { readSmsCode } from "../../../../lib/kv";
import { isProductionRuntime, shouldUseKvFallback } from "../../../../lib/sms";

const Body = z.object({
  phoneE164: z.string().min(5),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (isProductionRuntime()) return res.status(404).json({ error: "Not found" });

  const hdr = (req.headers["x-smoke-test-token"] as string) || "";
  if (!shouldUseKvFallback(hdr)) {
    return res.status(401).json({ ok: false, match: false });
  }

  const parse = Body.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid body" });
  const { phoneE164 } = parse.data;

  const code = await readSmsCode(phoneE164);
  return res.status(200).json({ ok: true, code });
}

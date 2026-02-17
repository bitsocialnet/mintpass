import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  clearSmsCode,
  markPhoneVerified,
  readSmsCode,
  addIpAssociationForPhone,
} from "../../../../lib/kv";
import { globalIpRatelimit } from "../../../../lib/rate-limit";
import { getClientIp } from "../../../../lib/request-ip";
import { hashIdentifier } from "../../../../lib/hash";
import {
  checkSmsVerification,
  isProductionRuntime,
  isVerifyConfigured,
  shouldUseKvFallback,
  type SmsProviderError,
} from "../../../../lib/sms";

const Body = z.object({
  phoneE164: z.string().min(5),
  code: z.string().length(6),
});

function toClientProviderError(providerError: SmsProviderError | undefined) {
  if (!providerError) return undefined;
  return {
    provider: providerError.provider,
    status: providerError.status,
    errorCode: providerError.errorCode,
    errorMessage: providerError.errorMessage,
    // Backwards-compatible aliases for existing client-side error rendering.
    code: providerError.errorCode,
    message: providerError.errorMessage,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Global IP rate limiting
  const ip = getClientIp(req);
  const hashedIp = hashIdentifier("ip", ip);
  const { success, limit, reset, remaining } = await globalIpRatelimit.limit(hashedIp);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(reset));
  if (!success) return res.status(429).json({ error: "Too many requests" });

  const parse = Body.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid body" });
  const { phoneE164, code } = parse.data;

  const smokeHeader = (req.headers["x-smoke-test-token"] as string) || "";
  const useKvFallback = shouldUseKvFallback(smokeHeader);

  if (useKvFallback) {
    const stored = await readSmsCode(phoneE164);
    if (!stored) {
      return res.status(400).json({ error: "Code expired or invalid. Request a new code." });
    }

    // Normalize both sides to string to tolerate provider/SDK returning numbers
    const storedStr = typeof stored === "string" ? stored : String(stored);
    const codeStr = String(code);
    if (storedStr !== codeStr) {
      return res
        .status(400)
        .json({ error: "Invalid code", debug: { posted: codeStr, stored: storedStr } });
    }
  } else {
    if (!isVerifyConfigured()) {
      const errorMessage = isProductionRuntime()
        ? "SMS verification service unavailable."
        : "SMS verification service unavailable. Use the smoke fallback token in non-production.";
      return res.status(503).json({ error: errorMessage });
    }

    const verifyResult = await checkSmsVerification(phoneE164, code, {
      timeoutMs: 5000,
      maxRetries: 1,
      baseDelayMs: 300,
      deviceIp: ip,
    });
    if (!verifyResult.ok) {
      if (verifyResult.reason === "invalid_code") {
        return res.status(400).json({ error: "Invalid code" });
      }
      if (verifyResult.reason === "expired_or_invalid") {
        return res.status(400).json({ error: "Code expired or invalid. Request a new code." });
      }

      const providerError = toClientProviderError(verifyResult.providerError);
      try {
        console.warn("SMS verify failed", {
          phone: hashIdentifier("phone", phoneE164),
          status: providerError?.status,
          provider: providerError?.provider,
          code: providerError?.errorCode,
          message: providerError?.errorMessage,
        });
      } catch {}

      return res.status(502).json({
        error: "SMS provider error. Please try again later.",
        providerError,
      });
    }
  }

  await markPhoneVerified(phoneE164);
  // Always clear fallback KV code after successful verification.
  await clearSmsCode(phoneE164);
  // Index hashed IP association on verify as well (covers flows where send indexing failed)
  try {
    const ip = getClientIp(req);
    await addIpAssociationForPhone(phoneE164, ip);
  } catch {}
  return res.status(200).json({ ok: true });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { globalIpRatelimit } from "../../../../lib/rate-limit";
import {
  saveSmsCode,
  addIpAssociationForPhone,
  addIpAssociationForAddress,
} from "../../../../lib/kv";
import { assessIpReputation } from "../../../../lib/ip-reputation";
import { analyzePhone } from "../../../../lib/phone-intel";
import { getClientIp } from "../../../../lib/request-ip";
import {
  isSmsSendInCooldown,
  setSmsSendCooldown,
  getSmsSendCooldownRemaining,
} from "../../../../lib/cooldowns";
import {
  isProductionRuntime,
  isVerifyConfigured,
  startSmsVerification,
  shouldUseKvFallback,
  type SmsProviderError,
} from "../../../../lib/sms";
import { hashIdentifier } from "../../../../lib/hash";

const Body = z.object({
  phoneE164: z.string().min(5),
  address: z.string().min(1),
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function readCooldownRemaining(ip: string, phoneE164: string): Promise<number> {
  try {
    return await getSmsSendCooldownRemaining(ip, phoneE164);
  } catch {
    return 0;
  }
}

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

  // Rate limit by IP
  const ip = getClientIp(req);
  const hashedIp = hashIdentifier("ip", ip);
  const { success, limit, reset, remaining } = await globalIpRatelimit.limit(hashedIp);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(reset));
  if (!success) return res.status(429).json({ error: "Too many requests" });

  const parse = Body.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Invalid body" });
  const { phoneE164, address } = parse.data;

  // Reject VPNs/proxies/cloud-provider IPs if IP intelligence is configured
  const rep = await assessIpReputation(req);
  if (rep.isVpnOrProxy || rep.isCloudProvider) {
    return res.status(400).json({ error: "VPNs and proxies are not allowed" });
  }

  // Cooldown checks per IP and phone
  if (await isSmsSendInCooldown(ip, phoneE164)) {
    let remainingSeconds = 0;
    try {
      remainingSeconds = await getSmsSendCooldownRemaining(ip, phoneE164);
    } catch {
      remainingSeconds = 0;
    }
    const remainingTime = remainingSeconds > 0 ? `${remainingSeconds}s` : "";
    const errorMessage = remainingTime
      ? `Please wait ${remainingTime} before requesting another code`
      : "Please wait before requesting another code";
    if (remainingSeconds > 0) res.setHeader("Retry-After", String(remainingSeconds));
    return res.status(429).json({ error: errorMessage, cooldownSeconds: remainingSeconds });
  }

  // Reject disposable/VOIP/high-risk numbers if phone intelligence is configured
  const pcheck = await analyzePhone(phoneE164);
  // Allow high-risk numbers only in Preview environment to enable testing
  const isPreviewEnv = (process.env.VERCEL_ENV || "").toLowerCase() === "preview";
  if (!isPreviewEnv && pcheck.isHighRisk) {
    return res.status(400).json({ error: "Phone number not eligible" });
  }

  const smokeHeader = (req.headers["x-smoke-test-token"] as string) || "";
  const useKvFallback = shouldUseKvFallback(smokeHeader);
  const mode: "verify" | "kv-fallback" = useKvFallback ? "kv-fallback" : "verify";
  if (mode === "verify" && !isVerifyConfigured()) {
    const errorMessage = isProductionRuntime()
      ? "SMS verification service unavailable."
      : "SMS verification service unavailable. Use the smoke fallback token in non-production.";
    return res.status(503).json({ error: errorMessage });
  }

  let fallbackCode: string | undefined;
  if (mode === "kv-fallback") {
    fallbackCode = generateCode();
    await saveSmsCode(phoneE164, fallbackCode);
  }

  // Keep cooldown writes at send time for both verify and fallback modes.
  await setSmsSendCooldown(ip, phoneE164);

  // Index hashed IP associations for phone and address for admin tooling
  try {
    await Promise.all([
      addIpAssociationForPhone(phoneE164, ip),
      addIpAssociationForAddress(address, ip),
    ]);
  } catch {}

  if (mode === "kv-fallback") {
    return res.status(200).json({
      ok: true,
      mode,
      ...(fallbackCode ? { debugCode: fallbackCode } : {}),
    });
  }

  const result = await startSmsVerification(phoneE164, {
    timeoutMs: 5000,
    maxRetries: 1,
    baseDelayMs: 300,
    deviceIp: ip,
  });

  if (!result.ok) {
    const remainingSeconds = await readCooldownRemaining(ip, phoneE164);
    const providerError = toClientProviderError(result.providerError);
    const isClientError =
      typeof providerError?.status === "number" &&
      providerError.status >= 400 &&
      providerError.status < 500;

    const statusCode = isClientError ? 400 : 502;
    const errorMessage = isClientError
      ? "Unable to deliver SMS to this number. Service is not available for this destination yet."
      : "SMS provider error. Please try again later.";

    // Log minimal diagnostic info with hashed phone (no PII or OTP values).
    try {
      console.warn("SMS send failed", {
        phone: hashIdentifier("phone", phoneE164),
        status: providerError?.status,
        provider: providerError?.provider,
        code: providerError?.errorCode,
        message: providerError?.errorMessage,
      });
    } catch {}

    return res
      .status(statusCode)
      .json({ error: errorMessage, cooldownSeconds: remainingSeconds, providerError });
  }

  return res.status(200).json({ ok: true, sid: result.sid, mode });
}

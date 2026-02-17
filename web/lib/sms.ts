import { env } from "./env";

const VERIFY_PROVIDER = "twilio-verify" as const;

export type SmsProviderError = {
  provider: typeof VERIFY_PROVIDER;
  status?: number;
  errorCode?: number | string;
  errorMessage?: string;
};

type VerifyRequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  deviceIp?: string;
};

export type StartSmsVerificationResult = {
  ok: boolean;
  sid?: string;
  status?: string;
  providerError?: SmsProviderError;
};

export type SmsVerificationFailureReason = "invalid_code" | "expired_or_invalid" | "provider_error";

export type CheckSmsVerificationResult = {
  ok: boolean;
  sid?: string;
  status?: string;
  valid?: boolean;
  reason?: SmsVerificationFailureReason;
  providerError?: SmsProviderError;
};

type TwilioVerifyResponse = {
  sid?: unknown;
  status?: unknown;
  valid?: unknown;
};

type VerifyPostResult =
  | { ok: true; status: number; data: TwilioVerifyResponse }
  | { ok: false; providerError: SmsProviderError };

const EXPIRED_OR_INVALID_ERROR_CODES = new Set<number>([20404, 60202, 60203, 60212, 60213, 60224]);
const INVALID_CODE_ERROR_CODES = new Set<number>([60200]);
const EXPIRED_OR_INVALID_STATUS = new Set([
  "canceled",
  "expired",
  "max_attempts_reached",
  "denied",
]);

function toUrlEncoded(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join("&");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getNumericCode(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeProviderError(
  status: number | undefined,
  details: { errorCode?: number | string; errorMessage?: string } = {},
): SmsProviderError {
  return {
    provider: VERIFY_PROVIDER,
    status,
    errorCode: details.errorCode,
    errorMessage: details.errorMessage,
  };
}

export function isProductionRuntime(): boolean {
  return (process.env.VERCEL_ENV || "").toLowerCase() === "production";
}

export function isVerifyConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID);
}

export function shouldUseKvFallback(smokeTokenHeader: string | undefined): boolean {
  if (isProductionRuntime()) return false;
  if (!env.SMOKE_TEST_TOKEN) return false;
  const incoming = (smokeTokenHeader || "").trim();
  return incoming.length > 0 && incoming === env.SMOKE_TEST_TOKEN;
}

async function parseProviderErrorDetails(
  res: Response,
): Promise<{ errorCode?: number | string; errorMessage?: string }> {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as Record<string, unknown>;
      const rawCode = json.code;
      const rawMessage = json.message;
      const errorCode =
        typeof rawCode === "number" || typeof rawCode === "string"
          ? (rawCode as number | string)
          : undefined;
      const errorMessage = typeof rawMessage === "string" ? rawMessage : undefined;
      return { errorCode, errorMessage };
    }

    const text = await res.text();
    return {
      errorMessage: typeof text === "string" && text.length > 0 ? text.slice(0, 300) : undefined,
    };
  } catch {
    return {};
  }
}

async function twilioVerifyPost(
  resource: "Verifications" | "VerificationCheck",
  bodyParams: Record<string, string | undefined>,
  options: VerifyRequestOptions = {},
): Promise<VerifyPostResult> {
  if (!isVerifyConfigured()) {
    return {
      ok: false,
      providerError: normalizeProviderError(undefined, {
        errorMessage: "Twilio Verify is not configured",
      }),
    };
  }

  const accountSid = env.TWILIO_ACCOUNT_SID as string;
  const authToken = env.TWILIO_AUTH_TOKEN as string;
  const verifyServiceSid = env.TWILIO_VERIFY_SERVICE_SID as string;
  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(verifyServiceSid)}/${resource}`;
  const authorization = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs as number) > 0
      ? (options.timeoutMs as number)
      : 6000;
  const maxRetries =
    Number.isFinite(options.maxRetries) && (options.maxRetries as number) >= 0
      ? (options.maxRetries as number)
      : 2;
  const baseDelayMs =
    Number.isFinite(options.baseDelayMs) && (options.baseDelayMs as number) >= 0
      ? (options.baseDelayMs as number)
      : 300;

  let attempt = 0;
  let lastProviderError: SmsProviderError | undefined;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: toUrlEncoded(bodyParams),
        signal: controller.signal,
      });

      if (res.ok) {
        let data: TwilioVerifyResponse = {};
        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = (await res.json()) as TwilioVerifyResponse;
          }
        } catch {
          data = {};
        }
        return { ok: true, status: res.status, data };
      }

      const details = await parseProviderErrorDetails(res);
      const providerError = normalizeProviderError(res.status, details);
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, providerError };
      }

      lastProviderError = providerError;
    } catch {
      lastProviderError = normalizeProviderError(undefined, {
        errorMessage: "Twilio Verify request failed",
      });
    } finally {
      clearTimeout(timer);
    }

    attempt += 1;
    if (attempt > maxRetries) break;

    const backoff = baseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * (baseDelayMs / 2));
    await sleep(backoff + jitter);
  }

  return {
    ok: false,
    providerError:
      lastProviderError ||
      normalizeProviderError(undefined, {
        errorMessage: "Twilio Verify request failed after retries",
      }),
  };
}

function classifyProviderFailure(providerError: SmsProviderError): SmsVerificationFailureReason {
  const code = getNumericCode(providerError.errorCode);
  const message = (providerError.errorMessage || "").toLowerCase();

  if (providerError.status === 404) return "expired_or_invalid";
  if (code !== undefined && EXPIRED_OR_INVALID_ERROR_CODES.has(code)) return "expired_or_invalid";
  if (code !== undefined && INVALID_CODE_ERROR_CODES.has(code)) return "invalid_code";

  if (
    message.includes("expired") ||
    message.includes("not found") ||
    message.includes("max check attempts") ||
    message.includes("maximum check attempts") ||
    message.includes("too many check") ||
    message.includes("already canceled") ||
    message.includes("already cancelled")
  ) {
    return "expired_or_invalid";
  }

  if (
    message.includes("invalid code") ||
    message.includes("incorrect") ||
    message.includes("does not match") ||
    message.includes("mismatch") ||
    message.includes("wrong code")
  ) {
    return "invalid_code";
  }

  return "provider_error";
}

export async function startSmsVerification(
  phoneE164: string,
  options: VerifyRequestOptions = {},
): Promise<StartSmsVerificationResult> {
  const result = await twilioVerifyPost(
    "Verifications",
    {
      To: phoneE164,
      Channel: "sms",
      DeviceIp: options.deviceIp,
    },
    options,
  );

  if (!result.ok) {
    return {
      ok: false,
      providerError: result.providerError,
    };
  }

  return {
    ok: true,
    sid: asString(result.data.sid),
    status: asString(result.data.status),
  };
}

export async function checkSmsVerification(
  phoneE164: string,
  code: string,
  options: VerifyRequestOptions = {},
): Promise<CheckSmsVerificationResult> {
  const result = await twilioVerifyPost(
    "VerificationCheck",
    {
      To: phoneE164,
      Code: code,
      DeviceIp: options.deviceIp,
    },
    options,
  );

  if (!result.ok) {
    return {
      ok: false,
      reason: classifyProviderFailure(result.providerError),
      providerError: result.providerError,
    };
  }

  const status = asString(result.data.status);
  const valid = asBoolean(result.data.valid);
  const normalizedStatus = (status || "").toLowerCase();
  const isApproved = normalizedStatus === "approved" || valid === true;
  if (isApproved) {
    return {
      ok: true,
      sid: asString(result.data.sid),
      status,
      valid,
    };
  }

  const reason = EXPIRED_OR_INVALID_STATUS.has(normalizedStatus)
    ? "expired_or_invalid"
    : "invalid_code";
  return {
    ok: false,
    sid: asString(result.data.sid),
    status,
    valid,
    reason,
  };
}

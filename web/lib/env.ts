import { z } from "zod";

// Guard against accidental client bundling of this module
if (typeof window !== "undefined") {
  throw new Error("env.ts must not be imported on the client");
}

const ethAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x-prefixed Ethereum address");

const envSchema = z.object({
  // Vercel KV / Upstash Redis
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),

  // Secrets and provider keys (server-only)
  MINTER_PRIVATE_KEY: z.string().min(1).optional(),
  SMS_PROVIDER_API_KEY: z.string().optional(), // legacy/generic
  // Legacy sender ID env (deprecated for OTP Verify flow): 1-11 chars,
  // must have at least one letter, only letters/digits/spaces allowed.
  SMS_SENDER_ID: z
    .string()
    .refine((val) => {
      if (!val) return true; // optional
      // If it starts with + it's a phone number, skip alphanumeric validation
      if (val.startsWith("+")) return true;
      // Alphanumeric: max 11 chars, at least one letter, only [A-Za-z0-9 ]
      return val.length <= 11 && /[A-Za-z]/.test(val) && /^[A-Za-z0-9 ]+$/.test(val);
    }, "Alphanumeric sender ID must be 1-11 characters, contain at least one letter, and only use letters, digits, or spaces")
    .optional(), // generic sender id/from

  // Twilio Verify (preferred OTP path)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  // Legacy Twilio Messaging env (deprecated for OTP Verify flow)
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // On-chain Mint (Base Sepolia)
  MINTPASSV1_ADDRESS_BASE_SEPOLIA: ethAddress.optional(),
  BASE_SEPOLIA_RPC_URL: z.string().url().optional(),

  // Preview-only smoke test helper
  SMOKE_TEST_TOKEN: z.string().optional(),
  // Keyed hashing pepper for identifiers (HMAC key)
  HASH_PEPPER: z.string().optional(),

  // Admin credentials (server-only)
  ADMIN_PASSWORD: z.string().min(12, "Admin password must be at least 12 characters").optional(),
  ADMIN_SESSION_SECRET: z
    .string()
    .min(32, "Admin session secret must be at least 32 characters")
    .optional(),
  ADMIN_SESSION_MAX_LIFETIME_SECONDS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env as Record<string, string>);

if (!parsed.success) {
  // Do not crash builds in early scaffolding if envs are missing; warn instead
  // Runtime handlers will validate critical vars per-route.
  console.warn(
    "[env] Missing or invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
}

export const env = {
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  MINTER_PRIVATE_KEY: process.env.MINTER_PRIVATE_KEY,
  SMS_PROVIDER_API_KEY: process.env.SMS_PROVIDER_API_KEY,
  SMS_SENDER_ID: process.env.SMS_SENDER_ID,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
  TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
  MINTPASSV1_ADDRESS_BASE_SEPOLIA: process.env.MINTPASSV1_ADDRESS_BASE_SEPOLIA,
  BASE_SEPOLIA_RPC_URL: process.env.BASE_SEPOLIA_RPC_URL,
  SMOKE_TEST_TOKEN: process.env.SMOKE_TEST_TOKEN,
  HASH_PEPPER: process.env.HASH_PEPPER,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  ADMIN_SESSION_MAX_LIFETIME_SECONDS: process.env.ADMIN_SESSION_MAX_LIFETIME_SECONDS,
};

// Server-only accessors for secrets - use validated schema values
export function getAdminPassword(): string | undefined {
  return env.ADMIN_PASSWORD;
}

export function getAdminSessionSecret(): string | undefined {
  return env.ADMIN_SESSION_SECRET;
}

export function getAdminSessionMaxLifetimeSeconds(): number {
  const raw = env.ADMIN_SESSION_MAX_LIFETIME_SECONDS;
  const n = raw ? Number(raw) : NaN;
  // Default to 8 hours if unset or invalid
  if (!Number.isFinite(n) || n <= 0) return 8 * 60 * 60;
  // Cap to 24 hours
  return Math.min(n, 24 * 60 * 60);
}

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === null || (typeof value === "string" && value.length === 0)) {
    throw new Error(`Missing required env: ${String(key)}`);
  }
  return value as NonNullable<(typeof env)[K]>;
}

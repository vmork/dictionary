import { betterAuth } from "better-auth"
import { Pool } from "pg"

const globalForAuth = globalThis as typeof globalThis & {
  dictionaryAuthPool?: Pool
}

function getAuthPool() {
  if (!globalForAuth.dictionaryAuthPool) {
    globalForAuth.dictionaryAuthPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.AUTH_DATABASE_POOL_SIZE ?? 5),
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return globalForAuth.dictionaryAuthPool
}

export async function closeAuthPool() {
  if (!globalForAuth.dictionaryAuthPool) return
  await globalForAuth.dictionaryAuthPool.end()
  delete globalForAuth.dictionaryAuthPool
}

const isBuildStep = process.env.npm_lifecycle_event === "build"
const baseURL = process.env.BETTER_AUTH_URL ?? (isBuildStep ? "http://localhost:3000" : undefined)
const secret =
  process.env.BETTER_AUTH_SECRET ??
  (isBuildStep ? "build-only-placeholder-secret-not-used-at-runtime" : undefined)

export const auth = betterAuth({
  appName: "Dictionary",
  baseURL,
  secret,
  database: getAuthPool(),
  trustedOrigins: [baseURL, "http://localhost:3000"].filter((origin): origin is string => Boolean(origin)),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    modelName: "auth_users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "auth_sessions",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "auth_accounts",
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "auth_verifications",
    storeIdentifier: "hashed",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "auth_rate_limits",
    fields: {
      lastRequest: "last_request",
    },
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  advanced: {
    cookiePrefix: "dictionary",
    useSecureCookies:
      process.env.NODE_ENV === "production" && process.env.BETTER_AUTH_SECURE_COOKIES !== "false",
  },
})

export type AuthSession = typeof auth.$Infer.Session

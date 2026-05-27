import { pbkdf2Sync, randomBytes, createHmac, timingSafeEqual } from "crypto";

/**
 * PBKDF2 configuration — OWASP 2024 recommends 600,000 iterations minimum for SHA-512.
 * Previous value of 10,000 is orders of magnitude too weak for bank-grade security.
 *
 * NOTE: New hashes use the upgraded iteration count. Legacy hashes (stored with fewer
 * iterations) are still verifiable via the iteration count prefix in the stored format.
 */
const CURRENT_ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 10_000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

/**
 * Hash format versions:
 *   v1 (legacy):  `salt:hash`          — uses LEGACY_ITERATIONS
 *   v2 (current): `v2:salt:hash`       — uses CURRENT_ITERATIONS
 */

/**
 * Hashes a plaintext password using PBKDF2 with SHA-512 and a random 16-byte salt.
 * Returns the hash in the versioned format `v2:salt:hash`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, CURRENT_ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `v2:${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored hash.
 *
 * Supports both v2 format (`v2:salt:hash` with 600K iterations)
 * and legacy v1 format (`salt:hash` with 10K iterations).
 *
 * All comparisons use timing-safe equality to prevent timing attacks.
 * Plaintext password storage is NOT supported.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("v2:")) {
    // Current format: v2:salt:hash
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const storedHash = parts[2];
    const candidateHash = pbkdf2Sync(password, salt, CURRENT_ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
    return safeCompareHex(storedHash, candidateHash);
  }

  // Legacy format: salt:hash (10K iterations) — still verifiable for backward compatibility
  if (stored.includes(":")) {
    const [salt, storedHash] = stored.split(":");
    const candidateHash = pbkdf2Sync(password, salt, LEGACY_ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
    return safeCompareHex(storedHash, candidateHash);
  }

  // Plaintext passwords are no longer accepted — reject immediately
  return false;
}

/**
 * Returns true if the password was hashed with the legacy (weaker) algorithm
 * and should be re-hashed on the next successful login.
 */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith("v2:");
}

/**
 * Timing-safe comparison of two hex-encoded hash strings.
 */
function safeCompareHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Signs a payload as a HS256 JWT using native Node.js crypto.
 * The `secret` parameter MUST be sourced from `AppConfig.jwtSecret`.
 * Default expiration is 1 hour (3600 seconds).
 */
export function signJwt(
  payload: Record<string, any>,
  secret?: string,
  expiresInSeconds: number = 3600
): string {
  const signingSecret = secret ?? resolveJwtSecretFallback();
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  
  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadEncoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac("sha256", signingSecret).update(signatureInput).digest();
  const signatureEncoded = signature.toString("base64url");
  
  return `${signatureInput}.${signatureEncoded}`;
}

/**
 * Verifies a HS256 JWT using native Node.js crypto and returns the decoded payload.
 * Returns null if the token is invalid, tampered, or expired.
 * The `secret` parameter MUST be sourced from `AppConfig.jwtSecret`.
 */
export function verifyJwt<T extends Record<string, any>>(
  token: string,
  secret?: string
): T | null {
  try {
    const signingSecret = secret ?? resolveJwtSecretFallback();
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    
    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    
    const expectedSignature = createHmac("sha256", signingSecret).update(signatureInput).digest();
    const actualSignature = Buffer.from(signatureEncoded, "base64url");
    
    if (expectedSignature.length !== actualSignature.length) {
      return null;
    }
    
    if (!timingSafeEqual(expectedSignature, actualSignature)) {
      return null;
    }
    
    const payloadStr = Buffer.from(payloadEncoded, "base64url").toString("utf8");
    const payload = JSON.parse(payloadStr);
    
    if (payload && typeof payload === "object" && typeof payload.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        return null; // Expired
      }
    }
    
    return payload as T;
  } catch (error) {
    return null;
  }
}

/**
 * Fallback JWT secret resolution for call sites that don't yet pass the config secret.
 * Reads from process.env directly. In production, loadConfig() should be used instead.
 */
function resolveJwtSecretFallback(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return "cmsv01-dev-only-jwt-secret-do-not-use-in-prod";
}

import { pbkdf2Sync, randomBytes, createHmac, timingSafeEqual } from "crypto";

const ITERATIONS = 10000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

const JWT_SECRET = process.env.JWT_SECRET || "cmsv01-payouts-dev-secret-key-super-secure";

/**
 * Hashes a plaintext password using PBKDF2 with SHA-512 and a random salt.
 * Returns the hash in the format `salt:hash`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored hash.
 * If the stored value is not a formatted hash (legacy plain text),
 * it performs a plaintext comparison as a secure backward-compatible fallback.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.includes(":")) {
    return password === stored;
  }
  const [salt, hash] = stored.split(":");
  const verifyHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return hash === verifyHash;
}

/**
 * Signs a payload as a HS256 JWT using native Node.js crypto.
 * Default expiration is 8 hours (28800 seconds).
 */
export function signJwt(payload: Record<string, any>, expiresInSeconds: number = 28800): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  
  const header = { alg: "HS256", typ: "JWT" };
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadEncoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac("sha256", JWT_SECRET).update(signatureInput).digest();
  const signatureEncoded = signature.toString("base64url");
  
  return `${signatureInput}.${signatureEncoded}`;
}

/**
 * Verifies a HS256 JWT using native Node.js crypto and returns the decoded payload.
 * Returns null if the token is invalid, tampered, or expired.
 */
export function verifyJwt<T extends Record<string, any>>(token: string): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    
    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    
    const expectedSignature = createHmac("sha256", JWT_SECRET).update(signatureInput).digest();
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


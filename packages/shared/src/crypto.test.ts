import { hashPassword, verifyPassword, signJwt, verifyJwt } from "./crypto.js";
import assert from "assert";

console.log("Starting unit tests for crypto module...");

// Test 1: Generate hash and verify
const password = "mySecurePassword99!";
const hash = hashPassword(password);

assert.ok(hash !== password, "Hashed password must not equal the original plaintext");
assert.ok(hash.includes(":"), "Hashed password should include salt and digest separated by a colon");

// Verify correct password succeeds
assert.ok(verifyPassword(password, hash), "Correct password verification must succeed");

// Verify incorrect password fails
assert.ok(!verifyPassword("wrongPassword!", hash), "Incorrect password verification must fail");

// Test 2: Verify legacy/plaintext backward compatibility fallback
// A stored password that doesn't contain ":" is treated as a plaintext legacy password.
const legacyPassword = "myPlaintextLegacyPassword";
assert.ok(verifyPassword(legacyPassword, legacyPassword), "Legacy plaintext password must match exactly");
assert.ok(!verifyPassword("otherPlaintextPassword", legacyPassword), "Mismatched legacy plaintext password must fail");

// Test 3: JWT signing and verification
console.log("Running JWT unit tests...");
const payload = { userId: "user-123", role: "maker", corporateTenantId: "tenant-abc" };
const token = signJwt(payload);

assert.ok(typeof token === "string", "Token must be a string");
assert.ok(token.split(".").length === 3, "Token must have three parts separated by dots");

// Test 4: Verify valid token
const verified = verifyJwt<typeof payload & { exp: number }>(token);
assert.ok(verified !== null, "Verified payload should not be null");
assert.equal(verified?.userId, payload.userId, "Verified userId should match original");
assert.equal(verified?.role, payload.role, "Verified role should match original");
assert.equal(verified?.corporateTenantId, payload.corporateTenantId, "Verified tenant ID should match original");
assert.ok(typeof verified?.exp === "number", "Verified payload must include exp timestamp");

// Test 5: Verify tampered token fails
const [header, body, sig] = token.split(".");
const tamperedBody = Buffer.from(
  JSON.stringify({ ...payload, role: "checker" })
).toString("base64url");
const tamperedToken = `${header}.${tamperedBody}.${sig}`;
const verifiedTampered = verifyJwt(tamperedToken);
assert.equal(verifiedTampered, null, "Tampered token verification must return null");

// Test 6: Verify invalid signature fails
const tamperedSigToken = `${header}.${body}.invalidSignatureHere`;
const verifiedTamperedSig = verifyJwt(tamperedSigToken);
assert.equal(verifiedTamperedSig, null, "Token with invalid signature must return null");

// Test 7: Verify expired token fails
const expiredToken = signJwt(payload, -10); // 10 seconds in the past
const verifiedExpired = verifyJwt(expiredToken);
assert.equal(verifiedExpired, null, "Expired token verification must return null");

console.log("All unit tests passed successfully!");


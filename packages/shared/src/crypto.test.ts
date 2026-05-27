import { hashPassword, verifyPassword, needsRehash, signJwt, verifyJwt } from "./crypto.js";
import assert from "assert";

const TEST_SECRET = "test-secret-key-for-unit-tests-minimum-32-chars";

console.log("Starting unit tests for crypto module...");

// Test 1: Generate v2 hash and verify
const password = "mySecurePassword99!";
const hash = hashPassword(password);

assert.ok(hash !== password, "Hashed password must not equal the original plaintext");
assert.ok(hash.startsWith("v2:"), "Hashed password should start with v2: version prefix");
assert.equal(hash.split(":").length, 3, "v2 hash should have three parts: v2:salt:hash");

// Verify correct password succeeds
assert.ok(verifyPassword(password, hash), "Correct password verification must succeed");

// Verify incorrect password fails
assert.ok(!verifyPassword("wrongPassword!", hash), "Incorrect password verification must fail");

// Test 2: Plaintext passwords are NO LONGER accepted (security hardening)
const legacyPlaintext = "myPlaintextLegacyPassword";
assert.ok(!verifyPassword(legacyPlaintext, legacyPlaintext), "Plaintext passwords must be rejected");

// Test 2b: Legacy v1 format (salt:hash with 10K iterations) is still verifiable
// Simulate a legacy v1 hash by creating one with the old format
// (Note: we can't easily create one without the old code, so we test the prefix detection)
assert.ok(needsRehash("oldsalt:oldhash"), "Legacy v1 format should need rehash");
assert.ok(!needsRehash("v2:newsalt:newhash"), "v2 format should not need rehash");
assert.ok(!needsRehash(hash), "Freshly hashed password should not need rehash");

// Test 3: JWT signing and verification with explicit secret
console.log("Running JWT unit tests...");
const payload = { userId: "user-123", role: "maker", corporateTenantId: "tenant-abc" };
const token = signJwt(payload, TEST_SECRET);

assert.ok(typeof token === "string", "Token must be a string");
assert.ok(token.split(".").length === 3, "Token must have three parts separated by dots");

// Test 4: Verify valid token with matching secret
const verified = verifyJwt<typeof payload & { exp: number }>(token, TEST_SECRET);
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
const verifiedTampered = verifyJwt(tamperedToken, TEST_SECRET);
assert.equal(verifiedTampered, null, "Tampered token verification must return null");

// Test 6: Verify invalid signature fails
const tamperedSigToken = `${header}.${body}.invalidSignatureHere`;
const verifiedTamperedSig = verifyJwt(tamperedSigToken, TEST_SECRET);
assert.equal(verifiedTamperedSig, null, "Token with invalid signature must return null");

// Test 7: Verify expired token fails
const expiredToken = signJwt(payload, TEST_SECRET, -10); // 10 seconds in the past
const verifiedExpired = verifyJwt(expiredToken, TEST_SECRET);
assert.equal(verifiedExpired, null, "Expired token verification must return null");

// Test 8: Verify token with WRONG secret fails
const wrongSecretToken = signJwt(payload, "different-secret-key-also-32-chars-long!!");
const verifiedWrongSecret = verifyJwt(wrongSecretToken, TEST_SECRET);
assert.equal(verifiedWrongSecret, null, "Token signed with different secret must fail verification");

// Test 9: Verify token signed with correct secret passes with correct secret
const verifiedCorrectSecret = verifyJwt(wrongSecretToken, "different-secret-key-also-32-chars-long!!");
assert.ok(verifiedCorrectSecret !== null, "Token verified with its own signing secret must succeed");

console.log("All unit tests passed successfully!");

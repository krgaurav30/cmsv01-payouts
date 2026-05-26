import { Decimal } from "./decimal.js";
import assert from "assert";

function runTests() {
  console.log("--- Starting Decimal Unit Tests ---\n");

  // 1. Parsing Edge Cases
  console.log("1. Testing Parsing...");
  assert.strictEqual(Decimal.fromString("123.45").toString(), "123.45");
  assert.strictEqual(Decimal.fromString("123").toString(), "123.00");
  assert.strictEqual(Decimal.fromString("123.").toString(), "123.00");
  assert.strictEqual(Decimal.fromString(".45").toString(), "0.45");
  assert.strictEqual(Decimal.fromString("  10.50  ").toString(), "10.50");
  assert.strictEqual(Decimal.fromString("").toString(), "0.00");
  assert.strictEqual(Decimal.fromString("   ").toString(), "0.00");

  // 2. Rounding
  console.log("2. Testing Rounding...");
  assert.strictEqual(Decimal.fromString("123.456").toString(), "123.46"); // round up
  assert.strictEqual(Decimal.fromString("123.454").toString(), "123.45"); // round down
  assert.strictEqual(Decimal.fromString("123.455").toString(), "123.46"); // round exact half up
  assert.strictEqual(Decimal.fromString("0.005").toString(), "0.01"); // round exact half up
  assert.strictEqual(Decimal.fromString("0.004").toString(), "0.00"); // round down

  // 3. Negative Parsing
  console.log("3. Testing Negative Parsing...");
  assert.strictEqual(Decimal.fromString("-123.45").toString(), "-123.45");
  assert.strictEqual(Decimal.fromString("-0.45").toString(), "-0.45");
  assert.strictEqual(Decimal.fromString("-123").toString(), "-123.00");
  assert.strictEqual(Decimal.fromString("-0.005").toString(), "-0.01");

  // 4. Arithmetic (Preventing IEEE 754 Float Bugs)
  console.log("4. Testing Float Error Prevention...");
  // 0.1 + 0.2
  const d1 = Decimal.fromString("0.10");
  const d2 = Decimal.fromString("0.20");
  const d3 = d1.add(d2);
  assert.strictEqual(d3.toString(), "0.30");
  assert.strictEqual(d3.toNumber(), 0.3);

  // Subtraction
  const subRes = Decimal.fromString("0.30").sub(Decimal.fromString("0.20"));
  assert.strictEqual(subRes.toString(), "0.10");

  // Multiplication with rounding
  // 10.25 * 1.5 = 15.375 -> rounded to 15.38
  const mulRes = Decimal.fromString("10.25").mul(Decimal.fromString("1.50"));
  assert.strictEqual(mulRes.toString(), "15.38");

  // 5. Comparisons
  console.log("5. Testing Comparisons...");
  const a = Decimal.fromString("100.50");
  const b = Decimal.fromString("100.50");
  const c = Decimal.fromString("100.51");
  const d = Decimal.fromString("99.99");

  assert.ok(a.equals(b));
  assert.ok(!a.equals(c));
  assert.ok(c.greaterThan(a));
  assert.ok(d.lessThan(a));
  assert.ok(a.greaterThanOrEqual(b));
  assert.ok(a.lessThanOrEqual(b));
  assert.ok(c.greaterThanOrEqual(a));

  // 6. Number Conversions
  console.log("6. Testing Number Conversions...");
  assert.strictEqual(Decimal.fromNumber(100.5).toString(), "100.50");
  assert.strictEqual(Decimal.fromNumber(0.1 + 0.2).toString(), "0.30"); // should clean float error

  console.log("\nAll Decimal Unit Tests Passed Successfully!");
}

try {
  runTests();
} catch (err) {
  console.error("Test failed with error:", err);
  process.exit(1);
}

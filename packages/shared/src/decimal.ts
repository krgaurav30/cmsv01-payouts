export class Decimal {
  private readonly cents: bigint;

  private constructor(cents: bigint) {
    this.cents = cents;
  }

  static fromCents(cents: bigint): Decimal {
    return new Decimal(cents);
  }

  static fromString(val: string): Decimal {
    const trimmed = val.trim();
    if (!trimmed) {
      return new Decimal(0n);
    }

    // Check sign
    const isNegative = trimmed.startsWith("-");
    const absVal = isNegative ? trimmed.slice(1) : trimmed;

    const parts = absVal.split(".");
    if (parts.length > 2) {
      throw new Error(`Invalid decimal format: ${val}`);
    }

    const wholeStr = parts[0] || "0";
    let fracStr = parts[1] || "";

    // Parse whole part (should only contain digits)
    if (!/^\d+$/.test(wholeStr)) {
      throw new Error(`Invalid decimal format whole part: ${val}`);
    }
    const whole = BigInt(wholeStr);

    // Parse fractional part to exactly 2 digits (paise/cents)
    if (fracStr.length > 2) {
      // Round to nearest: if 3rd digit is >= 5, add 1 to the 2-digit representation
      const firstTwo = fracStr.slice(0, 2);
      const third = fracStr[2];
      
      if (!/^\d+$/.test(fracStr)) {
        throw new Error(`Invalid decimal format fractional part: ${val}`);
      }

      let valCents = BigInt(firstTwo);
      if (parseInt(third, 10) >= 5) {
        valCents += 1n;
      }
      fracStr = valCents.toString().padStart(2, "0");
    } else {
      if (fracStr && !/^\d+$/.test(fracStr)) {
        throw new Error(`Invalid decimal format fractional part: ${val}`);
      }
      fracStr = fracStr.padEnd(2, "0");
    }

    const frac = BigInt(fracStr);
    const finalCents = whole * 100n + frac;

    return new Decimal(isNegative ? -finalCents : finalCents);
  }

  static fromNumber(val: number): Decimal {
    if (isNaN(val) || !isFinite(val)) {
      throw new Error(`Invalid number: ${val}`);
    }
    // toFixed(2) keeps exactly two decimal places, then we parse it via string parser
    return Decimal.fromString(val.toFixed(2));
  }

  add(other: Decimal): Decimal {
    return new Decimal(this.cents + other.cents);
  }

  sub(other: Decimal): Decimal {
    return new Decimal(this.cents - other.cents);
  }

  mul(other: Decimal): Decimal {
    const product = this.cents * other.cents;
    const sign = product < 0n ? -1n : 1n;
    const absProduct = product < 0n ? -product : product;
    // Round to nearest cents after multiplication
    const remainder = absProduct % 100n;
    let quotient = absProduct / 100n;
    if (remainder >= 50n) {
      quotient += 1n;
    }
    return new Decimal(sign * quotient);
  }

  equals(other: Decimal): boolean {
    return this.cents === other.cents;
  }

  greaterThan(other: Decimal): boolean {
    return this.cents > other.cents;
  }

  lessThan(other: Decimal): boolean {
    return this.cents < other.cents;
  }

  greaterThanOrEqual(other: Decimal): boolean {
    return this.cents >= other.cents;
  }

  lessThanOrEqual(other: Decimal): boolean {
    return this.cents <= other.cents;
  }

  toNumber(): number {
    return Number(this.cents) / 100;
  }

  toString(): string {
    const isNegative = this.cents < 0n;
    const absCents = isNegative ? -this.cents : this.cents;
    const whole = absCents / 100n;
    const frac = absCents % 100n;
    const fracStr = frac.toString().padStart(2, "0");
    return `${isNegative ? "-" : ""}${whole}.${fracStr}`;
  }

  toCents(): bigint {
    return this.cents;
  }
}

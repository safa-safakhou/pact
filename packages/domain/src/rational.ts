export interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function rational(numerator: bigint, denominator: bigint = 1n): Rational {
  if (denominator === 0n) throw new Error("RATIONAL_ZERO_DENOMINATOR");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return { numerator: (numerator / divisor) * sign, denominator: (denominator / divisor) * sign };
}

export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiplyRational(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

export function compareRational(left: Rational, right: Rational): -1 | 0 | 1 {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function floorRational(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  const remainder = value.numerator % value.denominator;
  return remainder < 0n ? quotient - 1n : quotient;
}

export function ceilRational(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  const remainder = value.numerator % value.denominator;
  return remainder > 0n ? quotient + 1n : quotient;
}

export function serializeRational(value: Rational): { numerator: string; denominator: string } {
  return { numerator: value.numerator.toString(), denominator: value.denominator.toString() };
}

export function parseRational(input: unknown): Rational {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("INVALID_RATIONAL");
  const record = input as Record<string, unknown>;
  if (typeof record.numerator !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(record.numerator)) {
    throw new Error("INVALID_RATIONAL");
  }
  if (typeof record.denominator !== "string" || !/^[1-9][0-9]*$/.test(record.denominator)) {
    throw new Error("INVALID_RATIONAL");
  }
  return rational(BigInt(record.numerator), BigInt(record.denominator));
}

export function compareUuidBytes(left: string, right: string): -1 | 0 | 1 {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!pattern.test(left) || !pattern.test(right)) throw new Error("INVALID_UUID");
  const a = left.replaceAll("-", "").toLowerCase();
  const b = right.replaceAll("-", "").toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

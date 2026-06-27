const SCALE = 100000000n;

export function multiplyDecimalStrings(left: string, right: string): string {
  return formatDecimal((parseDecimal(left) * parseDecimal(right)) / SCALE);
}

export function parseDecimal(value: string): bigint {
  const [integerPart, fractionPart = ""] = value.split(".");
  return BigInt(integerPart) * SCALE + BigInt(fractionPart.padEnd(8, "0").slice(0, 8));
}

export function formatDecimal(value: bigint): string {
  const integerPart = value / SCALE;
  const fractionPart = (value % SCALE).toString().padStart(8, "0");
  return `${integerPart}.${fractionPart}`;
}

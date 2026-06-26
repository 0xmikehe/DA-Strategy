const SCALE = 1000000000000n;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function addDecimalStrings(left: string, right: string): string {
  return formatDecimal(parseDecimal(left) + parseDecimal(right));
}

export function subtractDecimalStrings(left: string, right: string): string {
  return formatDecimal(parseDecimal(left) - parseDecimal(right));
}

export function absDecimalString(value: string): string {
  const parsed = parseDecimal(value);
  return formatDecimal(parsed < 0n ? -parsed : parsed);
}

export function compareDecimalStrings(left: string, right: string): -1 | 0 | 1 {
  const leftParsed = parseDecimal(left);
  const rightParsed = parseDecimal(right);

  if (leftParsed < rightParsed) {
    return -1;
  }
  if (leftParsed > rightParsed) {
    return 1;
  }
  return 0;
}

export function parseDecimal(value: unknown): bigint {
  if (typeof value === "number") {
    throw new Error("DECIMAL_NUMBER_NOT_ALLOWED");
  }
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new Error("DECIMAL_STRING_INVALID");
  }

  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^-/, "");
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(12, "0").slice(0, 12);

  return sign * (BigInt(integerPart) * SCALE + BigInt(paddedFraction));
}

export function formatDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const integerPart = absolute / SCALE;
  const fractionPart = (absolute % SCALE).toString().padStart(12, "0").replace(/0+$/, "");

  return `${sign}${integerPart}${fractionPart ? `.${fractionPart}` : ".00000000"}`;
}

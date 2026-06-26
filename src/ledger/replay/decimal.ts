const SCALE = 100000000n;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function addDecimal(left: string, right: string): string {
  return formatDecimal(parseDecimal(left) + parseDecimal(right));
}

export function subtractDecimal(left: string, right: string): string {
  return formatDecimal(parseDecimal(left) - parseDecimal(right));
}

export function negateDecimal(value: string): string {
  return formatDecimal(-parseDecimal(value));
}

export function parseDecimal(value: unknown): bigint {
  if (typeof value === "number") {
    throw new Error("REPLAY_DECIMAL_NUMBER_NOT_ALLOWED");
  }
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    throw new Error("REPLAY_DECIMAL_STRING_INVALID");
  }

  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^-/, "");
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(8, "0").slice(0, 8);

  return sign * (BigInt(integerPart) * SCALE + BigInt(paddedFraction));
}

export function formatDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const integerPart = absolute / SCALE;
  const fractionPart = (absolute % SCALE).toString().padStart(8, "0");

  return `${sign}${integerPart}.${fractionPart}`;
}

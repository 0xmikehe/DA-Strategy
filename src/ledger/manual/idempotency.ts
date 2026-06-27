export function manualExternalTradeIdempotencyKey(requestId: string): string {
  return `manual_external_trade:${requestId}`;
}

export function manualAttributionIdempotencyKey(targetKind: string, targetKey: string, requestId: string): string {
  return `manual_attribution:${targetKind}:${targetKey}:${requestId}`;
}

export function manualReversalIdempotencyKey(targetKind: string, targetKey: string, requestId: string): string {
  return `manual_reversal:${targetKind}:${targetKey}:${requestId}`;
}

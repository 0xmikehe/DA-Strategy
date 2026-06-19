export type HealthStatus = {
  status: "ok";
  service: "digital-asset-ops";
  phase: "phase1-p0";
  timestamp: string;
};

type HealthStatusOptions = {
  now?: Date;
};

export function getHealthStatus(options: HealthStatusOptions = {}): HealthStatus {
  const now = options.now ?? new Date();

  return {
    status: "ok",
    service: "digital-asset-ops",
    phase: "phase1-p0",
    timestamp: now.toISOString()
  };
}

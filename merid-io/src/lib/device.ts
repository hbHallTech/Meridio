import { headers } from "next/headers";

export interface DeviceInfo {
  [key: string]: string;
  ip: string;
  userAgent: string;
  lastSeen: string;
}

/**
 * Extract device info (IP + User-Agent) from the current request headers.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const userAgent = headersList.get("user-agent") ?? "unknown";

  return {
    ip,
    userAgent,
    lastSeen: new Date().toISOString(),
  };
}

/**
 * Compare current device info with stored device info.
 * Returns true if the device is different (new device detected).
 */
export function isNewDevice(
  current: DeviceInfo,
  stored: DeviceInfo | null
): boolean {
  if (!stored) return false; // First login — no alert needed
  return current.ip !== stored.ip || current.userAgent !== stored.userAgent;
}

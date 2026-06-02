import { headers } from "next/headers";
import { getTrustedClientIp } from "@/lib/security/request-client";

export async function getActionClientKey() {
  const headerStore = await headers();
  return getTrustedClientIp(headerStore);
}

import { headers } from "next/headers";

export async function getActionClientKey() {
  const headerStore = await headers();
  return (
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  );
}

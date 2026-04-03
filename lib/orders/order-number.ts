import { randomUUID } from "node:crypto";

function getDatePart(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// Order numbers use random UUIDs (not sequential counters), making them
// unguessable. This is intentional — sequential numbers (ORD-001, ORD-002)
// would let attackers enumerate orders via the customer portal lookup.
export function createOrderNumber(prefix = "ORD") {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${prefix}-${getDatePart(new Date())}-${suffix}`;
}

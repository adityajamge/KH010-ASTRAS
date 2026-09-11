export function fmtQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** "06:00:00" -> "06:00". */
export function fmtTime(t: string): string {
  return t.slice(0, 5);
}

/** "under_delivery" -> "Under Delivery". */
export function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

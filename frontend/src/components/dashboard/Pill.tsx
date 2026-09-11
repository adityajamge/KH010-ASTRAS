type PillTone = "neutral" | "success" | "warn" | "danger" | "primary";

const STATUS_TONE: Record<string, PillTone> = {
  complete: "success",
  completed: "success",
  normal: "success",
  accepted: "success",
  scheduled: "primary",
  proposed: "primary",
  pending: "neutral",
  processing: "neutral",
  negotiation: "warn",
  "under-delivery": "warn",
  "under delivery": "warn",
  "minor difference": "warn",
  "investigation required": "danger",
  "needs investigation": "danger",
  disputed: "danger",
  cancelled: "danger",
  deviation: "danger",
};

/** Status badge. Pass a tone explicitly, or a known status string to infer one. */
export function Pill({ children, tone }: { children: string; tone?: PillTone }) {
  const resolved = tone ?? STATUS_TONE[children.toLowerCase()] ?? "neutral";
  return <span className={`pill pill-${resolved}`}>{children}</span>;
}

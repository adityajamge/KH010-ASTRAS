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

/** Infer a tone from a raw (untranslated) status string, e.g. before it's
 * passed through `t()` for display — translated text won't match this map. */
export function statusTone(status: string): PillTone {
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

/** Status badge. Pass a tone explicitly, or a known status string to infer one. */
export function Pill({ children, tone }: { children: string; tone?: PillTone }) {
  const resolved = tone ?? statusTone(children);
  return <span className={`pill pill-${resolved}`}>{children}</span>;
}

import type { TwinStatus } from "../../lib/api";

/** Color per twin_status — must stay in sync with the six states the
 * backend classifies (app/services/network_state.py::_twin_status). */
export const STATUS_COLOR: Record<TwinStatus, string> = {
  normal: "#2f8f5b",
  approved: "#3b7dd8",
  shortage: "#e0a52c",
  delivery_issue: "#c77b1f",
  pending_mediation: "#8b5fbf",
  conflict: "#d1453b",
};

export const STATUS_LABEL: Record<TwinStatus, string> = {
  normal: "Normal",
  approved: "Approved allocation",
  shortage: "Shortage",
  delivery_issue: "Delivery issue",
  pending_mediation: "Pending mediation",
  conflict: "Conflict",
};

export const FLOW_COLOR: Record<"low" | "normal" | "high", string> = {
  low: "#9fb8cf",
  normal: "#2f6fb0",
  high: "#1c4f86",
};

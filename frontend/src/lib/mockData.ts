/**
 * Sample data for the MVP dashboards, transcribed from
 * docs/Dashboards/PS14_Dashboard_Feature_Specification.md.
 * Static only — no backend wiring yet.
 */

export interface StatCardData {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
}

// ---------- Farmer (Farmer A / F001, section 3 + 6) ----------

export const farmerProfile = {
  farmerId: "F001",
  name: "Farmer A",
  village: "Rampur",
  fieldId: "FLD-014",
  landArea: "2.4 ha",
  crop: "Sugarcane",
  cropStage: "Tillering",
  canal: "C1",
  phone: "+91 ******1201",
  preferredPeriod: "Morning (06:00–10:00)",
};

export const farmerHomeStats: StatCardData[] = [
  { label: "Today's Allocation", value: "350 units" },
  { label: "Next Water Schedule", value: "06:00–08:00" },
  { label: "Requested Water", value: "400 units" },
  { label: "Allocated Water", value: "350 units" },
  { label: "Delivered Water", value: "280 units" },
  { label: "Current Status", value: "Under Delivery", tone: "warn" },
  { label: "Pending Negotiation", value: "1" },
];

export const farmerAllocation = {
  requested: 400,
  allocated: 350,
  date: "12 Sep 2026",
  startTime: "06:00",
  endTime: "08:00",
  canal: "C1",
  status: "Proposed",
  reason: "Limited available water",
};

export const farmerRequestStatus = {
  requested: 400,
  available: 1000,
  totalDemand: 1200,
  shortage: 200,
  status: "Conflict Detected",
};

export const farmerNegotiation = {
  requested: 400,
  proposal: 350,
  reason: "Limited available water and competing farmer requirements.",
  objectionOptions: [
    "Need more water",
    "Need different time",
    "Crop critical",
    "Emergency",
    "Other",
  ],
  counterProposal: {
    morning: 350,
    evening: 50,
    total: 400,
  },
};

export const farmerDeliveryMonitoring = {
  authorized: 400,
  delivered: 280,
  shortfall: 120,
  status: "Under-delivery detected",
};

export const farmerSchedule = [
  { date: "12 Sep 2026", time: "06:00–08:00", quantity: 350, canal: "C1", status: "Scheduled" },
  { date: "13 Sep 2026", time: "06:00–08:00", quantity: 350, canal: "C1", status: "Pending" },
  { date: "14 Sep 2026", time: "07:00–09:00", quantity: 300, canal: "C1", status: "Pending" },
];

export const farmerNotifications = [
  { title: "PS14 proposed 350 units for tomorrow's request", time: "10:39", kind: "info" as const },
  { title: "Under-delivery detected — 120 units short", time: "10:20", kind: "warn" as const },
  { title: "Rainfall update: 18mm recorded near your canal", time: "09:05", kind: "info" as const },
  { title: "Schedule confirmed for 12 Sep, 06:00–08:00", time: "08:41", kind: "info" as const },
];

// ---------- Jal Vigyani / Canal Authority (section 4) ----------

export const canalOverviewStats: StatCardData[] = [
  { label: "Current Canal Flow", value: "1000 units" },
  { label: "Water Level", value: "2.4 m" },
  { label: "Canal Capacity", value: "1200 units" },
  { label: "Capacity Utilization", value: "83%" },
  { label: "Number of Farmers", value: "48" },
  { label: "Active Conflicts", value: "3", tone: "warn" },
  { label: "Active Alerts", value: "5", tone: "warn" },
  { label: "Under-delivery Cases", value: "2", tone: "warn" },
  { label: "Water-loss Alerts", value: "1", tone: "danger" },
];

export const canalLiveMonitoring = {
  upstreamFlow: 1000,
  downstreamFlow: 720,
  authorizedOutflow: 700,
  unaccountedDifference: 20,
};

export const farmerAllocationTable = [
  { farmer: "A", requested: 400, allocated: 350, delivered: 350, shortfall: 0, status: "Complete" },
  { farmer: "B", requested: 400, allocated: 350, delivered: 280, shortfall: 70, status: "Under-delivery" },
  { farmer: "C", requested: 400, allocated: 300, delivered: 300, shortfall: 0, status: "Complete" },
];

export const conflicts = [
  {
    conflictId: "CNF-1042",
    farmers: "A, B, C",
    availableWater: 1000,
    totalDemand: 1200,
    shortage: 200,
    priority: "High",
    proposal: "A → 350, B → 350, C → 300",
    objections: "Farmer A: needs at least 400 units",
    status: "Negotiation",
  },
];

export const waterAnomaly = {
  id: "ANM-024",
  location: "Canal C1 / G2",
  expectedFlow: 700,
  measuredFlow: 680,
  difference: 20,
  status: "Investigation Required",
  possibleCauses: [
    "Leakage",
    "Seepage",
    "Unauthorized withdrawal",
    "Gate mismatch",
    "Sensor error",
  ],
};

export const underDelivery = {
  farmer: "Farmer B (F002)",
  authorized: 400,
  actual: 280,
  shortfall: 120,
  possibleCauses: ["Upstream shortage", "Gate problem", "Leakage", "Unauthorized withdrawal", "Sensor error"],
  status: "Investigation Required",
};

export const canalSchedule = [
  { slot: "06:00–08:00", farmer: "A", quantity: 350 },
  { slot: "08:00–10:00", farmer: "B", quantity: 300 },
  { slot: "10:00–12:00", farmer: "C", quantity: 350 },
];

// ---------- Dam Operator (section 5) ----------

export const damOverviewStats: StatCardData[] = [
  { label: "Reservoir Level", value: "118.4 m" },
  { label: "Storage Volume", value: "5,000 units" },
  { label: "Available Irrigation Water", value: "4,200 units" },
  { label: "Inflow", value: "850 units/day" },
  { label: "Outflow", value: "700 units/day" },
  { label: "Release Rate", value: "700 units/day" },
  { label: "Rainfall", value: "18 mm" },
  { label: "Dam Status", value: "Normal", tone: "ok" },
  { label: "Emergency Alerts", value: "0" },
];

export const rainfallMonitoring = {
  current: "2 mm/hr",
  last24h: "18 mm",
  forecast: "Medium — 12mm expected over next 24h",
  catchmentAffected: "Upper catchment, C1 basin",
};

export const canalReleases = [
  { canal: "C1", requested: 2000, approved: 1800, released: 1800, received: 1780, difference: 20, status: "Minor Difference" },
  { canal: "C2", requested: 2200, approved: 1800, released: 1800, received: 1800, difference: 0, status: "Normal" },
  { canal: "C3", requested: 2000, approved: 1400, released: 1400, received: 1380, difference: 20, status: "Minor Difference" },
];

import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  ActivityIcon,
  HomeIcon,
  NativeAppShell,
  UsersIcon,
  type NativeTab,
} from "./NativeAppShell";

// Dashboard, Conflicts, Farmers, Monitoring are the four most actionable
// screens (mediation decisions + canal assignment + ground evidence) — the
// rest goes in the More sheet, same reasoning as the farmer shell.
const TABS: NativeTab[] = [
  { key: "home", label: "Dashboard", to: "/app/jal-vigyani", end: true, icon: HomeIcon },
  { key: "conflicts", label: "Conflicts", to: "/app/jal-vigyani/conflicts", icon: AlertTriangleIcon },
  { key: "farmers", label: "Farmers", to: "/app/jal-vigyani/farmers", icon: UsersIcon },
  { key: "monitoring", label: "Monitoring", to: "/app/jal-vigyani/monitoring", icon: ActivityIcon },
];

const MORE_ITEMS = [
  { label: "Allocations", to: "/app/jal-vigyani/allocations" },
  { label: "Anomalies", to: "/app/jal-vigyani/anomalies" },
  { label: "Schedule", to: "/app/jal-vigyani/schedule" },
  { label: "Digital Twin", to: "/app/jal-vigyani/twin" },
  { label: "Help", to: "/app/jal-vigyani/help" },
];

export function NativeJalVigyaniShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <NativeAppShell
      roleLabel="Jal Vigyani"
      title={title}
      subtitle={subtitle}
      tabs={TABS}
      moreItems={MORE_ITEMS}
    >
      {children}
    </NativeAppShell>
  );
}

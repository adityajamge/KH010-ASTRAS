import type { ReactNode } from "react";
import {
  CalendarIcon,
  ChatIcon,
  DropIcon,
  HomeIcon,
  NativeAppShell,
  type NativeTab,
} from "./NativeAppShell";

const TABS: NativeTab[] = [
  { key: "home", label: "Dashboard", to: "/app/farmer", end: true, icon: HomeIcon },
  { key: "request", label: "Request", to: "/app/farmer/request", icon: DropIcon },
  { key: "mediation", label: "Mediation", to: "/app/farmer/mediation", icon: ChatIcon },
  { key: "schedule", label: "Schedule", to: "/app/farmer/schedule", icon: CalendarIcon },
];

const MORE_ITEMS = [
  { label: "Allocation", to: "/app/farmer/allocation" },
  { label: "Delivery", to: "/app/farmer/delivery" },
  { label: "Digital Twin", to: "/app/farmer/twin" },
  { label: "Alerts", to: "/app/farmer/alerts" },
  { label: "History", to: "/app/farmer/history" },
  { label: "Help", to: "/app/farmer/help" },
];

export function NativeFarmerShell({
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
      roleLabel="Farmer"
      title={title}
      subtitle={subtitle}
      tabs={TABS}
      moreItems={MORE_ITEMS}
    >
      {children}
    </NativeAppShell>
  );
}

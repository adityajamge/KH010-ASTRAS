import type { ReactNode } from "react";
import {
  CloudRainIcon,
  HelpCircleIcon,
  HomeIcon,
  NativeAppShell,
  ShareIcon,
  TankIcon,
  type NativeTab,
} from "./NativeAppShell";

const TABS: NativeTab[] = [
  { key: "home", label: "Dashboard", to: "/app/dam", end: true, icon: HomeIcon },
  { key: "reservoir", label: "Reservoir", to: "/app/dam/reservoir", icon: TankIcon },
  { key: "rainfall", label: "Rainfall", to: "/app/dam/rainfall", icon: CloudRainIcon },
  { key: "releases", label: "Releases", to: "/app/dam/releases", icon: ShareIcon },
  { key: "help", label: "Help", to: "/app/dam/help", icon: HelpCircleIcon },
];

const MORE_ITEMS = [{ label: "Digital Twin", to: "/app/dam/twin" }];

export function NativeDamOperatorShell({
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
      roleLabel="Dam Operator"
      title={title}
      subtitle={subtitle}
      tabs={TABS}
      moreItems={MORE_ITEMS}
    >
      {children}
    </NativeAppShell>
  );
}

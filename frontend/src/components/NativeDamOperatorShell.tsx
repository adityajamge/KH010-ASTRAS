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

// Digital Twin (3D/WebGL) is deliberately left out of the native app nav —
// too heavy/unreliable in a mobile WebView. Website keeps it. That leaves
// exactly 5 sections, so every one fits directly in the tab bar — no
// "More" sheet needed here (moreItems omitted).
const TABS: NativeTab[] = [
  { key: "home", label: "Dashboard", to: "/app/dam", end: true, icon: HomeIcon },
  { key: "reservoir", label: "Reservoir", to: "/app/dam/reservoir", icon: TankIcon },
  { key: "rainfall", label: "Rainfall", to: "/app/dam/rainfall", icon: CloudRainIcon },
  { key: "releases", label: "Releases", to: "/app/dam/releases", icon: ShareIcon },
  { key: "help", label: "Help", to: "/app/dam/help", icon: HelpCircleIcon },
];

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
    <NativeAppShell roleLabel="Dam Operator" title={title} subtitle={subtitle} tabs={TABS}>
      {children}
    </NativeAppShell>
  );
}

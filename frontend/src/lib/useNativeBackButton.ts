import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/**
 * Registering a `backButton` listener at all replaces Capacitor's default
 * Android hardware-back behaviour entirely (Capacitor's own docs: "Enabling
 * this listener disables the default back button behaviour") — without
 * this hook, that default was exiting the app immediately instead of
 * walking back through react-router's history.
 *
 * `canGoBack` (from Capacitor's BackButtonListenerEvent) reflects whether
 * window.history has anywhere to go — react-router's BrowserRouter drives
 * that same history, so `window.history.back()` correctly steps back a
 * route. Only exit once there's truly nowhere left to go back to.
 */
export function useNativeBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listenerPromise.then((handle) => handle.remove());
    };
  }, []);
}

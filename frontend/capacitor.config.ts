import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jalsetu.app',
  appName: 'JalSetu',
  webDir: 'dist',
  // Dev-only: the backend is plain HTTP (no TLS cert), and Capacitor 6+
  // defaults androidScheme to "https" — so the WebView treats its own page
  // as a secure origin and blocks any http:// API call as mixed content
  // ("Mixed Content: ... must be served over HTTPS"). androidScheme:
  // "http" makes the app's own origin http:// too, so it's no longer
  // "mixed"; cleartext allows the OS-level network stack to permit http
  // traffic at all (Android blocks it by default since API 28).
  // Remove both once the backend is served over HTTPS for a real release.
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;

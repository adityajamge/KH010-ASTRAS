import { Capacitor } from "@capacitor/core";
import { SignUp } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

// See SignInPage.tsx — Google OAuth doesn't work inside a Capacitor
// WebView, so native builds hide the social buttons/divider entirely.
const nativeAppearance = Capacitor.isNativePlatform()
  ? {
      elements: {
        socialButtonsRoot: "clerk-native-hidden",
        dividerRow: "clerk-native-hidden",
      },
    }
  : undefined;

export function SignUpPage() {
  return (
    <main className="page">
      <section className="auth-wrap">
        <Link className="brand" to="/">
          <img src="/logo.png" alt="JalSetu logo" className="brand-logo" />
          JalSetu
        </Link>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          appearance={nativeAppearance}
        />
      </section>
    </main>
  );
}

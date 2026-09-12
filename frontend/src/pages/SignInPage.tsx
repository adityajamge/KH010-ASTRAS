import { Capacitor } from "@capacitor/core";
import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

// Google OAuth (and any other redirect-based social provider) doesn't work
// inside a Capacitor WebView — Google actively blocks sign-in from an
// embedded WebView user agent ("disallowed_useragent"). Hide the social
// buttons/divider on native builds so only email/password is offered,
// rather than showing a button that reliably fails.
const nativeAppearance = Capacitor.isNativePlatform()
  ? {
      elements: {
        socialButtonsRoot: "clerk-native-hidden",
        dividerRow: "clerk-native-hidden",
      },
    }
  : undefined;

export function SignInPage() {
  return (
    <main className="page">
      <section className="auth-wrap">
        <Link className="brand" to="/">
          <img src="/logo.png" alt="JalSetu logo" className="brand-logo" />
          JalSetu
        </Link>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          appearance={nativeAppearance}
        />
      </section>
    </main>
  );
}

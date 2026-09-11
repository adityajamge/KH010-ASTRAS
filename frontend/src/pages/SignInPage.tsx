import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export function SignInPage() {
  return (
    <main className="page">
      <section className="auth-wrap">
        <Link className="brand" to="/">
          <img src="/logo.png" alt="JalSetu logo" className="brand-logo" />
          JalSetu
        </Link>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </section>
    </main>
  );
}

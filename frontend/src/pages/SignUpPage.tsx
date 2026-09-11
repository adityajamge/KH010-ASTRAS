import { SignUp } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export function SignUpPage() {
  return (
    <main className="page">
      <section className="auth-wrap">
        <Link className="brand" to="/">
          <span className="brand-mark">≈</span> JalSetu
        </Link>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </section>
    </main>
  );
}

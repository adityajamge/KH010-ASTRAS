import { Link } from "react-router-dom";
import { SignOutButton } from "@clerk/clerk-react";

export function NoAccessPage() {
  return (
    <main className="page">
      <section className="auth-wrap">
        <h1>No access for this role</h1>
        <p className="muted">
          Your account is signed in, but it has no JalSetu role assigned (or
          not the role this page needs). Roles are assigned via{" "}
          <code>publicMetadata.role</code>: <code>farmer</code>,{" "}
          <code>jal_vigyani</code>, or <code>dam_operator</code>.
        </p>
        <div className="row">
          <Link className="btn btn-secondary" to="/">
            Back to home
          </Link>
          <SignOutButton>
            <button className="btn btn-secondary" type="button">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </section>
    </main>
  );
}

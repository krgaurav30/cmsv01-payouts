import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { parseSessionCookie, SESSION_COOKIE } from "../../lib/session-cookie";
import { LoginCard } from "./ui/login-card";
import "./styles.css";

const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: "Invalid username or password.",
  service_unavailable: "Login service is temporarily unavailable."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const session = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);

  if (session) {
    redirect("/operations/home");
  }

  const params = searchParams ? await searchParams : undefined;
  const error =
    params?.error && params.error in LOGIN_ERRORS
      ? LOGIN_ERRORS[params.error]
      : null;

  return (
    <main className="login-shell">
      <section className="login-hero">
        <p className="eyebrow">Future Pay</p>
        <h1>Corporate operations, reimagined for finance teams.</h1>
        <p className="hero-copy">
          A faster, cleaner payouts workspace for makers and checkers inside your
          bank-linked operating console.
        </p>
        <div className="hero-grid">
          <article className="hero-card">
            <strong>Maker flow</strong>
            <span>Create beneficiaries, raise transactions, manage users and roles.</span>
          </article>
          <article className="hero-card">
            <strong>Checker flow</strong>
            <span>Review approvals, control risk, and monitor the operating queue.</span>
          </article>
        </div>
      </section>

      <LoginCard error={error} />
    </main>
  );
}

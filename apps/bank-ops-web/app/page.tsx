import Link from "next/link";
import { ConsoleNav } from "./ui/console-nav";

const surfaces = [
  {
    href: "/onboarding-review",
    title: "Onboarding Review",
    body: "Review submitted corporate onboarding requests and take approval actions."
  },
  {
    href: "/payout-operations",
    title: "Payout Operations",
    body: "Operate payout queues, dispatch approved transactions, and simulate bank responses."
  },
  {
    href: "/developer-portal",
    title: "Developer Portal",
    body: "Manage partner API keys, inspect payment APIs, and configure webhook subscriptions."
  },
  {
    href: "/product-catalog",
    title: "Product Catalog",
    body: "Create bank-owned payment methods and publish base package bundles for corporates to adopt."
  }
];

export default function HomePage() {
  return (
    <main className="dashboard-shell">
      <ConsoleNav current="home" />
      <section className="hero">
        <p className="eyebrow">Bank Ops Web</p>
        <h1>Operational surfaces now sit behind one unified BFF.</h1>
        <p className="lede">
          This frontend is the dedicated bank-ops browser entry point. It talks only to the BFF,
          which then reaches the core backend.
        </p>
      </section>

      <section className="grid">
        {surfaces.map((surface) => (
          <Link key={surface.href} className="card" href={surface.href}>
            <span className="label">{surface.title}</span>
            <p>{surface.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

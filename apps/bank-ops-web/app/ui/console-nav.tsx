import Link from "next/link";

type ConsoleNavProps = {
  current:
    | "home"
    | "onboarding-review"
    | "payout-operations"
    | "developer-portal"
    | "product-catalog";
};

const links = [
  { href: "/", label: "Console Home", key: "home" },
  { href: "/onboarding-review", label: "Onboarding Review", key: "onboarding-review" },
  { href: "/payout-operations", label: "Payout Operations", key: "payout-operations" },
  { href: "/product-catalog", label: "Product Catalog", key: "product-catalog" },
  { href: "/developer-portal", label: "Dev Portal", key: "developer-portal" }
] as const;

export function ConsoleNav({ current }: ConsoleNavProps) {
  return (
    <nav className="top-nav" aria-label="Bank console navigation">
      {links.map((link) => (
        <Link
          key={link.href}
          className={`nav-link ${link.key === current ? "nav-link-active" : ""}`}
          href={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

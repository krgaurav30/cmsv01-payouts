import dynamic from "next/dynamic";
import "./developer-portal.css";

const DeveloperPortalPageClient = dynamic(() => import("./page-client").then((mod) => mod.DeveloperPortalPageClient), {
  loading: () => <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>Loading Developer Portal...</div>
});

type PageProps = {
  searchParams: Promise<{ embed?: string }> | { embed?: string };
};

export default async function DeveloperPortalPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const isEmbedded = resolvedParams?.embed === "true";

  return (
    <main className="dashboard-shell" style={isEmbedded ? { width: "100%", maxWidth: "none", padding: 0, margin: 0 } : undefined}>
      <DeveloperPortalPageClient isEmbedded={isEmbedded} />
    </main>
  );
}

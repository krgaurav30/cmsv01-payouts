import { ConsoleNav } from "../ui/console-nav";
import { DeveloperPortalPageClient } from "./page-client";

export default function DeveloperPortalPage() {
  return (
    <main className="dashboard-shell">
      <ConsoleNav current="developer-portal" />
      <DeveloperPortalPageClient />
    </main>
  );
}

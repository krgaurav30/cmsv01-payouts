import { ConsoleNav } from "../ui/console-nav";
import { PayoutOperationsPageClient } from "./page-client";

export default function PayoutOperationsPage() {
  return (
    <main className="dashboard-shell">
      <ConsoleNav current="payout-operations" />
      <PayoutOperationsPageClient />
    </main>
  );
}

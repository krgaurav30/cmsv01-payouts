import { ConsoleNav } from "../ui/console-nav";
import { OnboardingReviewPageClient } from "./page-client";

export default function OnboardingReviewPage() {
  return (
    <main className="dashboard-shell">
      <ConsoleNav current="onboarding-review" />
      <OnboardingReviewPageClient />
    </main>
  );
}

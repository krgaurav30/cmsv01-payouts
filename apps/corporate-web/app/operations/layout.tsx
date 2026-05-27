import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadOperationsInitialData } from "../../lib/operations-data";
import { parseSessionCookie, SESSION_COOKIE } from "../../lib/session-cookie";
import { OperationsDashboard } from "./ui/operations-dashboard";
import "./styles.css";

type OperationsLayoutProps = {
  children: ReactNode;
};

export default async function OperationsLayout({ children }: OperationsLayoutProps) {
  const layoutStartTime = Date.now();
  console.log("[Layout] Rendering started");

  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${protocol}://${host}` : null;

  if (!session) {
    console.log(`[Layout] No session found, redirecting in ${Date.now() - layoutStartTime}ms`);
    redirect("/login");
  }

  let initialData;
  try {
    initialData = await loadOperationsInitialData(
      session,
      cookieStore.get("cmsSelectedCorporateId")?.value,
      requestOrigin
    );
  } catch (err: any) {
    console.error("[Layout] loadOperationsInitialData failed:", err.message);
    if (err.message === "Unauthorized") {
      redirect("/login?error=session_expired");
    }
    initialData = {
      selectedCorporateId: cookieStore.get("cmsSelectedCorporateId")?.value ?? "",
      bankTenants: [],
      corporateTenants: [],
      corporates: [],
      subscriptions: [],
      activeSubscription: null,
      beneficiaries: [],
      transactions: [],
      fileUploads: [],
      approvalMatrices: [],
      roles: [],
      users: [],
      settings: null,
      debitAccounts: []
    };
  }

  console.log(`[Layout] Rendering completed in ${Date.now() - layoutStartTime}ms`);

  return (
    <>
      <OperationsDashboard
        initialData={initialData}
        initialSection="home"
        initialSession={session}
      />
      {children}
    </>
  );
}

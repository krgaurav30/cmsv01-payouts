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
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${protocol}://${host}` : null;

  if (!session) {
    redirect("/login");
  }

  const initialData = await loadOperationsInitialData(
    session,
    cookieStore.get("cmsSelectedCorporateId")?.value,
    requestOrigin
  );

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

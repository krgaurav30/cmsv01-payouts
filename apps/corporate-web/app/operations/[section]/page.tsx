import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { loadOperationsInitialData } from "../../../lib/operations-data";
import { parseSessionCookie, SESSION_COOKIE } from "../../../lib/session-cookie";
import { OperationsDashboard, type SectionId } from "../ui/operations-dashboard";
import "../styles.css";

const VALID_SECTIONS: SectionId[] = [
  "home",
  "transactions",
  "file-uploads",
  "beneficiaries",
  "approvals",
  "approval-matrices",
  "roles",
  "users",
  "devportal",
  "reports",
  "audit",
  "settings"
];

type OperationsSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function OperationsSectionPage({
  params
}: OperationsSectionPageProps) {
  const { section } = await params;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = parseSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${protocol}://${host}` : null;

  if (!session) {
    redirect("/login");
  }

  if (!isSectionId(section)) {
    notFound();
  }

  const initialData = await loadOperationsInitialData(
    session,
    cookieStore.get("cmsSelectedCorporateId")?.value,
    requestOrigin
  );

  return (
    <OperationsDashboard
      initialData={initialData}
      initialSection={section}
      initialSession={session}
    />
  );
}

function isSectionId(value: string): value is SectionId {
  return VALID_SECTIONS.includes(value as SectionId);
}

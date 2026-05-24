import { notFound } from "next/navigation";

import type { SectionId } from "../ui/operations-dashboard";

const VALID_SECTIONS: SectionId[] = [
  "home",
  "transactions",
  "file-uploads",
  "beneficiaries",
  "approvals",
  "packages",
  "debit-accounts",
  "cbs-simulator",
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
  console.log(`[OperationsSectionPage] section parameter: "${section}", isSectionId: ${isSectionId(section)}`);

  if (!isSectionId(section)) {
    notFound();
  }

  return <></>;
}

function isSectionId(value: string): value is SectionId {
  const matched = VALID_SECTIONS.includes(value as SectionId);
  console.log(`[isSectionId] checking "${value}", result: ${matched}`);
  return matched;
}

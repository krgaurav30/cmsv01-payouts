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

  if (!isSectionId(section)) {
    notFound();
  }

  return null;
}

function isSectionId(value: string): value is SectionId {
  return VALID_SECTIONS.includes(value as SectionId);
}

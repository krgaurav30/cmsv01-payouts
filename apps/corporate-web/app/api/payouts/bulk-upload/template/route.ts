import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

import { parseSessionCookie, SESSION_COOKIE } from "../../../../../lib/session-cookie";

export async function GET(request: NextRequest) {
  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json(
      { message: "You must be signed in to download the template." },
      { status: 401 }
    );
  }

  try {
    const packageCode = request.nextUrl.searchParams.get("packageCode");
    const paymentMethodCode = request.nextUrl.searchParams.get("paymentMethodCode");
    const debitAccountNumber = request.nextUrl.searchParams.get("debitAccountNumber");
    const file = generateTemplateBuffer(
      packageCode,
      paymentMethodCode,
      debitAccountNumber
    );
    const body = new Blob([new Uint8Array(file)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Disposition":
          'attachment; filename="future-pay-bulk-transaction-template.xlsx"',
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The template could not be generated."
      },
      { status: 500 }
    );
  }
}
function generateTemplateBuffer(
  packageCode?: string | null,
  paymentMethodCode?: string | null,
  debitAccountNumber?: string | null
): Buffer {
  const HEADERS = [
    "Package Code",
    "Payment Method Code",
    "Transaction Reference",
    "Beneficiary ID",
    "Debit Account Number",
    "Amount",
    "Tag",
    "Remark"
  ];

  const SAMPLE_ROW = [
    packageCode?.trim().toUpperCase() || "",
    paymentMethodCode?.trim().toUpperCase() || "",
    "INV-2026-000143",
    "KUMAR123",
    debitAccountNumber?.trim() || "",
    101.00,
    "salary",
    "May payout batch"
  ];

  const workbook = xlsx.utils.book_new();
  const sheet = xlsx.utils.aoa_to_sheet([HEADERS, SAMPLE_ROW]);

  sheet["!cols"] = HEADERS.map((header) => ({ wch: Math.max(header.length + 6, 22) }));

  xlsx.utils.book_append_sheet(workbook, sheet, "Bulk Transactions");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

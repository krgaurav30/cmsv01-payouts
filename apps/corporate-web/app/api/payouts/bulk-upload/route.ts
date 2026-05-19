import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

import { resolveApiBase } from "../../../../lib/api-base";
import { parseSessionCookie, SESSION_COOKIE } from "../../../../lib/session-cookie";

type ParsedUpload = {
  rows: Array<{
    transactionReference: string;
    beneficiaryName: string;
    amount: number;
    tag?: string | null;
    remark?: string | null;
  }>;
  errors: string[];
};

export async function POST(request: NextRequest) {
  const apiUrl = resolveApiBase(request.nextUrl.origin);
  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json(
      { message: "You must be signed in to upload transactions." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const corporateId = String(formData.get("corporateId") ?? session.corporateId ?? "");
  const uploadId = `upload-${Date.now()}-${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")}`;

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Please choose an Excel file to upload." },
      { status: 400 }
    );
  }

  if (!corporateId) {
    return NextResponse.json(
      { message: "A child corporate must be selected before bulk upload." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedUpload = parseWorkbookFromBuffer(buffer);

    if (parsedUpload.errors.length > 0) {
      await recordRejectedFileUpload({
        apiUrl,
        uploadId,
        bankTenantId: session.bankTenantId,
        corporateTenantId: session.corporateTenantId,
        corporateId,
        fileName: file.name,
        uploadedByUserId: session.userId,
        errors: parsedUpload.errors
      });

      return NextResponse.json(
        {
          message: "The uploaded file has validation issues.",
          errors: parsedUpload.errors
        },
        { status: 400 }
      );
    }

    const response = await fetch(`${apiUrl}/v1/payouts/file-uploads/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bankTenantId: session.bankTenantId,
        corporateTenantId: session.corporateTenantId,
        corporateId,
        createdByUserId: session.userId,
        fileName: file.name,
        rows: parsedUpload.rows
      }),
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The uploaded file could not be processed."
      },
      { status: 500 }
    );
  }
}

function parseWorkbookFromBuffer(buffer: Buffer): ParsedUpload {
  const EXPECTED_HEADERS: Record<string, string> = {
    "transaction reference": "transactionReference",
    "beneficiary name": "beneficiaryName",
    amount: "amount",
    tag: "tag",
    remark: "remark"
  };

  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["The uploaded sheet is empty."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  if (rows.length === 0) {
    return { rows: [], errors: ["The uploaded sheet is empty."] };
  }

  const headerRow = rows[0] || [];
  const headerMap: Record<string, number> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const cellValue = headerRow[i];
    const normalized = String(cellValue || "").trim().toLowerCase();
    if (EXPECTED_HEADERS[normalized]) {
      headerMap[EXPECTED_HEADERS[normalized]] = i;
    }
  }

  const requiredLabels = [
    "transactionReference",
    "beneficiaryName",
    "amount",
    "tag",
    "remark"
  ];
  
  const missing = requiredLabels.filter((label) => headerMap[label] === undefined);

  if (missing.length > 0) {
    return {
      rows: [],
      errors: ["Missing required columns: " + missing.join(", ")]
    };
  }

  const parsedRows: ParsedUpload["rows"] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row.some((val) => val !== undefined && val !== null && val !== "")) {
      continue;
    }

    const getStr = (idx: number) => {
      const val = row[idx];
      const str = String(val === undefined || val === null ? "" : val).trim();
      return str || null;
    };

    const transactionReference = getStr(headerMap["transactionReference"]);
    const beneficiaryName = getStr(headerMap["beneficiaryName"]);
    const amountVal = row[headerMap["amount"]];
    const tag = getStr(headerMap["tag"]);
    const remark = getStr(headerMap["remark"]);

    if (!transactionReference) {
      errors.push(`Row ${i + 1}: Transaction Reference is required.`);
      continue;
    }

    if (!beneficiaryName) {
      errors.push(`Row ${i + 1}: Beneficiary Name is required.`);
      continue;
    }

    let amount = 0;
    if (typeof amountVal === "number") {
      amount = amountVal;
    } else {
      const parsed = parseFloat(String(amountVal || "").trim());
      if (!isNaN(parsed)) amount = parsed;
    }

    if (amount <= 0) {
      errors.push(`Row ${i + 1}: Amount must be a positive number.`);
      continue;
    }

    parsedRows.push({
      transactionReference,
      beneficiaryName,
      amount,
      tag: tag === "" ? null : tag,
      remark: remark === "" ? null : remark
    });
  }

  return { rows: parsedRows, errors };
}

async function recordRejectedFileUpload(payload: {
  apiUrl: string;
  uploadId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  fileName: string;
  uploadedByUserId: string;
  errors: string[];
}) {
  await fetch(`${payload.apiUrl}/v1/payouts/file-uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uploadId: payload.uploadId,
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      fileName: payload.fileName,
      uploadedByUserId: payload.uploadedByUserId,
      status: "rejected",
      remark: payload.errors.slice(0, 5).join(" | "),
      totalRows: 0,
      createdCount: 0,
      rejectedCount: 0
    }),
    cache: "no-store"
  }).catch(() => undefined);
}

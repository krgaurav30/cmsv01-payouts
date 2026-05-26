import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

import { resolveBffBase } from "../../../../lib/api-base";
import {
  parseSessionCookie,
  SELECTED_SUBSCRIPTION_COOKIE,
  SESSION_COOKIE
} from "../../../../lib/session-cookie";

type ParsedUpload = {
  rows: Array<{
    packageCode?: string;
    paymentMethodCode?: string;
    transactionReference: string;
    beneficiaryId: string;
    debitAccountNumber?: string;
    amount: number;
    tag?: string;
    remark?: string;
  }>;
  explicitPackageCodes: string[];
  errors: string[];
};

export async function POST(request: NextRequest) {
  const bffUrl = resolveBffBase(request.nextUrl.origin);
  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  const cookieHeader = request.headers.get("cookie") ?? "";

  if (!session) {
    return NextResponse.json(
      { message: "You must be signed in to upload transactions." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const corporateId = String(formData.get("corporateId") ?? session.corporateId ?? "");
  const defaultSubscriptionId =
    optionalString(formData.get("defaultSubscriptionId")) ??
    request.cookies.get(SELECTED_SUBSCRIPTION_COOKIE)?.value?.trim() ??
    null;
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
    const explicitPackageCode = parsedUpload.explicitPackageCodes[0] ?? null;
    const hasMixedPackageCodes = parsedUpload.explicitPackageCodes.length > 1;

    if (hasMixedPackageCodes) {
      parsedUpload.errors.push(
        "A bulk file can contain only one Package Code. Split mixed-package rows into separate files."
      );
    }

    const effectiveSubscriptionId = explicitPackageCode ? null : defaultSubscriptionId;
    const effectivePackageCode = explicitPackageCode;

    if (!effectivePackageCode && !effectiveSubscriptionId) {
      parsedUpload.errors.push(
        "Package Code is blank in the file. Fill it in the sheet or choose a default package in Context."
      );
    }

    if (parsedUpload.errors.length > 0) {
      await recordRejectedFileUpload({
        bffUrl,
        cookieHeader,
        uploadId,
        bankTenantId: session.bankTenantId,
        corporateTenantId: session.corporateTenantId,
        corporateId,
        subscriptionId: effectiveSubscriptionId,
        packageCode: effectivePackageCode,
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

    const response = await fetch(`${bffUrl}/v1/payouts/file-uploads/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader
      },
      body: JSON.stringify({
        bankTenantId: session.bankTenantId,
        corporateTenantId: session.corporateTenantId,
        corporateId,
        ...(effectiveSubscriptionId ? { subscriptionId: effectiveSubscriptionId } : {}),
        ...(effectivePackageCode ? { packageCode: effectivePackageCode } : {}),
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
    "package code": "packageCode",
    "payment method code": "paymentMethodCode",
    "transaction reference": "transactionReference",
    "beneficiary id": "beneficiaryId",
    "debit account number": "debitAccountNumber",
    amount: "amount",
    tag: "tag",
    remark: "remark"
  };

  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], explicitPackageCodes: [], errors: ["The uploaded sheet is empty."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  if (rows.length === 0) {
    return { rows: [], explicitPackageCodes: [], errors: ["The uploaded sheet is empty."] };
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

  const requiredLabels = ["packageCode", "transactionReference", "beneficiaryId", "amount"];
  
  const missing = requiredLabels.filter((label) => headerMap[label] === undefined);

  if (missing.length > 0) {
    return {
      rows: [],
      explicitPackageCodes: [],
      errors: ["Missing required columns: " + missing.join(", ")]
    };
  }

  const parsedRows: ParsedUpload["rows"] = [];
  const explicitPackageCodes = new Set<string>();
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
    const packageCode = getStr(headerMap["packageCode"]);
    const paymentMethodCode = getStr(headerMap["paymentMethodCode"]);
    const beneficiaryId = getStr(headerMap["beneficiaryId"]);
    const debitAccountNumber = getStr(headerMap["debitAccountNumber"]);
    const amountVal = row[headerMap["amount"]];
    const tag = getStr(headerMap["tag"]);
    const remark = getStr(headerMap["remark"]);

    const normalizedPackageCode = packageCode?.toUpperCase() ?? null;

    if (normalizedPackageCode) {
      explicitPackageCodes.add(normalizedPackageCode);
    }

    if (!packageCode) {
      errors.push(`Row ${i + 1}: Package Code is required.`);
      continue;
    }

    if (!transactionReference) {
      errors.push(`Row ${i + 1}: Transaction Reference is required.`);
      continue;
    }

    if (!beneficiaryId) {
      errors.push(`Row ${i + 1}: Beneficiary ID is required.`);
      continue;
    }

    let amountValParsed = 0;
    if (typeof amountVal === "number") {
      amountValParsed = amountVal;
    } else {
      const parsed = parseFloat(String(amountVal || "").trim());
      if (!isNaN(parsed)) amountValParsed = parsed;
    }

    if (amountValParsed <= 0) {
      errors.push(`Row ${i + 1}: Amount must be a positive number.`);
      continue;
    }

    const amount = Math.round(amountValParsed * 100);

    parsedRows.push({
      ...(normalizedPackageCode ? { packageCode: normalizedPackageCode } : {}),
      ...(paymentMethodCode
        ? { paymentMethodCode: paymentMethodCode.toUpperCase() }
        : {}),
      transactionReference,
      beneficiaryId: beneficiaryId.toUpperCase(),
      ...(debitAccountNumber ? { debitAccountNumber } : {}),
      amount,
      ...(tag ? { tag } : {}),
      ...(remark ? { remark } : {})
    });
  }

  return { rows: parsedRows, explicitPackageCodes: [...explicitPackageCodes], errors };
}

async function recordRejectedFileUpload(payload: {
  bffUrl: string;
  cookieHeader: string;
  uploadId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  subscriptionId: string | null;
  packageCode: string | null;
  fileName: string;
  uploadedByUserId: string;
  errors: string[];
}) {
  await fetch(`${payload.bffUrl}/v1/payouts/file-uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: payload.cookieHeader
    },
    body: JSON.stringify({
      uploadId: payload.uploadId,
      bankTenantId: payload.bankTenantId,
      corporateTenantId: payload.corporateTenantId,
      corporateId: payload.corporateId,
      subscriptionId: payload.subscriptionId,
      packageCode: payload.packageCode,
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

function optionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3101";
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

  const tempDir = path.join(process.cwd(), ".runtime-temp");
  const tempFilePath = path.join(
    tempDir,
    `future-pay-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    const parsedUpload = await parseWorkbook(tempFilePath);

    if (parsedUpload.errors.length > 0) {
      await recordRejectedFileUpload({
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
  } finally {
    await fs.unlink(tempFilePath).catch(() => undefined);
  }
}

async function parseWorkbook(filePath: string) {
  const python = "C:\\Users\\krgau\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
  const script = resolveWorkspacePath("scripts", "parse_bulk_transactions_xlsx.py");

  return new Promise<ParsedUpload>((resolve, reject) => {
    const child = spawn(python, [script, filePath], {
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Excel parser failed with exit code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as ParsedUpload);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function recordRejectedFileUpload(payload: {
  uploadId: string;
  bankTenantId: string;
  corporateTenantId: string;
  corporateId: string;
  fileName: string;
  uploadedByUserId: string;
  errors: string[];
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3101";
  await fetch(`${apiUrl}/v1/payouts/file-uploads`, {
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

function resolveWorkspacePath(...segments: string[]) {
  const direct = path.join(process.cwd(), ...segments);
  if (existsSync(direct)) {
    return direct;
  }

  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const fromRepoRoot = path.join(repoRoot, ...segments);
  if (existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }

  return direct;
}

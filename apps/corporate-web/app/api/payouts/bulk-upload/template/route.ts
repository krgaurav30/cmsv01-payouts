import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { parseSessionCookie, SESSION_COOKIE } from "../../../../../lib/session-cookie";

export async function GET(request: NextRequest) {
  const session = parseSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json(
      { message: "You must be signed in to download the template." },
      { status: 401 }
    );
  }

  const tempDir = path.join(process.cwd(), ".runtime-temp");
  const outputPath = path.join(
    tempDir,
    `future-pay-template-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`
  );

  try {
    await fs.mkdir(tempDir, { recursive: true });
    await generateTemplate(outputPath);
    const file = await fs.readFile(outputPath);

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
  } finally {
    await fs.unlink(outputPath).catch(() => undefined);
  }
}

async function generateTemplate(outputPath: string) {
  const python =
    "C:\\Users\\krgau\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
  const script = resolveWorkspacePath(
    "scripts",
    "generate_bulk_transactions_template.py"
  );

  return new Promise<void>((resolve, reject) => {
    const child = spawn(python, [script, outputPath], {
      windowsHide: true
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Template generator failed with exit code ${code}`));
        return;
      }

      resolve();
    });
  });
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

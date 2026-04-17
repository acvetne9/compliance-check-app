import { NextRequest, NextResponse } from "next/server";
import { ingestPolicy, isPolicyIngested } from "@/lib/ingest";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folderId = formData.get("folderId") as string | null;

  if (!file || !folderId) {
    return NextResponse.json(
      { error: "Missing file or folderId" },
      { status: 400 }
    );
  }

  if (!file.name.endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  // Check if already ingested
  const alreadyIngested = await isPolicyIngested(file.name, folderId);
  if (alreadyIngested) {
    return NextResponse.json(
      { error: "Policy already ingested", fileName: file.name },
      { status: 409 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await ingestPolicy(buffer, file.name, folderId);

  return NextResponse.json(result, { status: 201 });
}

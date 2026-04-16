import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDirectory, getFileContent } from "@/lib/github";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path");
  const type = request.nextUrl.searchParams.get("type");

  if (!path) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  if (type === "file") {
    const content = await getFileContent(session.accessToken, path);
    return NextResponse.json(content);
  }

  const entries = await listDirectory(session.accessToken, path);
  return NextResponse.json(entries);
}

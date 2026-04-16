import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDirectory, getFileForUser } from "@/lib/github";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path");
  const type = request.nextUrl.searchParams.get("type");

  if (!path) {
    return NextResponse.json({ error: "Path required" }, { status: 400 });
  }

  try {
    if (type === "file") {
      const content = await getFileForUser(session.user.login, path);
      return NextResponse.json(content);
    }

    const entries = await listDirectory(path);
    return NextResponse.json(entries);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error && typeof error === "object" && "status" in error ? (error.status as number) : 500;
    console.error(`GitHub API error for ${path}:`, message);
    return NextResponse.json({ error: message }, { status });
  }
}

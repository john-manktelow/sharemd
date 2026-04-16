import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConfig } from "@/lib/github";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ error: "repo is required" }, { status: 400 });
  }

  try {
    const config = await getConfig(repo);
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Config error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

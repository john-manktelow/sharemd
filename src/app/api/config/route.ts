import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConfig } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getConfig(session.accessToken);
  return NextResponse.json(config);
}

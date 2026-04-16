import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listUserDrafts } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const drafts = await listUserDrafts(session.user.login);
    return NextResponse.json(drafts);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Drafts error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAccessibleRepos, getAppInstallUrl } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [repos, installUrl] = await Promise.all([
      listAccessibleRepos(),
      getAppInstallUrl(),
    ]);
    return NextResponse.json({ repos, installUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Repos error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

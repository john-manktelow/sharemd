import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  saveToUserDraft,
  publishUserDraft,
  type CommitAuthor,
} from "@/lib/github";

function getCommitAuthor(session: {
  user?: { name?: string | null; email?: string | null; login?: string };
}): CommitAuthor {
  const login = session.user?.login ?? "sharemd-user";
  const name = session.user?.name ?? login;
  const email = session.user?.email ?? `${login}@users.noreply.github.com`;
  return { name, email };
}

/** Save: write to the user's draft branch. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path, content, sha } = await request.json();

  if (!path || content === undefined) {
    return NextResponse.json(
      { error: "path and content are required" },
      { status: 400 }
    );
  }

  try {
    const result = await saveToUserDraft(
      session.user.login,
      path,
      content,
      getCommitAuthor(session),
      sha
    );
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Save error for ${path}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Publish: squash-merge the user's draft into the target branch. */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.login) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path, message } = await request.json();

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const result = await publishUserDraft(
    session.user.login,
    path,
    message ?? `Update ${path} via ShareMD`
  );

  if (!result.success && result.conflicted) {
    return NextResponse.json(
      {
        error: "conflict",
        message:
          "Another edit happened at the same time. Your changes are saved but need reviewing before publishing.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ merged: true });
}

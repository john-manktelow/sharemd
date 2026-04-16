import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createWorkingBranch,
  saveFile,
  getFileShaOnBranch,
  squashMerge,
  deleteBranch,
} from "@/lib/github";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path, content, branch, sha } = await request.json();

  if (!path || content === undefined || !branch) {
    return NextResponse.json(
      { error: "path, content, and branch are required" },
      { status: 400 }
    );
  }

  // Get the current SHA of the file on the working branch
  const currentSha =
    sha ?? (await getFileShaOnBranch(session.accessToken, path, branch));

  const newSha = await saveFile(
    session.accessToken,
    path,
    content,
    branch,
    currentSha ?? undefined
  );

  return NextResponse.json({ sha: newSha });
}

export async function PUT(request: NextRequest) {
  // Create a working branch
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { branch } = await request.json();

  if (!branch) {
    return NextResponse.json({ error: "branch is required" }, { status: 400 });
  }

  try {
    await createWorkingBranch(session.accessToken, branch);
    return NextResponse.json({ created: true });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 422) {
      // Branch already exists — that's fine
      return NextResponse.json({ created: false, exists: true });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  // Squash merge and clean up
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { branch, message } = await request.json();

  if (!branch) {
    return NextResponse.json({ error: "branch is required" }, { status: 400 });
  }

  const result = await squashMerge(
    session.accessToken,
    branch,
    message ?? `Update via ShareMD`
  );

  if (!result.success && result.conflicted) {
    // Clean up the branch on conflict for now; v2 would do diff3 resolution
    await deleteBranch(session.accessToken, branch);
    return NextResponse.json(
      { error: "Merge conflict — your changes have been saved on a separate branch for manual resolution" },
      { status: 409 }
    );
  }

  return NextResponse.json({ merged: true });
}

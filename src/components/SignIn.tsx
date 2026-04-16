"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      onClick={() => signIn("github")}
      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
    >
      Sign in with GitHub
    </button>
  );
}

export function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {session.user.name ?? session.user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Sign out
      </button>
    </div>
  );
}

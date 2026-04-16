import { auth } from "@/auth";
import { SignInButton } from "@/components/SignIn";
import EditorLayout from "@/components/EditorLayout";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
            ShareMD
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Collaborative markdown editing, backed by GitHub
          </p>
          <SignInButton />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <EditorLayout />
    </div>
  );
}

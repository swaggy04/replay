
import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6">
      <Suspense fallback={<p className="text-white">Loading...</p>}>
        <SignIn />
      </Suspense>
    </main>
  );
}

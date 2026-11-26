"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/DashboardShell";

export default function CollectionsPage() {
  const router = useRouter();

  return (
    <DashboardShell
      onRouteProjectChange={(project) => {
        router.push("/");
        void project;
      }}
    >
      {() => (
        <>
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#09090b] px-5">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-[#fafafa]">Collections</h1>
              <p className="mt-0.5 text-[11px] text-[#71717a]">Organize and reuse captured requests</p>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#27272a] bg-[#131316] text-[#71717a]">
                ▱
              </div>
              <h2 className="text-base font-semibold text-[#fafafa]">Collections</h2>
              <p className="mt-2 text-sm text-[#a1a1aa]">Collections are not available yet.</p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#d4d4d8] transition hover:bg-[#18181b]"
              >
                ← Back to requests
              </Link>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

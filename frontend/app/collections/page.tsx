import Link from "next/link";

export default function CollectionsPage() {
  return (
    <main className="flex h-screen items-center justify-center bg-[#0c080a]">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-[#f1eeee]">Collections</h1>

        <p className="mt-2 text-sm text-[#918b8e]">Collections are not available yet.</p>

        <Link
          href="/"
          className="mt-4 inline-block rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#c9c5c6] transition hover:bg-[#161214]"
        >
          ← Back to requests
        </Link>
      </div>
    </main>
  );
}

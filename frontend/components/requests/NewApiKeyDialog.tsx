"use client";

import { useState } from "react";

import type { CreatedApiKey } from "@/components/requestsApi";
import { copyToClipboard } from "@/lib/clipboard";

type NewApiKeyDialogProps = {
  apiKey: CreatedApiKey | null;
  onClose: () => void;
};

export function NewApiKeyDialog({ apiKey, onClose }: NewApiKeyDialogProps) {
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopy() {
    if (!apiKey?.rawKey) return;

    try {
      await copyToClipboard(apiKey.rawKey);
      setCopiedKeyId(apiKey.id);
      setCopyError(null);
    } catch {
      setCopiedKeyId(null);
      setCopyError("Unable to copy the key automatically — select the key text and press Ctrl+C (or Cmd+C).");
    }
  }

  if (!apiKey) return null;

  const isCopied = copiedKeyId === apiKey.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-md border border-[#27272a] bg-[#1b1b1e] p-6 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-[#fafafa]">New API key generated</span>
          <span className="rounded border border-[#3f3f46] bg-[#27272a] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#e4e1e6]">
            One-time display
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-[#a1a1aa]">
          This is the only time the complete key is shown. Copy it now and store it securely.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            aria-label="API key"
            value={apiKey.rawKey}
            onClick={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-[#27272a] bg-[#0e0e11] px-3 py-2 font-mono text-xs text-[#fafafa] outline-none"
          />

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-md bg-[#fafafa] px-3 py-2 text-xs font-semibold text-[#09090b] transition hover:bg-white"
            >
              {isCopied ? "Copied" : "Copy key"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#27272a] px-3 py-2 text-xs text-[#d4d4d8] transition hover:bg-[#27272a] hover:text-[#fafafa]"
            >
              Done
            </button>
          </div>
        </div>

        {copyError && (
          <p role="alert" className="mt-3 text-xs text-red-400">
            {copyError}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import type { CreatedApiKey } from "@/components/requestsApi";

import { copyToClipboard } from "@/lib/clipboard";

type NewApiKeyDialogProps = {
  apiKey: CreatedApiKey | null;
  onClose: () => void;
};

/**
 * One-time dialog shown right after an API key is generated: displays the
 * complete raw key (available only at creation) and lets the user copy it.
 */
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
      setCopyError(
        "Unable to copy the key automatically — select the key text and press Ctrl+C (or Cmd+C).",
      );
    }
  }

  if (!apiKey) {
    return null;
  }

  const isCopied = copiedKeyId === apiKey.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[#302b2d] bg-[#100d0f] p-6 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-amber-300">Your new API key</span>

          <span className="rounded border border-amber-900/60 px-2 py-0.5 text-[9px] text-amber-300">
            Copy now
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-[#b5abad]">
          This is the only time the complete key is shown. Copy it now and store it
          securely — it cannot be retrieved later.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            aria-label="API key"
            value={apiKey.rawKey}
            onClick={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-[#40352c] bg-[#0c080a] px-3 py-2 font-mono text-xs text-[#eee4d5] outline-none"
          />

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-md border border-[#554431] px-3 py-1.5 text-xs text-amber-200 transition hover:bg-amber-950/30"
            >
              {isCopied ? "Copied!" : "Copy API key"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#d8d4d5] transition hover:bg-[#1a1618]"
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

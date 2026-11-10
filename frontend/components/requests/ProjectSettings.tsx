"use client";

import { useCallback, useEffect, useState } from "react";

import { createProjectApiKey, getProjectApiKeys, revokeProjectApiKey } from "../requestsApi";

import type { ApiKey, CreatedApiKey } from "../requestsApi";

type ProjectSettingsProps = {
  projectId: string;
  projectName: string;
  getToken: () => Promise<string | null>;
};

export function ProjectSettings({ projectId, projectName, getToken }: ProjectSettingsProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKey, setNewApiKey] = useState<CreatedApiKey | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load active API keys.
  const loadApiKeys = useCallback(async () => {
    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to obtain Clerk session token.");
      }

      const data = await getProjectApiKeys(projectId, token);

      setApiKeys(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId]);

  // Initial loading.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApiKeys();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadApiKeys]);

  // Refresh active keys.
  async function handleRefresh() {
    setLoading(true);
    await loadApiKeys();
  }

  // Generate a new API key.
  async function handleGenerateKey() {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setNewApiKey(null);
    setCopied(false);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to obtain Clerk session token.");
      }

      const createdKey = await createProjectApiKey(projectId, token);

      if (!createdKey?.rawKey) {
        throw new Error("The server did not return the generated API key. Check the API response.");
      }

      setNewApiKey(createdKey);
      setSuccess("API key generated successfully.");

      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key.");
    } finally {
      setGenerating(false);
    }
  }

  // Copy the original, unmasked API key.
  async function handleCopyKey() {
    const rawKey = newApiKey?.rawKey;

    if (!rawKey) {
      setError("API key is missing. Generate a new key.");
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rawKey);
      } else {
        const textarea = document.createElement("textarea");

        textarea.value = rawKey;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";

        document.body.appendChild(textarea);
        textarea.select();

        const successful = document.execCommand("copy");

        document.body.removeChild(textarea);

        if (!successful) {
          throw new Error("Clipboard copy failed.");
        }
      }

      setCopied(true);
      setError(null);
      setSuccess("API key copied to clipboard.");

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
      setError("Unable to copy the API key. Please try again.");
    }
  }

  // Revoke an API key.
  async function handleRevokeKey(keyId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to revoke this API key? Applications using it will no longer be able to send requests.",
    );

    if (!confirmed) return;

    setRevokingKeyId(keyId);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to obtain Clerk session token.");
      }

      await revokeProjectApiKey(projectId, keyId, token);

      setApiKeys((current) => current.filter((apiKey) => apiKey.id !== keyId));

      if (newApiKey?.id === keyId) {
        setNewApiKey(null);
      }

      setSuccess("API key revoked successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key.");
    } finally {
      setRevokingKeyId(null);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  return (
    <section className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl">
        {/* PROJECT HEADER */}
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-[#716b6e]">Project settings</p>

          <h2 className="mt-2 text-xl font-semibold text-[#f1eeee]">{projectName}</h2>

          <p className="mt-2 text-sm text-[#918b8e]">Manage credentials and SDK access for this project.</p>
        </div>

        {/* API KEYS CARD */}
        <div className="rounded-xl border border-[#302b2d] bg-[#100d0f] p-6">
          {/* CARD HEADER */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#f1eeee]">API Keys</h3>

              <p className="mt-1 text-xs text-[#918b8e]">Use API keys to authenticate SDK ingestion requests.</p>
            </div>

            <button
              type="button"
              onClick={handleGenerateKey}
              disabled={generating}
              className="rounded-md bg-[#e2dfe0] px-4 py-2 text-xs font-semibold text-[#171315] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generating..." : "+ Generate API key"}
            </button>
          </div>

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-400"
            >
              {error}
            </div>
          )}

          {/* SUCCESS */}
          {success && (
            <div
              role="status"
              className="mt-5 rounded-md border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-400"
            >
              {success}
            </div>
          )}

          {/* NEW API KEY */}
          {newApiKey && (
            <div className="mt-6 rounded-lg border border-amber-900/50 bg-amber-950/10 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-300">Your new API key</span>

                <span className="rounded border border-amber-900/60 px-2 py-0.5 text-[9px] text-amber-300">
                  Copy now
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-[#b5abad]">
                Your API key is masked for security. Copy it now and store it securely. The complete key cannot be
                retrieved later.
              </p>

              {/* MASKED KEY + COPY */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div
                  className="flex min-h-11 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-[#40352c] bg-[#0c080a] px-3"
                  aria-label="Masked API key"
                >
                  <code className="truncate font-mono text-sm tracking-[0.2em] text-[#eee4d5]">
                    {"•".repeat(Math.min(newApiKey.rawKey.length, 48))}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={handleCopyKey}
                  disabled={!newApiKey.rawKey}
                  className="shrink-0 rounded-md border border-[#554431] px-4 py-2 text-xs text-amber-200 transition hover:bg-amber-950/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copied ? "Copied!" : "Copy key"}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE API KEYS */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#d8d4d5]">Active keys</h4>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="text-[11px] text-[#918b8e] transition hover:text-white disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-xs text-[#716b6e]">Loading API keys...</p>
            ) : apiKeys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#302b2d] px-4 py-10 text-center">
                <p className="text-sm text-[#c9c5c6]">No active API keys</p>

                <p className="mt-2 text-xs text-[#716b6e]">Generate an API key to connect your application.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#302b2d]">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <code className="text-xs text-[#ddd6d8]">{apiKey.keyPrefix ?? "Unknown prefix"}...</code>

                      <p className="mt-1 text-[10px] text-[#716b6e]">Created {formatDate(apiKey.createdAt)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevokeKey(apiKey.id)}
                      disabled={revokingKeyId === apiKey.id}
                      className="self-start rounded-md border border-red-900/50 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-950/30 disabled:opacity-50 sm:self-auto"
                    >
                      {revokingKeyId === apiKey.id ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SDK INTEGRATION */}
        <div className="mt-6 rounded-xl border border-[#302b2d] bg-[#100d0f] p-5">
          <h3 className="text-sm font-semibold text-[#f1eeee]">SDK integration</h3>

          <p className="mt-2 text-xs leading-5 text-[#918b8e]">
            Your SDK should send the generated key using the <code className="text-[#ddd6d8]">x-devreplay-api-key</code>{" "}
            request header when sending captured traffic to DevReplay.
          </p>
        </div>
      </div>
    </section>
  );
}

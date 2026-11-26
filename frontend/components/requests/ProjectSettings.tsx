"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createProjectApiKey,
  getProjectApiKeys,
  revealProjectApiKey,
  revokeProjectApiKey,
  updateProjectReplayTarget,
} from "../requestsApi";
import { NewApiKeyDialog } from "./NewApiKeyDialog";
import { copyToClipboard } from "@/lib/clipboard";
import { rawKeyForKeyId } from "@/lib/apiKeys";
import type { ApiKey, CreatedApiKey } from "../requestsApi";

type ProjectSettingsProps = {
  projectId: string;
  projectName: string;
  getToken: () => Promise<string | null>;
};

type SettingsSection = "api-keys" | "replay-target" | "sdk";

function formatDate(date: string) {
  return new Date(date).toLocaleString();
}

export function ProjectSettings({ projectId, projectName, getToken }: ProjectSettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("api-keys");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKey, setNewApiKey] = useState<CreatedApiKey | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copyingKeyId, setCopyingKeyId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [replayBaseUrl, setReplayBaseUrl] = useState("");
  const [replaySaving, setReplaySaving] = useState(false);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Unable to obtain Clerk session token.");

      const data = await getProjectApiKeys(projectId, token);
      setApiKeys(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApiKeys();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadApiKeys]);

  async function handleRefresh() {
    setLoading(true);
    await loadApiKeys();
  }

  async function handleSaveReplayTarget() {
    setReplaySaving(true);
    setReplayMessage(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Unable to obtain Clerk session token.");
      await updateProjectReplayTarget(projectId, replayBaseUrl.trim() || null, token);
      setReplayMessage("Replay target saved.");
    } catch (err) {
      setReplayMessage(err instanceof Error ? err.message : "Failed to save replay target.");
    } finally {
      setReplaySaving(false);
    }
  }

  async function handleGenerateKey() {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setNewApiKey(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Unable to obtain Clerk session token.");

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

  async function handleCopyActiveKey(apiKey: ApiKey) {
    setCopyError(null);
    setCopyingKeyId(apiKey.id);

    try {
      let rawKey = rawKeyForKeyId(apiKey.id, newApiKey);

      if (!rawKey) {
        const token = await getToken();
        if (!token) throw new Error("Unable to obtain Clerk session token.");

        const revealed = await revealProjectApiKey(projectId, apiKey.id, token);
        rawKey = revealed.rawKey;
      }

      await copyToClipboard(rawKey);
      setCopiedKeyId(apiKey.id);
      window.setTimeout(() => {
        setCopiedKeyId((current) => (current === apiKey.id ? null : current));
      }, 2000);
    } catch (err) {
      setCopiedKeyId(null);
      setCopyError(err instanceof Error ? err.message : "Unable to copy the API key. Please try again.");
    } finally {
      setCopyingKeyId(null);
    }
  }

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
      if (!token) throw new Error("Unable to obtain Clerk session token.");

      await revokeProjectApiKey(projectId, keyId, token);
      setApiKeys((current) => current.filter((apiKey) => apiKey.id !== keyId));
      if (newApiKey?.id === keyId) setNewApiKey(null);
      setSuccess("API key revoked successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key.");
    } finally {
      setRevokingKeyId(null);
    }
  }

  const sectionButton = (id: SettingsSection, label: string) => {
    const active = activeSection === id;
    return (
      <button
        type="button"
        onClick={() => setActiveSection(id)}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "bg-[#fafafa] text-[#09090b]"
            : "text-[#a1a1aa] hover:bg-[#1f1f22] hover:text-[#fafafa]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <section className="devreplay-scrollbar flex-1 overflow-y-auto bg-[#131316]">
      <div className="border-b border-[#27272a] bg-[#0e0e11] px-8 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-1">
          {sectionButton("api-keys", "API Keys")}
          {sectionButton("replay-target", "Replay Target")}
          {sectionButton("sdk", "SDK Integration")}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-8 py-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#71717a]">Project settings</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#fafafa]">{projectName}</h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">Manage credentials and replay configuration for this project.</p>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-400">
            {success}
          </div>
        )}
        {copyError && (
          <div role="alert" className="rounded-md border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
            {copyError}
          </div>
        )}

        <NewApiKeyDialog apiKey={newApiKey} onClose={() => setNewApiKey(null)} />

        {activeSection === "api-keys" && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-[#fafafa]">API Keys</h3>
                  <span className="rounded border border-[#27272a] bg-[#1f1f22] px-2 py-0.5 font-mono text-[11px] text-[#a1a1aa]">
                    {apiKeys.length} {apiKeys.length === 1 ? "key" : "keys"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#a1a1aa]">
                  Manage project credentials used by the DevReplay SDK/ingest endpoint.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={loading}
                  className="rounded-md border border-[#27272a] px-3 py-2 text-xs text-[#d4d4d8] transition hover:bg-[#1f1f22] disabled:opacity-50"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateKey()}
                  disabled={generating}
                  className="rounded-md bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#09090b] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate API key"}
                </button>
              </div>
            </div>

            <div className="rounded-md border border-[#27272a] bg-[#1b1b1e]">
              <div className="flex items-center justify-between border-b border-[#27272a] px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#fafafa]">Active credentials</span>
                  <span className="font-mono text-[11px] text-[#71717a]">Project-scoped</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#131316] font-mono text-[11px] uppercase tracking-[0.12em] text-[#71717a]">
                      <th className="px-5 py-3 font-normal">Key</th>
                      <th className="px-5 py-3 font-normal">Created</th>
                      <th className="px-5 py-3 font-normal">Status</th>
                      <th className="px-5 py-3 font-normal text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a] text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-sm text-[#71717a]">
                          Loading API keys...
                        </td>
                      </tr>
                    ) : apiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center">
                          <p className="text-sm text-[#d4d4d8]">No active API keys</p>
                          <p className="mt-1 text-xs text-[#71717a]">Generate an API key to connect your application.</p>
                        </td>
                      </tr>
                    ) : (
                      apiKeys.map((apiKey) => {
                        const isCopied = copiedKeyId === apiKey.id;
                        const isCopying = copyingKeyId === apiKey.id;
                        const canReveal = apiKey.canReveal !== false;
                        return (
                          <tr key={apiKey.id} className="transition-colors hover:bg-[#1f1f22]/50">
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1">
                                <code className="font-mono text-xs text-[#e4e1e6]">
                                  {apiKey.keyPrefix ?? "Unknown prefix"}••••••••
                                </code>
                                {!canReveal && (
                                  <span className="text-[11px] text-amber-400">Legacy key — rotate by revoking and generating a new key.</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 font-mono text-[11px] text-[#a1a1aa]">{formatDate(apiKey.createdAt)}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${
                                canReveal
                                  ? "border-[#3f3f46] bg-[#27272a] text-[#e4e1e6]"
                                  : "border-amber-900/40 bg-amber-950/20 text-amber-400"
                              }`}>
                                {canReveal ? "Active" : "Legacy"}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleCopyActiveKey(apiKey)}
                                  disabled={isCopying}
                                  title={
                                    canReveal
                                      ? "Copy the complete API key"
                                      : "This legacy key cannot be revealed; revoke and generate a new key."
                                  }
                                  className="rounded-md border border-[#3f3f46] px-3 py-1.5 text-[11px] text-[#e4e1e6] transition hover:bg-[#27272a] disabled:opacity-50"
                                >
                                  {isCopied ? "Copied" : isCopying ? "Copying..." : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRevokeKey(apiKey.id)}
                                  disabled={revokingKeyId === apiKey.id}
                                  className="rounded-md border border-red-900/40 px-3 py-1.5 text-[11px] text-red-400 transition hover:bg-red-950/20 disabled:opacity-50"
                                >
                                  {revokingKeyId === apiKey.id ? "Revoking..." : "Revoke"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "replay-target" && (
          <section className="flex flex-col gap-5">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[#fafafa]">Replay Target</h3>
              <p className="mt-1 text-sm text-[#a1a1aa]">Configure where captured requests are replayed for this project.</p>
            </div>

            <div className="rounded-md border border-[#27272a] bg-[#1b1b1e] p-6">
              <label htmlFor="replay-target" className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#71717a]">
                Default target base URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="replay-target"
                  type="url"
                  value={replayBaseUrl}
                  onChange={(e) => setReplayBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className="h-10 min-w-0 flex-1 rounded-md border border-[#27272a] bg-[#0e0e11] px-3 font-mono text-xs text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#52525b]"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveReplayTarget()}
                  disabled={replaySaving}
                  className="rounded-md bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#09090b] transition hover:bg-white disabled:opacity-50"
                >
                  {replaySaving ? "Saving..." : "Save target"}
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#71717a]">
                Must be an absolute HTTP(S) URL. DevReplay replays captured requests against this base URL.
              </p>
              {replayMessage && <p className="mt-3 text-xs text-[#a1a1aa]">{replayMessage}</p>}
            </div>
          </section>
        )}

        {activeSection === "sdk" && (
          <section className="flex flex-col gap-5">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[#fafafa]">SDK Integration</h3>
              <p className="mt-1 text-sm text-[#a1a1aa]">Send captured traffic to DevReplay using your project API key.</p>
            </div>

            <div className="overflow-hidden rounded-md border border-[#27272a] bg-[#1b1b1e]">
              <div className="flex items-center justify-between border-b border-[#27272a] bg-[#18181b] px-4 py-2.5">
                <span className="font-mono text-[11px] text-[#a1a1aa]">Ingest request header</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#71717a]">HTTP</span>
              </div>
              <div className="bg-[#0e0e11] p-5 font-mono text-xs leading-6 text-[#d4d4d8]">
                <div><span className="text-[#71717a]"># Send captured requests to DevReplay ingest</span></div>
                <div><span className="text-[#fafafa]">POST</span> /ingest</div>
                <div><span className="text-[#a1a1aa]">x-devreplay-api-key:</span> <span className="text-[#fafafa]">&lt;your-api-key&gt;</span></div>
                <div className="mt-4 text-[#71717a]"># Use the generated project key in the x-devreplay-api-key header.</div>
                <div className="text-[#71717a]"># Keep the key secret; do not expose it in client-side code.</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

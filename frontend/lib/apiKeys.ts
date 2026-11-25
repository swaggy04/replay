import type { CreatedApiKey } from "@/components/requestsApi";

/**
 * The raw secret is available only while the just-created key is still in
 * state — the backend returns it once, at creation. List entries have no
 * copyable secret, so this returns undefined for them and for the masked
 * display of any previously listed key.
 */
export function rawKeyForKeyId(
  apiKeyId: string,
  newApiKey: CreatedApiKey | null,
): string | undefined {
  return newApiKey && newApiKey.id === apiKeyId ? newApiKey.rawKey : undefined;
}

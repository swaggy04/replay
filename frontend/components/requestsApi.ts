
import type {
  Project,
  RequestDetails,
  RequestsResponse,
  ReplayComparison,
} from "@/types/request";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function authenticatedFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
        ? data.message
        : `API request failed (${response.status})`;

    throw new Error(message);
  }

  return data as T;
}

// API key metadata.
export type ApiKey = {
  id: string;
  keyPrefix: string | null;
  createdAt: string;
};

// Returned only when a new key is generated.
export type CreatedApiKey = ApiKey & {
  projectId: string;
  rawKey: string;
};

// --------------------------------------------------
// PROJECTS
// --------------------------------------------------

export async function getProjects(token: string): Promise<Project[]> {
  return authenticatedFetch<Project[]>("/projects", token);
}

export async function createProject(
  name: string,
  token: string,
): Promise<Project> {
  return authenticatedFetch<Project>("/projects", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateProjectReplayTarget(
  projectId: string,
  replayBaseUrl: string | null,
  token: string,
): Promise<Project> {
  return authenticatedFetch<Project>(
    `/projects/${encodeURIComponent(projectId)}/replay-target`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ replayBaseUrl }),
    },
  );
}

// --------------------------------------------------
// REQUESTS
// --------------------------------------------------

export async function getRequests(
  page: number,
  projectId: string,
  token: string,
): Promise<RequestsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: "10",
    projectId,
  });

  return authenticatedFetch<RequestsResponse>(
    `/requests?${params.toString()}`,
    token,
  );
}

export async function getRequestDetails(
  id: string,
  token: string,
): Promise<RequestDetails> {
  return authenticatedFetch<RequestDetails>(
    `/requests/${encodeURIComponent(id)}`,
    token,
  );
}

// --------------------------------------------------
// REPLAYS
// --------------------------------------------------

export async function replayRequest(id: string, token: string) {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(
    `${API_URL}/replay/${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => null);

  // A replay can legitimately return a non-2xx status.
  if (response.status === 500 && data?.message) {
    throw new Error(data.message);
  }

  if (!response.ok && response.status !== 500) {
    throw new Error(
      data?.message || `Replay request failed (${response.status})`,
    );
  }

  return data;
}

export async function requestComparison(
  requestId: string,
  replayId: string,
  token: string,
): Promise<ReplayComparison> {
  return authenticatedFetch<ReplayComparison>(
    `/requests/${encodeURIComponent(requestId)}/compare/${encodeURIComponent(replayId)}`,
    token,
  );
}

// --------------------------------------------------
// PROJECT API KEYS
// --------------------------------------------------

export async function getProjectApiKeys(
  projectId: string,
  token: string,
): Promise<ApiKey[]> {
  return authenticatedFetch<ApiKey[]>(
    `/projects/${encodeURIComponent(projectId)}/api-keys`,
    token,
  );
}

export async function createProjectApiKey(
  projectId: string,
  token: string,
): Promise<CreatedApiKey> {
  const response = await authenticatedFetch<{
    message: string;
    apiKey: CreatedApiKey;
  }>(
    `/projects/${encodeURIComponent(projectId)}/api-keys`,
    token,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  if (!response.apiKey?.rawKey) {
    throw new Error(
      "API key was created, but the server did not return its secret.",
    );
  }

  return response.apiKey;
}

export async function revokeProjectApiKey(
  projectId: string,
  keyId: string,
  token: string,
) {
  return authenticatedFetch<{ message: string }>(
    `/projects/${encodeURIComponent(projectId)}/api-keys/${encodeURIComponent(keyId)}`,
    token,
    {
      method: "DELETE",
    },
  );
}

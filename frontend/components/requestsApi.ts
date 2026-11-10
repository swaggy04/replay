const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function authenticatedFetch(path: string, token: string, options: RequestInit = {}) {
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

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(error?.message || `API request failed (${response.status})`);
  }

  return response.json();
}

export async function getProjects(token: string) {
  return authenticatedFetch("/projects", token);
}
export async function createProject(name: string, token: string) {
  return authenticatedFetch("/projects", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getRequests(page: number, projectId: string, token: string) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "10",
    projectId,
  });

  return authenticatedFetch(`/requests?${params.toString()}`, token);
}

export async function getRequestDetails(id: string, token: string) {
  return authenticatedFetch(`/requests/${encodeURIComponent(id)}`, token);
}

export async function replayRequest(id: string, token: string) {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(`${API_URL}/replay/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  // A replay can legitimately return a non-2xx status,
  // for example, when the original request returned 404.
  if (response.status === 500 && data?.message) {
    throw new Error(data.message);
  }

  if (!response.ok && response.status !== 500) {
    throw new Error(data?.message || `Replay request failed (${response.status})`);
  }

  return data;
}

export async function requestComparison(requestId: string, replayId: string, token: string) {
  return authenticatedFetch(
    `/requests/${encodeURIComponent(requestId)}/compare/${encodeURIComponent(replayId)}`,
    token,
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getProjects() {
  const response = await fetch(`${API_URL}/projects`);

  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }

  return response.json();
}

export async function getRequests(page: number, projectId: string) {
  const response = await fetch(`${API_URL}/requests?page=${page}&limit=10&projectId=${projectId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch requests");
  }

  return response.json();
}

export async function getRequestDetails(id: string) {
  const response = await fetch(`${API_URL}/requests/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch requests");
  }

  return response.json();
}

export async function replayRequest(id: string) {
  const response = await fetch(`${API_URL}/replay/${id}`, {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Replay request failed");
  }

  return data;
}

export async function requestComparison(requestId: string, replayId: string) {
  const response = await fetch(`${API_URL}/requests/${requestId}/compare/${replayId}`);

  if (!response.ok) {
    throw new Error("Failed to compare replay");
  }

  return response.json();
}

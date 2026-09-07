export async function getRequests(page: number) {
  const response = await fetch(`http://localhost:5000/requests?page=${page}&limit=10`);

  if (!response.ok) {
    throw new Error("Failed to fetch requests");
  }

  return response.json();
}

export async function getRequestDetails(id: string) {
  const response = await fetch(`http://localhost:5000/requests/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch requests");
  }

  return response.json();
}

export async function replayRequest(id: string) {
  const response = await fetch(`http://localhost:5000/replay/${id}`, {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Replay request failed");
  }

  return data;
}

export async function requestComparison(requestId: string, replayId: string) {
  const response = await fetch(`http://localhost:5000/requests/${requestId}/compare/${replayId}`);

  if (!response.ok) {
    throw new Error("Failed to compare replay");
  }

  return response.json();
}

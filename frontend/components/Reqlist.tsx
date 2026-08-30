"use client";

import { useEffect, useState } from "react";

type RequestLog = {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
};

type RequestsResponse = {
  data: RequestLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function RequestList() {
  const [requests, setRequests] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const response = await fetch("http://localhost:3000/requests?page=1&limit=5");

        const data: RequestsResponse = await response.json();

        setRequests(data.data);
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, []);

  if (loading) {
    return <p>Loading requests...</p>;
  }

  return (
    <div>
      {requests.map((request) => (
        <div key={request.id}>
          <span>{request.method}</span>
          <span>{request.path}</span>
          <span>{request.statusCode}</span>
          <span>{request.durationMs}ms</span>
        </div>
      ))}
    </div>
  );
}

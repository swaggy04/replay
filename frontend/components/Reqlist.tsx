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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchRequests() {
      try {
        const response = await fetch(`http://localhost:3000/requests?page=${page}&limit=5`);
        const data: RequestsResponse = await response.json();

        setRequests(data.data);
        setTotalPages(data.totalPages);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, [page]);
  if (loading) {
    return <div>Loading requests...</div>;
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
      <div>
        <button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

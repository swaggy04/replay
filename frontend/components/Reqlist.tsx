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

type RequestDetails = RequestLog & {
  body: unknown;
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  responseBody: unknown;
  replays: unknown[];
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

  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  async function handleSelectRequest(request: RequestLog) {
    setDetailsLoading(true);
    setRequestDetails(null);

    try {
      const response = await fetch(`http://localhost:3000/requests/${request.id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch request details");
      }

      const data: RequestDetails = await response.json();

      setRequestDetails(data);
    } catch (error) {
      console.error(error);
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => {
    async function fetchRequests() {
      setLoading(true);

      try {
        const response = await fetch(`http://localhost:3000/requests?page=${page}&limit=5`);

        if (!response.ok) {
          throw new Error("Failed to fetch requests");
        }

        const data: RequestsResponse = await response.json();

        setRequests(data.data);
        setTotalPages(data.totalPages);
      } catch (error) {
        console.error(error);
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
      {/* Request list */}
      <div>
        {requests.map((request) => (
          <div key={request.id} onClick={() => handleSelectRequest(request)}>
            <span>{request.method}</span>
            <span>{request.path}</span>
            <span>{request.statusCode}</span>
            <span>{request.durationMs}ms</span>
          </div>
        ))}
      </div>

      {/* Request details loading */}
      {detailsLoading && <div>Loading details...</div>}

      {/* Request details */}
      {requestDetails && !detailsLoading && (
        <div>
          <h3>Request Details</h3>

          <p>Method: {requestDetails.method}</p>

          <p>Path: {requestDetails.path}</p>

          <p>Status: {requestDetails.statusCode}</p>

          <p>Duration: {requestDetails.durationMs}ms</p>

          <p>Created: {requestDetails.createdAt}</p>

          <h4>Body</h4>
          <pre>{JSON.stringify(requestDetails.body, null, 2)}</pre>

          <h4>Query</h4>
          <pre>{JSON.stringify(requestDetails.query, null, 2)}</pre>

          <h4>Headers</h4>
          <pre>{JSON.stringify(requestDetails.headers, null, 2)}</pre>

          <h4>Response</h4>
          <pre>{JSON.stringify(requestDetails.responseBody, null, 2)}</pre>
        </div>
      )}

      {/* Pagination */}
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

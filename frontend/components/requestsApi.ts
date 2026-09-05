

export async function getRequests(page: number) {
  const response = await fetch(
    `http://localhost:5000/requests?page=${page}&limit=10`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch requests");
  }

  return response.json();
}

export async function getRequestDetails(id:string){
 const response = await fetch(`http://localhost:5000/requests/${id}`);
 if (!response.ok) {
    throw new Error("Failed to fetch requests");
  }

  return response.json();

}
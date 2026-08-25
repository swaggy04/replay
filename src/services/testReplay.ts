import { replayService } from "./replayService.js";

async function testReplay() {
  const replay = await replayService("cmt8hbssu0000ocblnrv1cxwq");

  if (!replay) {
    console.log("Request not found");
    return;
  }

  console.log("Replaying:", replay);

  const response = await fetch(replay.url, {
    method: replay.method,
    headers: (replay.headers ?? {}) as Record<string, string>,
    body: replay.body,
  });

  console.log("Replay status:", response.status);

  const result = await response.text();

  console.log("Replay response:", result);
}

testReplay();

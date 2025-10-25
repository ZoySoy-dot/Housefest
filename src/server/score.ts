// src/server/score.ts
"use server";

import Pusher from "pusher";

let currentScore = 0;

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.VITE_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.VITE_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function getScore() {
  "use server";
  console.log("[SERVER] Getting score:", currentScore);
  return currentScore;
}

export async function incrementScore(amount: number) {
  "use server";
  currentScore += amount;
  console.log("[SERVER] Incremented score to:", currentScore);
  
  await pusher.trigger("score-channel", "score-update", {
    score: currentScore,
  });
  console.log("[SERVER] Pusher event triggered");
  
  return currentScore;
}

export async function decrementScore(amount: number) {
  "use server";
  currentScore -= amount;
  console.log("[SERVER] Decremented score to:", currentScore);
  
  await pusher.trigger("score-channel", "score-update", {
    score: currentScore,
  });
  console.log("[SERVER] Pusher event triggered");
  
  return currentScore;
}

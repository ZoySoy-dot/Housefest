// /src/routes/index.tsx
import { Title } from "@solidjs/meta";
import { createSignal, onMount, onCleanup } from "solid-js";
import Pusher from "pusher-js";
import "./index.css";

import { getScore, incrementScore, decrementScore } from "../server/score";

export default function Home() {
  console.log("[HOME] Component loading");
  const [score, setScore] = createSignal(0);

  onMount(async () => {
    console.log("[MOUNT] Started");
    
    console.log("[ENV] PUSHER_KEY:", import.meta.env.VITE_PUSHER_KEY);
    console.log("[ENV] PUSHER_CLUSTER:", import.meta.env.VITE_PUSHER_CLUSTER);
    
    try {
      console.log("[SCORE] Fetching initial score...");
      const initialScore = await getScore();
      console.log("[SCORE] Initial score:", initialScore);
      setScore(initialScore);
    } catch (error) {
      console.error("[ERROR] Fetching score:", error);
    }

    try {
      console.log("[PUSHER] Creating instance...");
      const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
        cluster: import.meta.env.VITE_PUSHER_CLUSTER,
      });
      console.log("[PUSHER] Instance created");

      pusher.connection.bind('connected', () => {
        console.log("[PUSHER] Connected");
      });

      pusher.connection.bind('error', (err: any) => {
        console.error("[PUSHER ERROR]:", err);
      });

      const channel = pusher.subscribe("score-channel");
      console.log("[CHANNEL] Subscribed to score-channel");

      channel.bind('pusher:subscription_succeeded', () => {
        console.log("[CHANNEL] Subscription successful");
      });

      channel.bind("score-update", (data: { score: number }) => {
        console.log("[EVENT] Received score update");
        console.log("[EVENT] New score:", data.score);
        setScore(data.score);
      });

      onCleanup(() => {
        pusher.unsubscribe("score-channel");
        pusher.disconnect();
      });
    } catch (error) {
      console.error("[ERROR] Pusher setup:", error);
    }
  });

  const handleIncrement = async () => {
    console.log("[ACTION] Increment button clicked");
    try {
      const result = await incrementScore(1);
      console.log("[RESULT] Server returned:", result);
    } catch (error) {
      console.error("[ERROR] Increment:", error);
    }
  };

  const handleDecrement = async () => {
    console.log("[ACTION] Decrement button clicked");
    try {
      await decrementScore(1);
    } catch (error) {
      console.error("[ERROR] Decrement:", error);
    }
  };

  return (
    <main>
      <Title>DLSU Housefest</Title>
      <h1>DLSU Housefest Feed</h1>
      
      <div class="score-display">
        <p>Current Score: {score()}</p>
      </div>

      <div class="admin-controls">
        <button onClick={handleIncrement}>+1 Point</button>
        <button onClick={handleDecrement}>-1 Point</button>
      </div>
    </main>
  );
}

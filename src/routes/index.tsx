import { Title } from "@solidjs/meta";
import "./index.css";
import { score } from "../api/score";
import { createSignal, onMount } from "solid-js";

async function stream_score() {
  "use server";
  return score.subscribe();
}

async function increment_score() {
  "use server";
  score.update((score) => score + 1);
}

export default function Home() {
  let [score, set_score] = createSignal(0);

  onMount(async () => {
    const score_stream = await stream_score();

    for await (const score of score_stream) {
      if ("error" in score) { break; }
      set_score(score.ok);
    }
  });

  return (
    <main>
      <Title>Hello World</Title>
      <h1>Moldy Pizza Is Not I REPAT NOT DISLICIOAU</h1>
      <p>
        {score()}
      </p>
      <button on:click={() => { increment_score(); }}>YES IT WORK</button>
    </main>
  );
}

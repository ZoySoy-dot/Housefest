import { Title } from "@solidjs/meta";
import "./index.css";
import { score } from "../api/score";
import { createSignal, onMount } from "solid-js";

async function stream_score() {
  "use server";
  return score.subscribe();
}

async function increment_score(how_much : number) {
  "use server";
  score.update((score) => score + how_much);
}
async function decrement_score(how_much : number){
  "use server";
  score.update((score) => score - how_much)
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
      <Title>DLSU Housefest</Title>
      <h1>DLSU Housefest Feed</h1>
      <p>
        {score()}
      </p>
      <button on:click={() => { increment_score(1); }}>YES IT WORK</button>
      <button on:click={() => { decrement_score(1);}}>DOES IT REALLY THO</button>
    </main>
  );
}

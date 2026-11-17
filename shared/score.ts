export type Mark = "c" | "p" | "a";
export function score(guess: string, answer: string): string {
  const r: Mark[] = Array(5).fill("a");
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) r[i] = "c";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) if (r[i] === "a" && (left[guess[i]] ?? 0) > 0) { r[i] = "p"; left[guess[i]]--; }
  return r.join("");
}
export interface PlayerView {
  id: string; name: string; marks: string[]; letters?: string[]; done: boolean; won: boolean; online: boolean;
}
export interface StateMsg { t: "state"; you: string; round: number; maxTries: number; players: PlayerView[]; answer?: string }
export type ServerMsg = StateMsg | { t: "error"; msg: string };
export type ClientMsg = { t: "join"; id: string; name: string } | { t: "guess"; word: string } | { t: "next" };

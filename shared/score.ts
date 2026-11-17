export type Mark = "c" | "p" | "a";

/** Score a guess against the answer: c = right spot, p = in the word, a = not in the word. Handles repeated letters. */
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

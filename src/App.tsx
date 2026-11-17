import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { score } from "../shared/score";
import { DESC_COST, LETTER_COST, MAX_TRIES, PER_DAY, POINTS, msUntilReset, today, wordsForDay } from "../shared/daily";
import { HINTS } from "../shared/words";

const KB = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const KEY = "wl-daily-v1";

interface Clue { letters: number[]; desc: boolean }
interface Progress { date: string; idx: number; guesses: string[][]; clues: Record<number, Clue> }

const spentOn = (c?: Clue) => (c ? c.letters.length * LETTER_COST + (c.desc ? DESC_COST : 0) : 0);
const spentTotal = (clues: Record<number, Clue>) => Object.values(clues).reduce((n, c) => n + spentOn(c), 0);

function cleanClues(raw: unknown): Record<number, Clue> {
  const out: Record<number, Clue> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, Clue>)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= PER_DAY || !v || !Array.isArray(v.letters)) continue;
      const letters = [...new Set(v.letters.filter((n) => Number.isInteger(n) && n >= 0 && n < 5))];
      out[i] = { letters, desc: v.desc === true };
    }
  }
  return spentTotal(out) <= POINTS ? out : {};
}

// Today's 10 words (same for everyone) plus this browser's saved progress for today.
function load(): { words: string[]; prog: Progress } {
  const t = today();
  const words = wordsForDay(t.day);
  let prog: Progress = { date: t.date, idx: 0, guesses: [], clues: {} };
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const ok = p && p.date === t.date && Number.isInteger(p.idx) && p.idx >= 0 && p.idx <= PER_DAY &&
      Array.isArray(p.guesses) && p.guesses.length <= PER_DAY &&
      p.guesses.every((g: unknown) => Array.isArray(g) && g.length <= MAX_TRIES && g.every((w) => typeof w === "string" && /^[a-zñ]{5}$/.test(w)));
    if (ok) prog = { date: p.date, idx: p.idx, guesses: p.guesses, clues: cleanClues(p.clues) };
  } catch { /* start fresh */ }
  return { words, prog };
}

const finished = (g: string[] | undefined, answer: string | undefined) => !!g && !!answer && (g.includes(answer) || g.length >= MAX_TRIES);

// The "o" in Wrdlilo: an original Ati-Atihan style mask with a fanned headdress.
function MaskO() {
  const colors = ["#17a3a8", "#f4b81c", "#e03b24"];
  const fan = (r: number, n: number, from: number, step: number, half: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = from + i * step, p = (deg: number, rad: number) => [50 + Math.sin((deg * Math.PI) / 180) * rad, 60 - Math.cos((deg * Math.PI) / 180) * rad];
      const [x1, y1] = p(a - half, r), [x2, y2] = p(a + half, r), [tx, ty] = p(a, r + 4);
      return <path key={r + "-" + i} d={`M50 60 L${x1} ${y1} Q${tx} ${ty} ${x2} ${y2} Z`} fill={colors[(i + (r > 40 ? 0 : 1)) % 3]} />;
    });
  return (
    <svg className="maskO" viewBox="0 0 100 110" role="img" aria-hidden="true">
      {fan(46, 7, -72, 24, 11.5)}
      {fan(33, 6, -60, 24, 11.5)}
      <path d="M19 52 Q50 26 81 52 L76 88 Q50 116 24 88 Z" fill="#0b0806" stroke="#f4b81c" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="11" fill="#e03b24" stroke="#fff" strokeWidth="2.5" strokeDasharray="3 2.2" />
      <path d="M27 66 L46 66 L36.5 81 Z M54 66 L73 66 L63.5 81 Z" fill="#fff" />
      <path d="M27 85 L37 85 L32 96 Z M63 85 L73 85 L68 96 Z" fill="#fff" />
      <path d="M42 92 Q50 100 58 92 Q50 97 42 92 Z" fill="#e03b24" stroke="#e03b24" strokeWidth="2" />
    </svg>
  );
}

function Logo({ small }: { small?: boolean }) {
  return <h1 className={"logo" + (small ? " sm" : "")} aria-label="Wrdlilo">Wrdlil<MaskO /></h1>;
}

export default function App() {
  const [{ words, prog }, setState] = useState(load);
  const [cur, setCur] = useState("");
  const [toast, setToast] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const prevRows = useRef(-1);
  const prevIdx = useRef(-1);
  const prevCur = useRef("");

  const setProg = (f: (p: Progress) => Progress) => setState((s) => ({ ...s, prog: f(s.prog) }));
  const say = (s: string) => { setToast(s); setTimeout(() => setToast(""), 1600); };

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch { /* ignore */ } }, [prog]);
  // A new day (midnight Manila) swaps in the new 10 words, even if the page was left open.
  useEffect(() => {
    const t = setInterval(() => { if (today().date !== prog.date) { setCur(""); setState(load()); } }, 15000);
    return () => clearInterval(t);
  }, [prog.date]);

  const idx = prog.idx;
  const over = idx >= PER_DAY;
  const answer = words[idx];
  const g = useMemo(() => prog.guesses[idx] ?? [], [prog.guesses, idx]);
  const marks = useMemo(() => g.map((x) => score(x, answer ?? "")), [g, answer]);
  const won = !!answer && g.includes(answer);
  const done = finished(g, answer);

  const clue = prog.clues[idx] ?? { letters: [], desc: false };
  const left = POINTS - spentTotal(prog.clues);
  const canLetter = !done && !over && left >= LETTER_COST && clue.letters.length < 5;
  const canDesc = !done && !over && left >= DESC_COST && !clue.desc;

  function revealLetter() {
    if (!canLetter) return;
    const lastMarks = marks[marks.length - 1];
    const free = [0, 1, 2, 3, 4].filter((i) => !clue.letters.includes(i));
    const useful = free.filter((i) => lastMarks?.[i] !== "c"); // prefer a spot you have not already got right
    const pool = useful.length ? useful : free;
    const pos = pool[Math.floor(Math.random() * pool.length)];
    setProg((p) => {
      const c = p.clues[p.idx] ?? { letters: [], desc: false };
      if (spentTotal(p.clues) + LETTER_COST > POINTS || c.letters.includes(pos)) return p;
      return { ...p, clues: { ...p.clues, [p.idx]: { ...c, letters: [...c.letters, pos] } } };
    });
  }
  function showDescription() {
    if (!canDesc) return;
    setProg((p) => {
      const c = p.clues[p.idx] ?? { letters: [], desc: false };
      if (c.desc || spentTotal(p.clues) + DESC_COST > POINTS) return p;
      return { ...p, clues: { ...p.clues, [p.idx]: { ...c, desc: true } } };
    });
  }

  function shake() {
    const r = boardRef.current?.querySelector<HTMLElement>(".row.cur");
    if (r) gsap.fromTo(r, { x: -8 }, { x: 0, duration: 0.4, ease: "elastic.out(6,0.3)" });
  }

  // drum-pop reveal when a guess lands; confetti on a win
  useLayoutEffect(() => {
    if (prevRows.current === -1 || prevIdx.current !== idx) { prevIdx.current = idx; prevRows.current = g.length; return; }
    if (g.length > prevRows.current) {
      const tiles = boardRef.current?.querySelectorAll<HTMLElement>(`.row[data-r="${g.length - 1}"] .tile`);
      if (tiles) gsap.fromTo(tiles, { scale: 1.3, y: -6 }, { scale: 1, y: 0, duration: 0.45, stagger: 0.09, ease: "back.out(3)" });
      if (won) burst();
    }
    prevRows.current = g.length;
  }, [idx, g.length, won]);

  const press = useCallback((k: string) => {
    if (over || done) return;
    if (k === "enter") {
      if (cur.length !== 5) { say("Not enough letters"); shake(); return; }
      const word = cur;
      setCur("");
      setProg((p) => {
        const guesses = p.guesses.map((x) => [...x]);
        while (guesses.length <= p.idx) guesses.push([]);
        if (guesses[p.idx].length < MAX_TRIES) guesses[p.idx].push(word);
        return { ...p, guesses };
      });
    } else if (k === "back") setCur((c) => c.slice(0, -1));
    else if (/^[a-zñ]$/.test(k)) setCur((c) => (c.length < 5 ? c + k : c));
  }, [over, done, cur]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement)?.tagName === "BUTTON" && e.key === "Enter") return;
      const k = e.key.toLowerCase();
      if (k === "enter") press("enter"); else if (k === "backspace") press("back"); else if (k.length === 1) press(k);
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [press]);

  const keyState = useMemo(() => {
    const o: Record<string, string> = {}; const rank: Record<string, number> = { a: 0, p: 1, c: 2 };
    g.forEach((w, gi) => [...w].forEach((ch, i) => { const s = marks[gi][i]; if (o[ch] === undefined || rank[s] > rank[o[ch]]) o[ch] = s; }));
    return o;
  }, [g, marks]);

  useLayoutEffect(() => {
    const prev = prevCur.current; prevCur.current = cur;
    if (cur.length === prev.length + 1 && cur.startsWith(prev)) flyLetter(cur[cur.length - 1], cur.length - 1);
  }, [cur]);

  // letter lifts off its key and arcs into the tile, trailing Dinagyang colors
  function flyLetter(ch: string, i: number) {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const tile = boardRef.current?.querySelector<HTMLElement>(`.row.cur .tile:nth-child(${i + 1})`);
    const key = document.querySelector<HTMLElement>(`.key[data-k="${ch}"]`);
    if (!tile || !key) return;
    const a = key.getBoundingClientRect(), b = tile.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
    const el = document.createElement("div"); el.className = "fly"; el.textContent = ch; document.body.appendChild(el);
    tile.classList.add("hide");
    const colors = ["#e03b24", "#f4b81c", "#17a3a8"]; let n = 0;
    const arc = Math.min(90, Math.hypot(ex - sx, ey - sy) * 0.35);
    const o = { p: 0 };
    const spark = (x: number, y: number, c: string) => {
      const d = document.createElement("i"); d.className = "spark"; d.style.background = c; d.style.left = x + "px"; d.style.top = y + "px";
      document.body.appendChild(d); return d;
    };
    gsap.set(el, { xPercent: -50, yPercent: -50, left: sx, top: sy, scale: 0.8 });
    gsap.to(o, {
      p: 1, duration: 0.36, ease: "power2.in",
      onUpdate: () => {
        const x = sx + (ex - sx) * o.p, y = sy + (ey - sy) * o.p - Math.sin(Math.PI * o.p) * arc;
        gsap.set(el, { left: x, top: y, scale: 0.8 + o.p * 0.5, rotation: o.p * 360 });
        const d = spark(x, y, colors[n++ % 3]);
        gsap.to(d, { scale: 0, opacity: 0, x: gsap.utils.random(-8, 8), y: gsap.utils.random(-8, 8), duration: 0.5, ease: "power1.out", onComplete: () => d.remove() });
      },
      onComplete: () => {
        el.remove(); tile.classList.remove("hide");
        gsap.fromTo(tile, { scale: 1.3 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
        for (let j = 0; j < 6; j++) {
          const s = spark(ex, ey, colors[j % 3]);
          gsap.to(s, { x: gsap.utils.random(-28, 28), y: gsap.utils.random(-28, 28), scale: 0, opacity: 0, duration: 0.4, ease: "power2.out", onComplete: () => s.remove() });
        }
      },
    });
  }

  function burst() {
    const root = document.getElementById("confetti"); if (!root) return;
    for (let i = 0; i < 40; i++) {
      const d = document.createElement("i"); d.style.background = ["#f4b81c", "#e03b24", "#17a3a8"][i % 3]; root.appendChild(d);
      gsap.fromTo(d, { x: 0, y: 0, opacity: 1 }, { x: gsap.utils.random(-180, 180), y: gsap.utils.random(-260, -40), rotation: gsap.utils.random(-300, 300), opacity: 0, duration: 1.2, ease: "power2.out", onComplete: () => d.remove() });
    }
  }

  if (over) return <Summary words={words} prog={prog} />;

  return (
    <main className="page game"><div className="stage">
      <header className="top">
        <Logo small />
        <div className="roombar"><span>Word {idx + 1} of {PER_DAY} · Clue points <b>{left}</b>/{POINTS}</span></div>
        <div className="pips" aria-hidden="true">
          {Array.from({ length: PER_DAY }, (_, i) => {
            const gg = prog.guesses[i], w = words[i];
            const cls = finished(gg, w) ? (gg!.includes(w) ? "c" : "x") : i === idx ? "cur" : "";
            return <span key={i} className={"pip " + cls} />;
          })}
        </div>
      </header>

      <section className="me">
        <div className="board" ref={boardRef}>
          {Array.from({ length: MAX_TRIES }, (_, r) => {
            const typing = r === g.length && !done;
            const letters = g[r] ?? (typing ? cur : "");
            return (
              <div key={r} data-r={r} className={"row" + (typing ? " cur" : "")}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={"tile " + (marks[r]?.[i] ?? (letters[i] ? "f" : ""))}>{letters[i] ?? ""}</div>
                ))}
              </div>
            );
          })}
          <div id="confetti" />
        </div>

        {(clue.letters.length > 0 || clue.desc) && (
          <div className="clue">
            {clue.letters.length > 0 && (
              <div className="hint-letters" aria-label="Revealed letters">
                {[0, 1, 2, 3, 4].map((i) => <span key={i} className="hl">{clue.letters.includes(i) ? answer[i] : ""}</span>)}
              </div>
            )}
            {clue.desc && <p className="desc">{HINTS[answer]}</p>}
          </div>
        )}

        {!done && (
          <div className="clues">
            <button className="cbtn" disabled={!canLetter} onClick={revealLetter}>Reveal a letter · {LETTER_COST} pt</button>
            <button className="cbtn" disabled={!canDesc} onClick={showDescription}>Description · {DESC_COST} pts</button>
          </div>
        )}

        {done ? (
          <div className="end">
            <p>{won ? `You got it in ${g.length}!` : "Out of tries."} The word: <b className="ans">{answer}</b></p>
            <button className="go" onClick={() => { setCur(""); setProg((p) => ({ ...p, idx: p.idx + 1 })); }}>
              {idx === PER_DAY - 1 ? "See results" : "Next word"}
            </button>
          </div>
        ) : (
          <div className="kb">
            {KB.map((row, ri) => (
              <div key={ri}>
                {ri === 2 && <button className="key wide" onClick={() => press("enter")}>Enter</button>}
                {[...row].map((k) => <button key={k} data-k={k} className={"key " + (keyState[k] ?? "")} onClick={() => press(k)}>{k}</button>)}
                {ri === 2 && <button className="key wide" onClick={() => press("back")}>⌫</button>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>{toast && <div className="toast">{toast}</div>}</main>
  );
}

const EMOJI: Record<string, string> = { c: "🟩", p: "🟨", a: "⬛" };

function Summary({ words, prog }: { words: string[]; prog: Progress }) {
  const [left, setLeft] = useState(msUntilReset());
  const [copied, setCopied] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      const ms = msUntilReset();
      setLeft(ms);
      if (today().date !== prog.date) location.reload();
    }, 1000);
    return () => clearInterval(t);
  }, [prog.date]);

  const rows = words.map((w, i) => {
    const gg = prog.guesses[i] ?? [];
    const solved = gg.includes(w);
    const last = gg.length ? score(gg[gg.length - 1], w) : "aaaaa";
    return { w, solved, tries: gg.length, last };
  });
  const solvedCount = rows.filter((r) => r.solved).length;
  const text = `Wrdlilo ${prog.date}  ${solvedCount}/${PER_DAY}  (${spentTotal(prog.clues)} clue pts)\n` +
    rows.map((r, i) => `${i + 1} ${[...r.last].map((m) => EMOJI[m]).join("")} ${r.solved ? r.tries : "X"}/${MAX_TRIES}`).join("\n");
  const copy = () => {
    const ok = () => { setCopied("Copied!"); setTimeout(() => setCopied(""), 1600); };
    navigator.clipboard?.writeText(text).then(ok, () => setCopied("Copy blocked, select and copy manually"));
  };
  const s = Math.max(0, Math.floor(left / 1000));
  const clock = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");

  return (
    <main className="page"><div className="stage">
      <Logo small />
      <p className="tag">Done for today: <b>{solvedCount}</b> of {PER_DAY} solved · {spentTotal(prog.clues)} clue points used</p>
      <div className="sum">
        {rows.map((r, i) => (
          <div key={i} className="sumrow">
            <span className="num">{i + 1}</span>
            <span className="sumword">{r.w}</span>
            <span className="sq">{[...r.last].map((m, j) => <i key={j} className={"mt " + m} />)}</span>
            <span className="count">{r.solved ? r.tries : "X"}/{MAX_TRIES}</span>
          </div>
        ))}
      </div>
      <p className="hint">New words in <b className="clock">{clock}</b> (midnight, Manila time)</p>
      <button className="go" onClick={copy}>{copied || "Copy results"}</button>
    </div></main>
  );
}

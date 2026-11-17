import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import PartySocket from "partysocket";
import type { ClientMsg, PlayerView, ServerMsg, StateMsg } from "../shared/score";

const HOST = (import.meta.env.VITE_PARTY_HOST as string) || "localhost:1999";
const KB = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const myId = store.get("wl-id") ?? (() => { const v = Math.random().toString(36).slice(2, 12); store.set("wl-id", v); return v; })();
const params = new URLSearchParams(location.search);

export default function App() {
  const [name, setName] = useState(store.get("wl-name") ?? "");
  const [room, setRoom] = useState(params.get("room") ?? "");
  const [joined, setJoined] = useState(false);
  if (!joined)
    return (
      <Lobby name={name} room={room} setName={setName} setRoom={setRoom}
        onGo={() => { store.set("wl-name", name); history.replaceState(null, "", `?room=${room}`); setJoined(true); }} />
    );
  return <Game name={name} room={room} />;
}

function Lobby(p: { name: string; room: string; setName: (s: string) => void; setRoom: (s: string) => void; onGo: () => void }) {
  const ok = p.name.trim() && p.room.trim();
  return (
    <main className="page lobby"><div className="stage">
      <h1 className="logo">Wrdlilo</h1>
      <p className="tag">Hulaton ang pulong. Isa lang nga pulong para sa tanan sa kwarto.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) p.onGo(); }} className="lobby-form">
        <label>Ngalan<input value={p.name} maxLength={16} onChange={(e) => p.setName(e.target.value)} autoFocus /></label>
        <label>Kwarto (room)
          <span className="row-in">
            <input value={p.room} onChange={(e) => p.setRoom(e.target.value.replace(/[^\w-]/g, "").toLowerCase())} />
            <button type="button" className="ghost" onClick={() => p.setRoom("balay-" + Math.floor(Math.random() * 900 + 100))}>Bag-o</button>
          </span>
        </label>
        <button className="go" disabled={!ok}>Pasulod</button>
      </form>
      <p className="hint">Ipadala ang link sa imo mga abyan pagkatapos magsulod.</p>
      </div>
    </main>
  );
}

function Game({ name, room }: { name: string; room: string }) {
  const [st, setSt] = useState<StateMsg | null>(null);
  const [cur, setCur] = useState("");
  const [toast, setToast] = useState("");
  const [conn, setConn] = useState(false);
  const sock = useRef<PartySocket | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const prevRows = useRef(0);
  const prevRound = useRef(0);

  const pending = useRef(false);
  const send = useCallback((m: ClientMsg) => sock.current?.send(JSON.stringify(m)), []);
  const say = (s: string) => { setToast(s); setTimeout(() => setToast(""), 1600); };

  function shake() {
    const r = boardRef.current?.querySelector<HTMLElement>(".row.cur");
    if (r) gsap.fromTo(r, { x: -8 }, { x: 0, duration: 0.4, ease: "elastic.out(6,0.3)" });
  }

  useEffect(() => {
    const ws = new PartySocket({ host: HOST, room });
    sock.current = ws;
    ws.addEventListener("open", () => { setConn(true); ws.send(JSON.stringify({ t: "join", id: myId, name } satisfies ClientMsg)); });
    ws.addEventListener("close", () => setConn(false));
    ws.addEventListener("message", (e) => {
      const m: ServerMsg = JSON.parse(e.data);
      pending.current = false;
      if (m.t === "state") setSt(m);
      else { say(m.msg); shake(); }
    });
    return () => ws.close();
  }, [room, name]);

  const me = st?.players.find((p) => p.id === st.you);
  const myRows = me?.marks.length ?? 0;
  const done = !!me?.done;

  // drum-pop reveal when a new row lands; reset on new round
  useLayoutEffect(() => {
    if (!st) return;
    if (st.round !== prevRound.current) { prevRound.current = st.round; prevRows.current = myRows; setCur(""); return; }
    if (myRows > prevRows.current) {
      const tiles = boardRef.current?.querySelectorAll<HTMLElement>(`.row[data-r="${myRows - 1}"] .tile`);
      if (tiles) gsap.fromTo(tiles, { scale: 1.3, y: -6 }, { scale: 1, y: 0, duration: 0.45, stagger: 0.09, ease: "back.out(3)" });
      setCur("");
      if (me?.won) burst();
    }
    prevRows.current = myRows;
  }, [st, myRows, me?.won]);

  const press = useCallback((k: string) => {
    if (!st || done) return;
    if (k === "enter") {
      if (pending.current) return;
      if (cur.length === 5) { pending.current = true; setTimeout(() => { pending.current = false; }, 2000); send({ t: "guess", word: cur }); } else { say("Kulang ang letra"); shake(); } }
    else if (k === "back") setCur((c) => c.slice(0, -1));
    else if (/^[a-zñ]$/.test(k)) setCur((c) => (c.length < 5 ? c + k : c));
  }, [st, done, cur, send]);

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
    me?.letters?.forEach((g, gi) => [...g].forEach((ch, i) => { const s = me.marks[gi][i]; if (o[ch] === undefined || rank[s] > rank[o[ch]]) o[ch] = s; }));
    return o;
  }, [me]);

  function burst() {
    const root = document.getElementById("confetti"); if (!root) return;
    for (let i = 0; i < 40; i++) {
      const d = document.createElement("i"); d.style.background = ["#f4b81c", "#e03b24", "#17a3a8"][i % 3]; root.appendChild(d);
      gsap.fromTo(d, { x: 0, y: 0, opacity: 1 }, { x: gsap.utils.random(-180, 180), y: gsap.utils.random(-260, -40), rotation: gsap.utils.random(-300, 300), opacity: 0, duration: 1.2, ease: "power2.out", onComplete: () => d.remove() });
    }
  }

  const link = `${location.origin}/?room=${room}`;
  const others = st?.players.filter((p) => p.id !== st.you) ?? [];
  const waiting = others.filter((p) => p.online && !p.done && p.marks.length > 0).length;

  return (
    <main className="page game"><div className="stage">
      <header className="top">
        <h1 className="logo sm">Wrdlilo</h1>
        <div className="roombar">
          <span className={"dot" + (conn ? " on" : "")} /> <b>{room}</b> · round {st?.round ?? "-"}
          <button className="ghost" onClick={() => { navigator.clipboard?.writeText(link).then(() => say("Link nakopya"), () => say(link)); }}>Kopyaha ang link</button>
        </div>
      </header>

      <div className="layout">
        <section className="me">
          <div className="board" ref={boardRef}>
            {Array.from({ length: st?.maxTries ?? 6 }, (_, r) => {
              const typing = r === myRows && !done;
              const letters = me?.letters?.[r] ?? (typing ? cur : "");
              return (
                <div key={r} data-r={r} className={"row" + (typing ? " cur" : "")}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={"tile " + (me?.marks[r]?.[i] ?? (letters[i] ? "f" : ""))}>{letters[i] ?? ""}</div>
                  ))}
                </div>
              );
            })}
            <div id="confetti" />
          </div>

          {done ? (
            <div className="end">
              <p>{me?.won ? "Nakuha mo!" : "Ay, indi nakuha."} Ang pulong: <b className="ans">{st?.answer}</b></p>
              <button className="go" disabled={waiting > 0} onClick={() => send({ t: "next" })}>
                {waiting > 0 ? `Hulat sa ${waiting} ka kaupod` : "Bag-ong pulong"}
              </button>
            </div>
          ) : (
            <div className="kb">
              {KB.map((row, ri) => (
                <div key={ri}>
                  {ri === 2 && <button className="key wide" onClick={() => press("enter")}>Enter</button>}
                  {[...row].map((k) => <button key={k} className={"key " + (keyState[k] ?? "")} onClick={() => press(k)}>{k}</button>)}
                  {ri === 2 && <button className="key wide" onClick={() => press("back")}>⌫</button>}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="friends">
          <h2>Mga kaupod</h2>
          {others.length === 0 && <p className="hint">Wala pa sang iban. Ipadala ang link.</p>}
          {others.map((p) => <Mini key={p.id} p={p} max={st?.maxTries ?? 6} />)}
        </aside>
      </div>
      </div>{toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Mini({ p, max }: { p: PlayerView; max: number }) {
  return (
    <div className={"mini" + (p.online ? "" : " off")}>
      <div className="mini-h"><b>{p.name}</b><span>{p.done ? (p.won ? "nakuha" : "natapos") : `${p.marks.length}/${max}`}</span></div>
      <div className="mini-b">
        {Array.from({ length: max }, (_, r) => (
          <div key={r} className="mrow">
            {Array.from({ length: 5 }, (_, i) => <i key={i} className={"mt " + (p.marks[r]?.[i] ?? "")}>{p.letters?.[r]?.[i] ?? ""}</i>)}
          </div>
        ))}
      </div>
    </div>
  );
}

import type * as Party from "partykit/server";
import { ANSWERS } from "../shared/words";
import { score, type ClientMsg, type PlayerView, type StateMsg } from "../shared/score";

const MAX = 6;
interface Player { id: string; name: string; guesses: string[] }

export default class WordleRoom implements Party.Server {
  answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  recent: string[] = [this.answer];
  round = 1;
  players = new Map<string, Player>();
  conns = new Map<string, string>(); // connection id -> player id
  constructor(readonly room: Party.Room) {}

  isDone(p: Player) { return p.guesses.includes(this.answer) || p.guesses.length >= MAX; }

  onMessage(raw: string, sender: Party.Connection) {
    let m: ClientMsg;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === "join") {
      const name = String(m.name || "Abyan").slice(0, 16);
      const id = String(m.id).slice(0, 40);
      this.conns.set(sender.id, id);
      const ex = this.players.get(id);
      if (ex) ex.name = name; else this.players.set(id, { id, name, guesses: [] });
      return this.broadcast();
    }
    const pid = this.conns.get(sender.id);
    const p = pid ? this.players.get(pid) : undefined;
    if (!p) return;
    if (m.t === "guess") {
      const w = String(m.word).toLowerCase();
      if (this.isDone(p)) return;
      if (!/^[a-zñ]{5}$/.test(w)) return sender.send(JSON.stringify({ t: "error", msg: "Kinahanglan 5 ka letra" }));
      p.guesses.push(w);
      return this.broadcast();
    }
    if (m.t === "next") {
      if (!this.isDone(p)) return;
      let next = this.answer;
      for (let i = 0; i < 30 && this.recent.includes(next); i++) next = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
      this.answer = next;
      this.recent = [...this.recent, next].slice(-Math.min(40, ANSWERS.length - 1));
      this.round++;
      this.players.forEach((q) => (q.guesses = []));
      this.broadcast();
    }
  }

  onClose(conn: Party.Connection) { this.conns.delete(conn.id); this.broadcast(); }

  broadcast() {
    const online = new Set(this.conns.values());
    for (const conn of this.room.getConnections()) {
      const viewerId = this.conns.get(conn.id);
      const viewer = viewerId ? this.players.get(viewerId) : undefined;
      if (!viewer) continue;
      const viewerDone = this.isDone(viewer);
      const players: PlayerView[] = [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, online: online.has(p.id),
        marks: p.guesses.map((g) => score(g, this.answer)),
        letters: p.id === viewer.id || viewerDone ? p.guesses : undefined,
        done: this.isDone(p), won: p.guesses.includes(this.answer),
      }));
      const msg: StateMsg = { t: "state", you: viewer.id, round: this.round, maxTries: MAX, players, answer: viewerDone ? this.answer : undefined };
      conn.send(JSON.stringify(msg));
    }
  }
}

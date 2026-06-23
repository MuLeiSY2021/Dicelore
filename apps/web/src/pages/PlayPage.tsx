// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BookOpen, Wrench, LayoutGrid, Search, File, Pin, CheckCircle2, Dices, LayoutDashboard,
  Grid3x3, User, Minus, X, Timer, Package, Eye, Sparkles, Loader2, AlertTriangle, Flag,
  BookMarked, ChevronDown, ChevronUp, ScrollText, Play, Trash2,
} from "lucide-react";
import { useSession } from "../live/useSession.js";
import { useT } from "../i18n/index.js";
import { browse, listSessions, startGame, deleteSession, type BrowseEntry } from "../api/client.js";
import { Link } from "react-router-dom";
import type { SessionSummary } from "@dicelore/shared";

const DEMO_SESSION = "demo";
// 左活动轨不再是固定的「设定/规则/日志」物理表分类——团本业务表段已客制化。
// 改为：① 设定(可见 lore，按条目自带 category/tag 动态分组，天然兼容任意客制段) ② 工具(玩家自查工具)。
type RailKey = "world" | "tools";
const RAIL: { key: RailKey; Icon: ComponentType<{ className?: string }> }[] = [
  { key: "world", Icon: BookOpen }, { key: "tools", Icon: Wrench },
];

const CLOCK_RE = /^\s*(\d+)\s*\/\s*(\d+)\s*$/;
const INV_PREFIX = "库存:";

function ClockDial({ cur, max }: { cur: number; max: number }) {
  const frac = max > 0 ? Math.min(1, cur / max) : 0;
  const deg = Math.round(frac * 360);
  const seg = 360 / Math.max(max, 1);
  const style = { background: `repeating-conic-gradient(from -90deg, transparent 0 ${seg - 4}deg, var(--surface2) ${seg - 4}deg ${seg}deg), conic-gradient(from -90deg, var(--acc) 0 ${deg}deg, var(--dial-empty) ${deg}deg)` };
  return <div className="dial" style={style} aria-label={`${cur}/${max}`} />;
}

function dateBucket(iso?: string | number): "today" | "week" | "earlier" {
  if (iso == null) return "earlier";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 864e5) return "today";
  if (diff < 7 * 864e5) return "week";
  return "earlier";
}

export default function PlayPage() {
  const t = useT();
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const sid = sessionId ?? DEMO_SESSION;
  const { snapshot, narration, pendingRoll, generating, error, gameEnd, reveals, postMessage, roll, choose, dismissReveal } = useSession(sid);
  const [draft, setDraft] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);

  // 左活动轨 / 浏览
  const [source, setSource] = useState<RailKey>("world");
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [logEntries, setLogEntries] = useState<BrowseEntry[]>([]);
  const [pins, setPins] = useState<BrowseEntry[]>([]);
  // 会话栏(次级 bar，可隐藏)
  const [barOpen, setBarOpen] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [kicked, setKicked] = useState(false); // 本地乐观：已点「开始游戏」
  // 面板隐藏 / 最小化
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [mini, setMini] = useState<Set<string>>(new Set());
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setChosen(null); }, [snapshot?.choices?.eventId]);
  const reloadSessions = () => listSessions().then((s) => { setSessions(s); setSessionsLoaded(true); }).catch(() => setSessionsLoaded(true));
  useEffect(() => { setKicked(false); reloadSessions(); }, [sid]);

  // 设定源：q 防抖检索可见 lore。
  useEffect(() => {
    if (source !== "world") return;
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => { browse(sid, "world", q).then(setEntries).catch(() => setEntries([])); }, 180);
    return () => { if (qTimer.current) clearTimeout(qTimer.current); };
  }, [sid, source, q]);
  // 工具源：加载本局日志。
  useEffect(() => { if (source === "tools") browse(sid, "log").then(setLogEntries).catch(() => setLogEntries([])); }, [sid, source]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && draft.trim()) { postMessage(draft.trim()).catch(() => {}); setDraft(""); }
  };
  const togglePin = (e: BrowseEntry) => setPins((p) => (p.some((x) => x.ref === e.ref) ? p.filter((x) => x.ref !== e.ref) : [...p, e]));
  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  const toggleMin = (id: string) => setMini((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sheets = snapshot?.sheets ?? [];
  const mechanics = snapshot?.mechanics ?? [];
  const choices = snapshot?.choices ?? null;

  // 两层 Play：未开场(开场层) → 大金按钮；已开场(续玩层) → 输入框。
  const sessionRow = sessions.find((s) => s.sessionId === sid);
  const started = kicked || narration.length > 0 || (snapshot?.narrativeCursor ?? 0) > 0 || sessionRow?.started === true || !!gameEnd;
  // 无显式会话、一局都没有、且当前也没有任何活数据 → 引导去团本目录。
  const noSessions = !sessionId && sessionsLoaded && sessions.length === 0 && sheets.length === 0 && narration.length === 0;

  async function kickoff() {
    setKicked(true);
    try { await startGame(sid); } catch { setKicked(false); }
  }
  async function removeSession(id: string) {
    await deleteSession(id);
    const rest = sessions.filter((s) => s.sessionId !== id);
    setSessions(rest);
    if (id === sid) navigate(rest[0] ? `/play/${encodeURIComponent(rest[0].sessionId)}` : "/packs");
  }

  // 设定按 tag 动态分组(兼容任意客制段)。
  const grouped = new Map<string, BrowseEntry[]>();
  for (const e of entries) { const k = e.tag ?? "未分类"; (grouped.get(k) ?? grouped.set(k, []).get(k)!).push(e); }

  // 会话按日期分组。
  const buckets: { key: "today" | "week" | "earlier"; label: string }[] = [
    { key: "today", label: t("play.date.today") }, { key: "week", label: t("play.date.week") }, { key: "earlier", label: t("play.date.earlier") },
  ];
  const curRow = sessions.find((s) => s.sessionId === sid);
  const sessTitle = (s: SessionSummary) => (s.packName ? `${s.packName} · ` : "") + s.title;
  const curTitle = curRow ? sessTitle(curRow) : sid;

  // 呈现台分类
  const attrPanels = sheets.map((g) => ({
    entity: g.entity,
    clocks: g.cells.filter((c) => CLOCK_RE.test(c.value)),
    inv: g.cells.filter((c) => c.attr.startsWith(INV_PREFIX)),
    attrs: g.cells.filter((c) => !CLOCK_RE.test(c.value) && !c.attr.startsWith(INV_PREFIX)),
  }));

  // 一局都没有(裸 /play) → 引导去团本目录。
  if (noSessions) return (
    <div className="playwrap">
      <div className="play-empty">
        <BookMarked className="lucide" />
        <div className="et">{t("play.session.empty.title")}</div>
        <div className="es">{t("play.session.empty.sub")}</div>
        <Link className="btn go" to="/packs"><BookMarked className="lucide" />{t("play.session.empty.cta")}</Link>
      </div>
    </div>
  );

  return (
    <div className="playwrap">
      {/* 次级会话栏(可隐藏，仿团本制作 ctx 栏) */}
      {barOpen ? (
        <div className="playbar">
          <BookMarked className="lucide" />
          <span className="name">{curTitle}</span>
          <label className="sessel"><ScrollText className="lucide" />
            <select aria-label={t("play.bar.session")} value={sid} onChange={(e) => navigate(`/play/${e.target.value}`)}>
              {sessions.length === 0 && <option value={sid}>{t("play.bar.nosession")}</option>}
              {buckets.map((b) => {
                const items = sessions.filter((s) => dateBucket(s.updatedAt) === b.key);
                return items.length === 0 ? null : (
                  <optgroup key={b.key} label={b.label}>
                    {items.map((s) => <option key={s.sessionId} value={s.sessionId}>{sessTitle(s)} · {t(`status.${s.status}`)}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <span className="sp" />
          {curRow && (
            <button className="collapse" aria-label={t("play.session.delete")} title={t("play.session.delete")}
              onClick={() => { if (confirm(`${t("play.session.delete")}：${curTitle}?`)) removeSession(sid); }}><Trash2 className="lucide" /></button>
          )}
          <button className="collapse" aria-label={t("play.bar.hide")} title={t("play.bar.hide")} onClick={() => setBarOpen(false)}><ChevronUp className="lucide" /></button>
        </div>
      ) : (
        <button className="playbar mini" aria-label={t("play.bar.show")} onClick={() => setBarOpen(true)}>
          <ChevronDown className="lucide" /><span className="name">{curTitle}</span>
        </button>
      )}

      <div className="play">
        <aside className="rail" aria-label="活动轨">
          {RAIL.map(({ key, Icon }) => (
            <button key={key} className={"ic" + (source === key ? " on" : "")} title={t(`play.rail.${key}`)} aria-label={t(`play.rail.${key}`)}
              aria-pressed={source === key} onClick={() => setSource(key)}><Icon className="lucide" /></button>
          ))}
          <span className="sp" />
          <button className="ic" title={t("play.rail.add")}><LayoutGrid className="lucide" /></button>
        </aside>

        <aside className="browse" aria-label="自查源">
          {source === "world" ? (
            <>
              <div className="bh"><BookOpen className="lucide" />{t("play.rail.world")}</div>
              <label className="bsearch"><Search className="lucide" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("play.search.world")} aria-label={t("play.search.world")}
                  style={{ background: "none", border: "none", color: "inherit", outline: "none", width: "100%", font: "inherit" }} />
              </label>
              <div className="tree">
                {entries.length === 0 ? <div className="leaf"><span className="nm">{t("play.tree.empty")}</span></div>
                  : [...grouped.entries()].map(([tag, items]) => (
                    <div key={tag}>
                      <div className="cat"><File className="lucide" />{tag}</div>
                      {items.map((e) => {
                        const pinned = pins.some((x) => x.ref === e.ref);
                        return (
                          <div className="leaf" key={e.ref} title={e.snippet}>
                            <span className="lic"><File className="lucide" /></span><span className="nm">{e.name}</span>
                            {e.canPin && <button className={"pin" + (pinned ? " on" : "")} aria-label={`pin ${e.name}`} aria-pressed={pinned}
                              onClick={() => togglePin(e)} style={{ background: "none", border: "none", cursor: "pointer" }}><Pin className="lucide" /></button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="bh"><Wrench className="lucide" />{t("play.rail.tools")}</div>
              <div className="tree">
                <div className="cat"><Pin className="lucide" />{t("play.tools.pins")} · {pins.length}</div>
                {pins.length === 0 ? <div className="leaf"><span className="nm">{t("play.tools.none")}</span></div>
                  : pins.map((p) => (
                    <div className="leaf" key={p.ref}><span className="lic"><Pin className="lucide" /></span><span className="nm">{p.name}</span>
                      <button className="pin on" aria-label={`unpin ${p.name}`} onClick={() => togglePin(p)} style={{ background: "none", border: "none", cursor: "pointer" }}><X className="lucide" /></button></div>
                  ))}
                <div className="cat"><ScrollText className="lucide" />{t("play.tools.log")}</div>
                {logEntries.length === 0 ? <div className="leaf"><span className="nm">{t("play.tree.empty")}</span></div>
                  : logEntries.slice(0, 40).map((e) => (
                    <div className="leaf" key={e.ref} title={e.snippet}><span className="lic"><ScrollText className="lucide" /></span><span className="nm">{e.snippet || e.name}</span></div>
                  ))}
              </div>
            </>
          )}
        </aside>

        <section className="center" aria-label="叙事">
          <div className="narr">
            {gameEnd && <div className="end" role="status"><Flag className="lucide" /><b>{gameEnd.outcome}</b><span>{gameEnd.reason}</span></div>}
            {narration.length === 0 && mechanics.length === 0 && !gameEnd ? (
              <p className="empty">{t("play.narr.empty")}</p>
            ) : (
              <>
                {narration.map((para, i) => <p key={i}>{para}</p>)}
                {mechanics.map((m) => <div className="mech" key={m.seq}><CheckCircle2 className="lucide" />{m.text}</div>)}
              </>
            )}
            {pendingRoll?.bands && pendingRoll.bands.length > 0 && (
              <div className="ranges">
                <div className="rt"><Dices className="lucide" />{pendingRoll.label} — {pendingRoll.yourSide.exprDisplay}</div>
                {pendingRoll.bands.map((b) => <div className="rr" key={b.label}><span className="rg">{b.min}–{b.max}</span><span className="rd">{b.label}</span></div>)}
              </div>
            )}
            {pendingRoll && (!pendingRoll.bands || pendingRoll.bands.length === 0) && (
              <div className="mech"><Dices className="lucide" />{pendingRoll.label}：{pendingRoll.yourSide.exprDisplay}{pendingRoll.dc != null ? ` vs DC ${pendingRoll.dc}` : ""}</div>
            )}
            {choices && (
              <div className="ranges">
                {choices.options.map((o) => (
                  <button className={"choice" + (chosen === o.index ? " sel" : "")} key={o.index} disabled={chosen !== null}
                    onClick={() => { setChosen(o.index); choose(choices.eventId, o.index).catch(() => setChosen(null)); }}>
                    <span className="cl">{o.label}</span><span className="cc">{o.consequence}</span>
                  </button>
                ))}
              </div>
            )}
            {generating && <div className="gen"><Loader2 className="lucide spin" />{t("play.generating")}</div>}
            {error && <div className="err"><AlertTriangle className="lucide" />{error}</div>}
          </div>

          <div className="split" />
          <div className="input">
            {pendingRoll ? (
              <>
                <button className="roll" onClick={() => roll(pendingRoll.eventId).catch(() => {})}>
                  <Dices className="lucide" />{t("play.roll")}<span className="d">d{pendingRoll.shape === "outcome" ? "10" : "20"}</span>
                </button>
                <span className="h">{t("play.roll.hint")}</span>
              </>
            ) : !started ? (
              <>
                <button className="roll kickoff" data-testid="kickoff" onClick={kickoff} disabled={kicked}>
                  <Play className="lucide" />{kicked ? t("play.start.busy") : t("play.start")}
                </button>
                <span className="h">{t("play.start.hint")}</span>
              </>
            ) : (
              <input className="field" aria-label="输入" value={draft} placeholder={t("play.input.ph")}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} disabled={!!gameEnd} />
            )}
          </div>
        </section>

        <aside className="stage" aria-label="呈现台">
          <div className="sh"><LayoutDashboard className="lucide" />{t("play.stage")}<span className="mode"><Grid3x3 className="lucide" />{t("play.stage.grid")}</span></div>
          <div className="grid">
            {sheets.length === 0 && reveals.length === 0 && pins.length === 0 ? (
              <div className="pan wide"><div className="pc"><span className="empty">{t("play.stage.empty")}</span></div></div>
            ) : (
              <>
                {attrPanels.map(({ entity, attrs, clocks, inv }) => {
                  const items: JSX.Element[] = [];
                  if (attrs.length > 0) { const id = `attr:${entity}`; if (!hidden.has(id)) items.push(
                    <Panel key={id} id={id} title={entity} Icon={User} mini={mini.has(id)} onMin={() => toggleMin(id)} onHide={() => hide(id)}>
                      {attrs.map((c) => <div className="row" key={c.attr}><span>{c.attr}</span><b>{c.value}</b></div>)}
                    </Panel>); }
                  clocks.forEach((c) => { const id = `clock:${entity}:${c.attr}`; const m = CLOCK_RE.exec(c.value)!; if (!hidden.has(id)) items.push(
                    <Panel key={id} id={id} title={t("play.panel.clock")} Icon={Timer} mini={mini.has(id)} onMin={() => toggleMin(id)} onHide={() => hide(id)}>
                      <div className="clockrow"><ClockDial cur={Number(m[1])} max={Number(m[2])} /><div className="ck"><div className="nm">{c.attr}</div><div className="v">{c.value}</div></div></div>
                    </Panel>); });
                  if (inv.length > 0) { const id = `inv:${entity}`; if (!hidden.has(id)) items.push(
                    <Panel key={id} id={id} title={`${t("play.panel.inv")} · ${inv.length}`} Icon={Package} mini={mini.has(id)} onMin={() => toggleMin(id)} onHide={() => hide(id)}>
                      {inv.map((c) => <div className="row" key={c.attr}><span>{c.attr.slice(INV_PREFIX.length)}</span><b>{c.value}</b></div>)}
                    </Panel>); }
                  return items;
                })}
                {reveals.filter((r) => !hidden.has(`rev:${r.seq}`)).map((r) => (
                  <Panel key={`rev:${r.seq}`} id={`rev:${r.seq}`} title={t("play.panel.reveal")} Icon={Eye} wide gmTag={`GM·${r.seq}`}
                    mini={mini.has(`rev:${r.seq}`)} onMin={() => toggleMin(`rev:${r.seq}`)} onHide={() => { dismissReveal(r.seq); hide(`rev:${r.seq}`); }}>
                    <div className="revc"><b>{r.target.replace(/^world:/, "")}</b>　{r.text}</div>
                  </Panel>
                ))}
                {pins.filter((p) => !hidden.has(`pin:${p.ref}`)).map((p) => (
                  <Panel key={`pin:${p.ref}`} id={`pin:${p.ref}`} title={p.name} Icon={Pin} wide
                    mini={mini.has(`pin:${p.ref}`)} onMin={() => toggleMin(`pin:${p.ref}`)} onHide={() => hide(`pin:${p.ref}`)}>
                    <div className="revc">{p.snippet}</div>
                  </Panel>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Panel({ id, title, Icon, children, wide, gmTag, mini, onMin, onHide }: {
  id: string; title: string; Icon: ComponentType<{ className?: string }>; children: React.ReactNode;
  wide?: boolean; gmTag?: string; mini: boolean; onMin: () => void; onHide: () => void;
}) {
  return (
    <div className={"pan" + (wide ? " wide" : "") + (mini ? " min" : "")} data-panel={id}>
      <div className="ph">
        <span className="pic"><Icon className="lucide" /></span><span className="pt">{title}</span>
        <span className="ctl">
          {gmTag && <span className="gm-tag"><Sparkles className="lucide" />{gmTag}</span>}
          <button aria-label="最小化" onClick={onMin} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}><Minus className="lucide" /></button>
          <button aria-label="隐藏" onClick={onHide} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}><X className="lucide" /></button>
        </span>
      </div>
      {!mini && <div className="pc">{children}</div>}
    </div>
  );
}

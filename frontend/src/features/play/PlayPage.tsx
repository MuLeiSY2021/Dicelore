// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState, type KeyboardEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Dices, Library, Hammer, Swords, ArrowUp, ArrowRight, Cpu, ChevronDown, PanelRightClose,
  Sparkles, CheckCircle2, AlertCircle, RotateCcw, Flag, MessageSquare,
  Pencil, Trash2, MoreHorizontal, AlertTriangle, Rewind, Gauge, Zap,
} from "lucide-react";
import { CONTEXT_WINDOW, type SpoilerTier } from "@dicelore/shared";
import { useSession } from "@/features/play/useSession.js";
import { useDock } from "@/features/play/useDock.js";
import { Markdown } from "@/features/play/Markdown.js";
import { DockCard } from "@/features/play/DockCard.js";
import { RollBands } from "@/features/play/RollBands.js";
import { PlayBay } from "@/features/play/PlayBay.js";
import { estimateCostUsd, fmtTokens } from "@/features/cost/pricing.js";
import { listSessions } from "@/features/play/api.js";
import type { SessionSummary } from "@dicelore/shared";
import "@/features/play/play.css";

const DEMO_SESSION = "demo";
const MODELS = Object.keys(CONTEXT_WINDOW).filter((m) => m !== "default");

export default function PlayPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const sid = sessionId ?? DEMO_SESSION;
  const s = useSession(sid);
  const { snapshot, rounds, pendingRoll, rollResult, hiddenRolls, generating, error, errorCode, gameEnd, reveals,
    config, usage, compacting, postMessage, start, roll, choose, retry, skip, setModel, setSpoilerTier, branch } = s;

  const [draft, setDraft] = useState("");
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [kicked, setKicked] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [compactCards, setCompactCards] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [sentMsgs, setSentMsgs] = useState<string[]>([]);
  const [rewindOpen, setRewindOpen] = useState<number | null>(null);
  const [rewound, setRewound] = useState(false);

  const dock = useDock(sid, snapshot);
  const spoilerTier: SpoilerTier = config?.spoilerTier ?? "strict";

  useEffect(() => {
    setKicked(false); setChosen(new Set()); setSentMsgs([]); setRewindOpen(null); setRewound(false);
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, [sid]);

  const choices = snapshot?.choices ?? null;
  useEffect(() => { setChosen(new Set()); }, [choices?.eventId]);

  const sessionRow = sessions.find((x) => x.sessionId === sid);
  const started = kicked || rounds.length > 0 || (snapshot?.narrativeCursor ?? 0) > 0 || sessionRow?.started === true || !!gameEnd;
  const noSession = !sessionId && sessions.length === 0 && rounds.length === 0 && (snapshot?.sheets?.length ?? 0) === 0;

  // 五态 data-screen 驱动（互斥）。
  const screen: "none" | "kickoff" | "input" | "generating" | "roll" | "choices" | "error" | "end" =
    !started ? (noSession ? "none" : "kickoff")
    : gameEnd ? "end"
    : error ? "error"
    : pendingRoll ? "roll"
    : choices ? "choices"
    : generating ? "generating"
    : "input";

  const title = sessionRow ? ((sessionRow.packName && sessionRow.packName !== sessionRow.title ? `${sessionRow.packName} · ` : "") + sessionRow.title) : sid;

  async function kickoff() { setKicked(true); try { await start(); } catch { setKicked(false); } }
  function send(text: string) {
    const t = text.trim(); if (!t) return;
    setSentMsgs((m) => [...m, t]);
    postMessage(t).catch(() => {});
    setDraft("");
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") send(draft); };
  function toggleChoice(idx: number) { setChosen((c) => { const n = new Set(c); n.has(idx) ? n.delete(idx) : n.add(idx); return n; }); }
  function sendChoices() {
    if (!choices) { send(draft); return; }
    const first = [...chosen][0];
    if (first != null) choose(choices.eventId, first).catch(() => {});
    else send(draft);
  }

  const ctxPct = Math.round((usage?.contextPct ?? 0) * 100);
  const ctxHot = ctxPct > 90;

  const bay = (
    <PlayBay snapshot={snapshot} sessions={sessions} sid={sid} onSelectSession={(id) => navigate(`/play/${encodeURIComponent(id)}`)}
      spoilerTier={spoilerTier} onSpoilerTier={(t) => setSpoilerTier(t).catch(() => {})}
      showActions={showActions} onToggleActions={() => setShowActions((v) => !v)}
      compactCards={compactCards} onToggleCompact={() => setCompactCards((v) => !v)}
      archivedCards={dock.archivedCards} onRestore={dock.restore} usage={usage} />
  );

  // ── 整屏态：无会话引导 ──
  if (screen === "none") return (
    <div className="playwrap">
      <div className="full" data-screen="none">
        <div className="welc" data-testid="play-noSession-hint">
          <div className="welc-h"><Dices className="lucide" /><span>开始一局跑团</span></div>
          <div className="welc-sub">还没有进行中的会话。挑一个团本开局，或继续上次的存档。</div>
          <div className="welc-actions">
            <Link className="wa primary" to="/adventures" data-testid="play-none-catalog"><Library className="lucide" />去团本目录</Link>
            <Link className="wa" to="/build"><Hammer className="lucide" />制作新团本</Link>
          </div>
          {sessions.length > 0 && (
            <div className="welc-recent">
              <div className="wr-h">最近会话</div>
              {sessions.slice(0, 5).map((x) => (
                <div className="wr-item" key={x.sessionId} data-testid="play-none-recent" role="button" tabIndex={0}
                  onClick={() => navigate(`/play/${encodeURIComponent(x.sessionId)}`)}>
                  <Swords className="lucide" /><div><div className="wr-t">{x.title}</div><div className="wr-s">{x.lastReply ?? ""}</div></div>
                  <span className="wr-go"><ArrowRight className="lucide" /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {bay}
    </div>
  );

  // ── 整屏态：未开场信息卡 ──
  if (screen === "kickoff") return (
    <div className="playwrap">
      <div className="full" data-screen="kickoff">
        <div className="kc">
          <div className="kc-pack" data-testid="play-kickoff-pack">
            <div className="kc-title">{title}</div>
            {sessionRow?.packName && <div className="kc-sub">{sessionRow.packName}</div>}
            <div className="kc-desc">点击开始，GM 将播报开场（prologue），随后出现输入框。</div>
          </div>
          <button className="big" data-testid="play-kickoff-btn" onClick={kickoff} disabled={kicked}>
            <Dices className="lucide" />{kicked ? "开场中…" : "点击开始游戏"}
          </button>
          <div className="kc-foot">GM 将播报开场（prologue），随后出现输入框</div>
        </div>
      </div>
      {bay}
    </div>
  );

  // ── 续玩层：桌面沙盘 ──
  return (
    <div className="playwrap" data-screen={screen}>
      <div data-testid="play-stage-shell" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="stagebar">
          <span style={{ fontFamily: "var(--serif)", fontSize: "13px", color: "var(--text)" }}>{title}</span>
          {sessionRow?.packName && <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--text3)" }}>{sessionRow.packName}</span>}
          <label className="model-switch" data-testid="play-model-switch" title="运行时切换 model · 下回合生效">
            <Cpu className="lucide" />
            <select aria-label="切换模型" value={config?.model ?? ""} onChange={(e) => setModel(e.target.value).catch(() => {})}>
              {config?.model && !MODELS.includes(config.model) && <option value={config.model}>{config.model}</option>}
              {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {config?.pendingModel && <span className="ms-pending" title={`下回合切至 ${config.pendingModel}`}>→{config.pendingModel}</span>}
            <ChevronDown className="lucide" style={{ width: 12 }} />
          </label>
          <span className="sp" />
        </div>

        <div className="sandbox">
          <div className="stage">
            <div className={"stream" + (showActions ? " show-actions" : "")} data-testid="play-stream">
              {rounds.map((r, ri) => (
                <div key={ri}>
                  {ri > 0 && sentMsgs[ri - 1] != null && (
                    <div className="pmsg" data-testid="play-player-msg">
                      <span className="pt">{sentMsgs[ri - 1]}</span>
                      <span className="pa">
                        <Pencil className="lucide" role="button" data-testid="play-player-edit" onClick={() => setRewindOpen(ri)} />
                        <Trash2 className="lucide" data-testid="play-player-delete" />
                        <MoreHorizontal className="lucide" data-testid="play-player-more" />
                      </span>
                    </div>
                  )}
                  {rewindOpen === ri && (
                    <div className="rwconfirm" data-testid="play-rewind-confirm">
                      <AlertTriangle className="lucide" style={{ color: "var(--warn)" }} />
                      <span>编辑这句将 <b>丢弃其后回合</b>（自动 rewind 到此输入前）。</span>
                      <span className="sp" style={{ flex: 1 }} />
                      <span className="btn go" data-testid="play-rewind-go" role="button" tabIndex={0}
                        onClick={() => { s.rewind().catch(() => {}); setRewindOpen(null); setRewound(true); }}>确认 rewind</span>
                      <span className="btn" data-testid="play-rewind-cancel" role="button" tabIndex={0} onClick={() => setRewindOpen(null)}>取消</span>
                    </div>
                  )}
                  {r.texts.map((p, pi) => <Markdown key={pi} text={p} />)}
                  {r.usage && (
                    <div className="turn-usage" data-testid="play-turn-usage"
                      title={`model ${r.model ?? usage?.model ?? ""} · in ${r.usage.inputTokens} / out ${r.usage.outputTokens} / cacheRead ${r.usage.cacheReadTokens} / cacheWrite ${r.usage.cacheCreationTokens}`}>
                      ⟨<span className="tu-model">{r.model ?? usage?.model ?? ""}</span> · <span className="up">↑{fmtTokens(r.usage.inputTokens)}</span> <span className="down">↓{fmtTokens(r.usage.outputTokens)}</span> tok · ≈${estimateCostUsd(r.model ?? usage?.model, r.usage).toFixed(3)}⟩
                    </div>
                  )}
                </div>
              ))}

              {rewound && (
                <div className="rwnote" data-testid="play-rewind-note"><Rewind className="lucide" />已 rewind 到此输入前 · 后续回合已丢弃，可重新输入</div>
              )}

              {/* 机械回显 + 透视 GM 动作 toolcall */}
              {(snapshot?.mechanics ?? []).map((m) => (
                <div className={`mech mech-${m.kind}`} key={`mech-${m.seq}`} data-testid="play-mech">
                  {m.kind === "watcher_fired" ? <Sparkles className="lucide" /> : <CheckCircle2 className="lucide" />}{m.text}
                  {showActions && <span className="toolcall-inline" data-testid="play-toolcall">{m.kind}</span>}
                </div>
              ))}

              {/* 暗骰（spoiler 档渲染：严格隐结果、关闭显全） */}
              {hiddenRolls.map((h) => (
                <div className="mech" key={`hidden-${h.eventId}`} data-testid="play-hidden-roll">
                  <CheckCircle2 className="lucide" /><span className="ml">暗骰</span>
                  {spoilerTier === "off"
                    ? <span>GM {h.label}：{h.result}{h.dc != null ? ` vs DC ${h.dc}` : ""}{h.band ? ` · ${h.band.label}` : ""}</span>
                    : <span>GM 进行了一次{h.label}判定</span>}
                  <span style={{ marginLeft: "auto", fontSize: "9px", color: "var(--text3)", opacity: .6 }}>
                    {spoilerTier === "off" ? "防剧透·关闭" : spoilerTier === "loose" ? "防剧透·宽松" : "防剧透·严格"}
                  </span>
                </div>
              ))}

              {/* 临时披露栈 */}
              {reveals.map((rv) => (
                <div className="tempstack" key={rv.seq} data-testid="play-temp-stack">
                  <div className="th"><Sparkles className="lucide" />新披露 · 临时位（不抢常驻卡）</div>
                  <div className="ti"><b style={{ color: "var(--text)" }}>{rv.target.replace(/^world:/, "")}</b>：{rv.text}</div>
                </div>
              ))}

              {/* 明骰内联：区间分档 + 掷出后结果 */}
              {pendingRoll && (
                <div data-screen="roll" style={{ margin: "14px 0" }}>
                  <div className="divider">待掷 · {pendingRoll.label}</div>
                  {pendingRoll.bands && pendingRoll.bands.length > 0
                    ? <RollBands bands={pendingRoll.bands} tier={spoilerTier} result={rollResult} />
                    : <div className="mech"><Dices className="lucide" />{pendingRoll.label}：{pendingRoll.yourSide.exprDisplay}{pendingRoll.dc != null ? ` vs DC ${pendingRoll.dc}` : ""}</div>}
                </div>
              )}

              {/* 生成中（无叙事时 stream 内轻提示） */}
              {generating && rounds.length === 0 && <div className="gen"><span className="spin" />GM 生成中…</div>}

              {/* 终局复盘态：不遮罩、续玩层继续 */}
              {gameEnd && (
                <div data-screen="end" style={{ margin: "14px 0" }} data-testid="play-endmark">
                  <div className="divider"><span className="endmark"><Flag className="lucide" />终局 · 进入复盘</span></div>
                  <p className="prose"><b>{gameEnd.outcome}</b> — {gameEnd.reason}</p>
                  <div className="rwnote" style={{ borderColor: "var(--acc)", color: "var(--acc-soft)" }}>
                    <MessageSquare className="lucide" />GM 已进入复盘：不再推进剧情，回答你关于本局的任何问题；想改走某轮可
                    <span className="btn" role="button" tabIndex={0} data-testid="play-branch" onClick={() => branch().catch(() => {})}>分支回档</span>。
                  </div>
                </div>
              )}
            </div>

            <div className="split" />

            {/* 底部当前交互：五态互斥 */}
            {screen === "choices" && choices && (
              <div className="foot">
                <div className="choices-pop">
                  <div className="ch-h" data-testid="play-choices-hint">选 1 个 · 点选项勾选 · 再点取消 · 点发送提交（或直接在下方输入框自己写）</div>
                  <div className="choices" data-testid="play-choices">
                    {choices.options.map((o) => (
                      <div key={o.index} className={"choice" + (chosen.has(o.index) ? " on" : "")} role="button" tabIndex={0}
                        onClick={() => toggleChoice(o.index)}>{o.label}</div>
                    ))}
                  </div>
                </div>
                <div className="input" data-testid="play-input">
                  <input className="box" aria-label="输入" value={draft} placeholder="说点什么，或做点什么，或问 GM 规则…"
                    onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChoices(); }} />
                  <span className="send" role="button" tabIndex={0} onClick={sendChoices}><ArrowUp className="lucide" /></span>
                </div>
              </div>
            )}
            {screen === "input" && (
              <div className="foot">
                <div className="input" data-testid="play-input">
                  <input className="box" aria-label="输入" value={draft} placeholder="说点什么，或做点什么，或问 GM 规则…"
                    onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
                  <span className="send" role="button" tabIndex={0} onClick={() => send(draft)}><ArrowUp className="lucide" /></span>
                </div>
              </div>
            )}
            {screen === "generating" && (
              <div className="foot"><div className="gen" data-testid="play-generating"><span className="spin" />GM 生成中…</div></div>
            )}
            {screen === "roll" && pendingRoll && (
              <div className="foot">
                <div className="rollcenter" data-testid="play-rollreq">
                  <button className="rollbig" data-testid="play-roll-btn" onClick={() => roll(pendingRoll.eventId).catch(() => {})}>
                    <Dices className="lucide" />丢骰子<span className="d">d{pendingRoll.shape === "outcome" ? "10" : "20"}</span>
                  </button>
                  <div className="rollhint">这一掷决定结果 · 点数由引擎裁定</div>
                </div>
              </div>
            )}
            {screen === "error" && (
              <div className="foot">
                {errorCode === "gm_timeout" ? (
                  <div className="errbar" data-testid="gm-timeout" style={{ flexWrap: "wrap" }}>
                    <AlertCircle className="lucide" /><span className="sp">{error}</span>
                    <span className="btn" role="button" tabIndex={0} data-testid="timeout-retry" onClick={() => retry().catch(() => {})}><RotateCcw className="lucide" />重试</span>
                    <span className="btn" role="button" tabIndex={0} data-testid="timeout-skip" onClick={skip}>跳过</span>
                  </div>
                ) : (
                  <div className="errbar" data-testid="play-error"><AlertCircle className="lucide" /><span className="sp">{error}</span>
                    <span className="btn" role="button" tabIndex={0} onClick={() => retry().catch(() => {})}><RotateCcw className="lucide" />重试</span></div>
                )}
              </div>
            )}
            {screen === "end" && (
              <div className="foot">
                <div className="input" data-testid="play-postmortem-input">
                  <input className="box" aria-label="复盘输入" value={draft} placeholder="复盘 · 问 GM 任何问题，或描述想改走的分支…"
                    onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
                  <span className="send" role="button" tabIndex={0} onClick={() => send(draft)}><ArrowUp className="lucide" /></span>
                </div>
              </div>
            )}

            {/* ctx-bar 上下文占用条（>90% 变红 + 压缩提示） */}
            <div className={"ctx-bar" + (ctxHot ? " hot" : "")} data-testid="play-context-usage"
              title={`当前上下文占用 ${ctxPct}% · 接近上限可 rewind / 开新局`}>
              <Gauge className="lucide" /><span className="ctx-label">上下文</span>
              <span className="ctx-track"><span className="ctx-fill" style={{ width: `${Math.min(100, ctxPct)}%` }} /></span>
              <span className="ctx-pct">{ctxPct}%</span>
              {compacting
                ? <span className="ctx-hint" data-testid="play-context-compacting"><Zap className="lucide" />正在进行上下文压缩<span className="ctx-progress" data-testid="play-context-progress" /></span>
                : ctxHot && <span className="ctx-hint" data-testid="play-context-hint"><Zap className="lucide" />即将触发压缩</span>}
            </div>
          </div>

          {/* 右 dock：dock-card 模板渲染器 */}
          <div className={"dock right" + (dockCollapsed ? " collapsed" : "") + (compactCards ? " compact" : "")} data-testid="play-dock-right">
            <div className="dock-h"><span>公开信息卡 · markdown 模板</span>
              <span className="dock-fold" role="button" tabIndex={0} data-testid="play-dock-fold" title="折叠 dock" onClick={() => setDockCollapsed((v) => !v)}><PanelRightClose className="lucide" /></span>
            </div>
            {dock.cards.map((c) => (
              <DockCard key={c.id} card={c} sheets={snapshot?.sheets ?? []} onArchive={dock.archive} onEditSource={dock.updateDiy} />
            ))}
            <div className="dcard dc-add" role="button" tabIndex={0} data-testid="play-dock-add" onClick={() => dock.addDiy()}>
              <div className="dc-head"><Sparkles className="lucide" /><span className="ttl">+ 新建 DIY 卡</span></div>
            </div>
          </div>
        </div>
      </div>

      {bay}
    </div>
  );
}

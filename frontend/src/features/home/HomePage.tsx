// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Play, Compass, Library, Hammer, Settings } from "lucide-react";
import type { SessionSummary } from "@dicelore/shared";
import { listSessions } from "@/features/play/api.js";
import { useHealth } from "@/shell/useHealth.js";
import "./home.css";

// 问候语：首访/回访分支 + 时段（镜像原型 home.html 内联脚本）。
function computeGreeting(): string {
  const h = new Date().getHours();
  const tod = h < 6 ? "夜深了" : h < 12 ? "早上好" : h < 18 ? "下午好" : "晚上好";
  let visited: string | null = null;
  try {
    visited = localStorage.getItem("home-visited");
    if (!visited) localStorage.setItem("home-visited", "1");
  } catch {
    /* localStorage 不可用时静默降级为首访态 */
  }
  return visited ? `${tod} · 旅人 · 欢迎回来` : `${tod} · 新朋友`;
}

// 运行态点：configured/running → 绿(默认)，未配 → warn(.w)，离线/未起 → .off。
function dotClass(ok: boolean, offline: boolean, warnWhenNot = false): string {
  if (offline) return "dot off";
  if (ok) return "dot";
  return warnWhenNot ? "dot w" : "dot off";
}

export default function HomePage() {
  const [greeting, setGreeting] = useState("下午好 · 旅人");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const { health, offline } = useHealth();

  // 问候语只能在客户端算（依赖 localStorage + 本地时间）。
  useEffect(() => { setGreeting(computeGreeting()); }, []);

  // 最近会话（真数据·加分项）；失败静默，摘要卡仍恒显（不阻塞落地页）。
  useEffect(() => {
    let alive = true;
    listSessions()
      .then((s) => { if (alive) setSessions(s); })
      .catch(() => { /* 离线/未起后端：保持空、走演示摘要 */ });
    return () => { alive = false; };
  }, []);

  const last: SessionSummary | undefined = sessions[0];
  const resumeTo = last ? `/play/${encodeURIComponent(last.sessionId)}` : "/play";
  const resumeTitle = last?.title ?? "黑风寨的钟声 · 第二幕「夜入山寨」";
  const resumeWhere = last
    ? `${last.packName}${last.lastActionAt ? ` · ${new Date(last.lastActionAt).toLocaleString()}` : ""}`
    : "张三 · HP 12/15 · 金钱 77 · 进度 2/5 · 3 分钟前";

  return (
    <>
      <main className="home">
        <div className="hello" data-testid="home-hello">{greeting}</div>
        <div className="htitle">欢迎来到 Dicelore</div>
        <div className="hsub">
          让 AI 当你的 <b>GM（游戏主持人）</b>，带你跑一场文字冒险。造一个 <b>团本（剧本）</b>，或续上一局存档。
        </div>

        <div className="guide" data-testid="home-guide">
          <h3>怎么开始</h3>
          <ol>
            <li>去 <b>团本</b> 页选一个团本 → 开始游戏（默认最新版），跳到跑团。</li>
            <li>没有团本？去 <b>制作</b> 页丢一本小说，让构建助手造一个。</li>
            <li>跑团中随时掷骰 / 选项；断线重连自动补齐。</li>
          </ol>
          <a
            className="manual"
            href="/docs/wiki/指南/README.md"
            target="_blank"
            rel="noreferrer"
            data-testid="home-manual-link"
          >
            <BookOpen className="lucide" />阅读使用手册
          </a>
        </div>

        {/* 最近一个会话摘要卡（恒显一张·整卡 <a>→/play·非全量列表） */}
        <div className="label">最近一个会话</div>
        <Link className="resume" to={resumeTo} data-testid="home-recent-session">
          <div className="meta">
            <div className="scen">{resumeTitle}</div>
            <div className="where">{resumeWhere}</div>
          </div>
          <span className="cont" data-testid="home-recent-continue">
            <Play className="lucide" />继续跑团
          </span>
        </Link>

        {/* 空态块 + 强 CTA（start-cta 恒显·不隐藏）。有会话时改文案避免自相矛盾。 */}
        <div className="empty-first" data-testid="home-empty-session">
          <Compass className="lucide" />
          <div className="ef-t">{last ? "开一局新的冒险" : "还没有进行中的会话"}</div>
          <div className="ef-sub">挑一个团本立刻开局，或丢一本小说让助手造一个。</div>
          <Link className="btn go lg" to="/adventures" data-testid="home-start-cta">
            <Play className="lucide" />去挑团本开局
          </Link>
          <Link className="btn" to="/build">或去制作页造一个</Link>
        </div>

        <div className="label">快速入口</div>
        <div className="quick">
          <Link className="qcard featured" to="/adventures" data-testid="home-quick-catalog">
            <span className="tag-rec">推荐开局</span>
            <div className="ico"><Library className="lucide" /></div>
            <div className="qt">团本目录</div>
            <div className="qd">选团本开局 / 导入</div>
          </Link>
          <Link className="qcard" to="/build" data-testid="home-quick-build">
            <div className="ico"><Hammer className="lucide" /></div>
            <div className="qt">团本制作</div>
            <div className="qd">丢本小说造团本</div>
          </Link>
          <Link className="qcard" to="/config" data-testid="home-quick-config">
            <div className="ico"><Settings className="lucide" /></div>
            <div className="qt">配置</div>
            <div className="qd">服务 / MCP / 模型</div>
          </Link>
        </div>
      </main>

      {/* 角落运行态徽章（落地页·key 配错玩不了有提示）。useHealth 离线安全。 */}
      <div className="runstatus-pill" data-testid="home-runstatus">
        <span><span className={dotClass(!!health?.model.configured, offline)} />模型</span>
        <span><span className={dotClass(!!health?.mcp.running, offline)} />MCP</span>
        <span>
          <span className={dotClass(!!health?.notify.configured, offline, true)} />
          {health?.notify.configured ? "notify" : "notify 未配"}
        </span>
      </div>
    </>
  );
}

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
import { Play, Dices, Hammer, MessagesSquare, Settings, Swords, Clock, Flag } from "lucide-react";
import type { SessionSummary } from "@dicelore/shared";
import { listSessions } from "../api/client.js";

const STATUS_LABEL: Record<SessionSummary["status"], string> = {
  active: "进行中",
  archived: "已存档",
  ended: "终局",
};
const STATUS_ICON: Record<SessionSummary["status"], typeof Swords> = {
  active: Swords,
  archived: Clock,
  ended: Flag,
};

const QUICK = [
  { Icon: Dices, qt: "开新局", qd: "选团本 / 存档起一局", to: "/play" },
  { Icon: Hammer, qt: "团本制作", qd: "丢本小说造团本", to: "/build" },
  { Icon: MessagesSquare, qt: "会话管理", qd: "搜索 / 续档 / 删档", to: "/config" },
  { Icon: Settings, qt: "配置", qd: "服务 / MCP / 模型", to: "/config" },
];

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((s) => { if (alive) setSessions(s); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const list = sessions ?? [];
  const last = list[0];

  return (
    <main className="home">
      <div className="hello">Good evening · 旅人</div>
      <div className="htitle">{last ? `夜还长，要继续${last.title}吗？` : "欢迎回到案上"}</div>
      <div className="hsub">
        {error ? "" : last ? "上次的故事还在等你落座。" : "选一个团本，开一局新的故事。"}
      </div>

      {error && <div className="herror">加载失败：{error}</div>}

      {last && (
        <div className="resume" aria-label="继续上次">
          <div className="meta">
            <div className="scen">{last.title}</div>
            <div className="where">{STATUS_LABEL[last.status]}{last.updatedAt ? ` · ${new Date(last.updatedAt).toLocaleString()}` : ""}</div>
          </div>
          <Link className="cont" to="/play"><Play className="lucide" />继续跑团</Link>
        </div>
      )}

      <div className="quick">
        {QUICK.map(({ Icon, qt, qd, to }) => (
          <Link className="qcard" to={to} key={qt}>
            <div className="ico"><Icon className="lucide" /></div>
            <div className="qt">{qt}</div>
            <div className="qd">{qd}</div>
          </Link>
        ))}
      </div>

      <div className="label">最近 Session</div>
      <div className="recent">
        {list.length === 0 ? (
          <div className="row"><span className="rs">暂无会话，去开新局</span></div>
        ) : (
          list.map((s) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <Link className="row" to="/play" key={s.sessionId}>
                <Icon className="lucide" />
                <span className="rs">{s.title}</span>
                <span className={"tag" + (s.status === "active" ? " live" : "")}>{STATUS_LABEL[s.status]}</span>
                {s.updatedAt && <span className="rt">{new Date(s.updatedAt).toLocaleDateString()}</span>}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}

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
import type { SessionSummary } from "@dicelore/shared";
import { listSessions } from "../api/client.js";
import "./HomePage.css";

const STATUS_LABEL: Record<SessionSummary["status"], string> = {
  active: "进行中",
  archived: "已归档",
  ended: "已终局",
};

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

  if (error) {
    return (
      <main className="home">
        <div className="home-error">加载失败：{error}</div>
      </main>
    );
  }

  const list = sessions ?? [];
  const last = list[0];

  return (
    <main className="home">
      <h1 className="home-title">欢迎回到案上</h1>

      {last ? (
        <section className="home-continue" aria-label="继续上次">
          <div className="home-continue-label">继续上次</div>
          <div className="home-continue-title">{last.title}</div>
          <span className="home-badge">{STATUS_LABEL[last.status]}</span>
          <Link className="home-resume" to="/play">继续跑团</Link>
        </section>
      ) : (
        <section className="home-empty">
          暂无会话，<Link className="home-link" to="/build">去开新局</Link>
        </section>
      )}

      <section className="home-recent" aria-label="最近 Session">
        <h2 className="home-h2">最近 Session</h2>
        {list.length === 0 ? (
          <p className="home-muted">暂无会话</p>
        ) : (
          <ul className="home-sessions">
            {list.map((s) => (
              <li key={s.sessionId} className="home-session">
                <span className="home-session-title">{s.title}</span>
                <span className="home-badge">{STATUS_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

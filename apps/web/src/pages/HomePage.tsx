// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, Dices, Hammer, MessagesSquare, Settings, Swords, Clock, Flag } from "lucide-react";
import type { SessionSummary } from "@dicelore/shared";
import { listSessions, commitPack, openPlaySession } from "../api/client.js";
import { useT } from "../i18n/index.js";

// 示例团本(快速验证「建团本→开局玩」闭环;无需 LLM)。
const SAMPLE_PACK = [
  { path: "manifest.md", content: "# 示例·黑风寨\n\n- id: sample" },
  { path: "lore/黑风寨.md", content: "黑风寨盘踞鹰愁涧,当家钟三爷使子母钟锤。" },
  { path: "state/开局.csv", content: "entity,kind,attr,value,visible\n旅人,player,HP,12,1\n旅人,player,身上银两,30,1\n" },
];

const STATUS_ICON: Record<SessionSummary["status"], ComponentType<{ className?: string }>> = {
  active: Swords, archived: Clock, ended: Flag,
};

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 6) return "home.greeting.night";
  if (h < 12) return "home.greeting.morning";
  if (h < 18) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

export default function HomePage() {
  const t = useT();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // 造示例团本 → 开局 import → 跳跑团页(端到端闭环)。
  async function quickPlay() {
    setBusy(true);
    setError(null);
    try {
      const { tuanbenId, commitId } = await commitPack("示例·黑风寨", "sample", SAMPLE_PACK);
      const sid = `s-${commitId.slice(0, 8)}`;
      await openPlaySession(sid, tuanbenId, commitId);
      navigate(`/play/${sid}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((s) => { if (alive) setSessions(s); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const list = sessions ?? [];
  const last = list[0];
  const statusLabel = (s: SessionSummary["status"]) => t(`status.${s}`);

  const QUICK = [
    { Icon: Dices, qt: t("home.quick.newgame"), qd: t("home.quick.newgame.d"), to: "/play" },
    { Icon: Hammer, qt: t("home.quick.build"), qd: t("home.quick.build.d"), to: "/build" },
    { Icon: MessagesSquare, qt: t("home.quick.sessions"), qd: t("home.quick.sessions.d"), to: "/play" },
    { Icon: Settings, qt: t("home.quick.config"), qd: t("home.quick.config.d"), to: "/config" },
  ];

  return (
    <main className="home">
      <div className="hello">{t(greetingKey())} · {t("home.traveler")}</div>
      <div className="htitle">{last ? t("home.welcome.resume", { title: last.title }) : t("home.welcome.empty")}</div>
      <div className="hsub">{error ? "" : last ? t("home.sub.resume") : t("home.sub.empty")}</div>

      {error && <div className="herror">{t("home.error", { msg: error })}</div>}

      <div className="resume" aria-label="快速开局">
        <div className="meta">
          <div className="scen">{t("home.sample.title")}</div>
          <div className="where">{t("home.sample.where")}</div>
        </div>
        <button className="cont" onClick={quickPlay} disabled={busy} data-testid="quick-play">
          <Play className="lucide" />{busy ? t("home.sample.btn.busy") : t("home.sample.btn")}
        </button>
      </div>

      {last && (
        <div className="resume" aria-label="继续上次">
          <div className="meta">
            <div className="scen">{last.title}</div>
            <div className="where">{statusLabel(last.status)}{last.updatedAt ? ` · ${new Date(last.updatedAt).toLocaleString()}` : ""}</div>
          </div>
          <Link className="cont" to="/play"><Play className="lucide" />{t("home.continue")}</Link>
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

      <div className="label">{t("home.recent")}</div>
      <div className="recent">
        {list.length === 0 ? (
          <div className="row"><span className="rs">{t("home.recent.empty")}</span></div>
        ) : (
          list.map((s) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <Link className="row" to="/play" key={s.sessionId}>
                <Icon className="lucide" />
                <span className="rs">{s.title}</span>
                <span className={"tag" + (s.status === "active" ? " live" : "")}>{statusLabel(s.status)}</span>
                {s.updatedAt && <span className="rt">{new Date(s.updatedAt).toLocaleDateString()}</span>}
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState, type ComponentType } from "react";
import { SlidersHorizontal, Network, Plug, BrainCircuit, Palette, Database, Info } from "lucide-react";
import { ThemeAppearance } from "@/features/config/ThemeAppearance.js";
import { General } from "@/features/config/General.js";
import { ServiceNetwork } from "@/features/config/ServiceNetwork.js";
import { McpServers } from "@/features/config/McpServers.js";
import { ModelConnection } from "@/features/config/ModelConnection.js";
import { DataStorage } from "@/features/config/DataStorage.js";
import { About } from "@/features/config/About.js";
import { useT } from "@/shared/i18n/index.js";
import "@/features/config/config.css";

// 配置（子页型 · 视觉页 §6 / config.html）：左导航(设置分组 + 图标) + 右子页。
// 子页选择读 URL 片段 #v=<view>（config-local 深链，非通用 hash harness）：
// 默认 general；监听 hashchange 支持深链导航（spec 用 #v=model|mcp|… 直达各子页）。
type View = "general" | "network" | "mcp" | "model" | "theme" | "data" | "about";
const VIEWS: readonly View[] = ["general", "network", "mcp", "model", "theme", "data", "about"];

const NAV: { view: View; key: string; Icon: ComponentType<{ className?: string }>; Sub: ComponentType }[] = [
  { view: "general", key: "cfg.general", Icon: SlidersHorizontal, Sub: General },
  { view: "network", key: "cfg.service", Icon: Network, Sub: ServiceNetwork },
  { view: "mcp", key: "cfg.mcp", Icon: Plug, Sub: McpServers },
  { view: "model", key: "cfg.model", Icon: BrainCircuit, Sub: ModelConnection },
  { view: "theme", key: "cfg.theme", Icon: Palette, Sub: ThemeAppearance },
  { view: "data", key: "cfg.data", Icon: Database, Sub: DataStorage },
  { view: "about", key: "cfg.about", Icon: Info, Sub: About },
];

function readHashView(): View {
  if (typeof window === "undefined") return "general";
  const m = window.location.hash.match(/v=([a-z]+)/);
  const v = (m?.[1] ?? "") as View;
  return VIEWS.includes(v) ? v : "general";
}

export default function ConfigPage() {
  const t = useT();
  const [view, setView] = useState<View>(readHashView);

  useEffect(() => {
    const onHash = () => setView(readHashView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function nav(v: View) {
    setView(v);
    try { window.location.hash = `v=${v}`; } catch { /* noop */ }
  }

  const Sub = NAV.find((n) => n.view === view)?.Sub ?? General;

  return (
    <div className="cfg">
      <nav className="sidenav" aria-label="配置导航">
        <div className="sn-grp">{t("cfg.group")}</div>
        {NAV.map(({ view: v, key, Icon }) => (
          <button
            key={v}
            data-testid={`config-nav-${v}`}
            className={"sn" + (v === view ? " on" : "")}
            onClick={() => nav(v)}
          >
            <Icon className="lucide" />{t(key)}
          </button>
        ))}
      </nav>
      <section className="main" data-testid="config-subpage">
        <Sub />
      </section>
    </div>
  );
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useState, type ComponentType } from "react";
import { SlidersHorizontal, Network, Plug, BrainCircuit, Palette, Database, Info } from "lucide-react";
import { ThemeAppearance } from "../config/ThemeAppearance.js";
import { General } from "../config/General.js";
import { ServiceNetwork } from "../config/ServiceNetwork.js";
import { McpServers } from "../config/McpServers.js";
import { ModelConnection } from "../config/ModelConnection.js";
import { DataStorage } from "../config/DataStorage.js";
import { About } from "../config/About.js";
import { useT } from "../i18n/index.js";

// 配置（子页型 · 视觉页 §6 / config.html）：左导航(设置分组 + 图标) + 右子页。
const NAV: { key: string; Icon: ComponentType<{ className?: string }>; Sub: ComponentType }[] = [
  { key: "cfg.general", Icon: SlidersHorizontal, Sub: General },
  { key: "cfg.service", Icon: Network, Sub: ServiceNetwork },
  { key: "cfg.mcp", Icon: Plug, Sub: McpServers },
  { key: "cfg.model", Icon: BrainCircuit, Sub: ModelConnection },
  { key: "cfg.theme", Icon: Palette, Sub: ThemeAppearance },
  { key: "cfg.data", Icon: Database, Sub: DataStorage },
  { key: "cfg.about", Icon: Info, Sub: About },
];

export default function ConfigPage() {
  const t = useT();
  const [active, setActive] = useState("cfg.general");
  const Sub = NAV.find((n) => n.key === active)?.Sub ?? General;

  return (
    <div className="cfg">
      <nav className="sidenav" aria-label="配置导航">
        <div className="sn-grp">{t("cfg.group")}</div>
        {NAV.map(({ key, Icon }) => (
          <button key={key} className={"sn" + (key === active ? " on" : "")} onClick={() => setActive(key)}>
            <Icon className="lucide" />{t(key)}
          </button>
        ))}
      </nav>
      <section className="main">
        <Sub />
      </section>
    </div>
  );
}

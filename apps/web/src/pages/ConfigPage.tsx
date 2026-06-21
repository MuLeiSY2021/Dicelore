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

// 配置（子页型 · 视觉页 §6 / config.html）：左导航(设置分组 + 图标) + 右子页。
const NAV: { label: string; Icon: ComponentType<{ className?: string }>; Sub: ComponentType }[] = [
  { label: "通用", Icon: SlidersHorizontal, Sub: General },
  { label: "服务与网络", Icon: Network, Sub: ServiceNetwork },
  { label: "MCP 服务器", Icon: Plug, Sub: McpServers },
  { label: "模型连接", Icon: BrainCircuit, Sub: ModelConnection },
  { label: "主题外观", Icon: Palette, Sub: ThemeAppearance },
  { label: "数据与存储", Icon: Database, Sub: DataStorage },
  { label: "关于", Icon: Info, Sub: About },
];

export default function ConfigPage() {
  const [active, setActive] = useState("通用");
  const Sub = NAV.find((n) => n.label === active)?.Sub ?? General;

  return (
    <div className="cfg">
      <nav className="sidenav" aria-label="配置导航">
        <div className="sn-grp">设置</div>
        {NAV.map(({ label, Icon }) => (
          <button key={label} className={"sn" + (label === active ? " on" : "")} onClick={() => setActive(label)}>
            <Icon className="lucide" />{label}
          </button>
        ))}
      </nav>
      <section className="main">
        <Sub />
      </section>
    </div>
  );
}

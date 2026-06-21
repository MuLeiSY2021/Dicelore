import { useState } from "react";
import { ThemeAppearance } from "../config/ThemeAppearance.js";
import { General } from "../config/General.js";
import { ServiceNetwork } from "../config/ServiceNetwork.js";
import { McpServers } from "../config/McpServers.js";
import { ModelConnection } from "../config/ModelConnection.js";
import { DataStorage } from "../config/DataStorage.js";
import { About } from "../config/About.js";
import "./ConfigPage.css";

// 配置（子页型 · 视觉页 §6）：左导航 + 右内容。按 active 分派到各子页（主题外观接 useTheme，其余为展示态骨架）。
const NAV = [
  "通用", "服务与网络", "MCP 服务器", "模型连接", "主题外观", "数据与存储", "关于",
] as const;
type Nav = (typeof NAV)[number];

function renderSub(active: Nav) {
  switch (active) {
    case "通用": return <General />;
    case "服务与网络": return <ServiceNetwork />;
    case "MCP 服务器": return <McpServers />;
    case "模型连接": return <ModelConnection />;
    case "主题外观": return <ThemeAppearance />;
    case "数据与存储": return <DataStorage />;
    case "关于": return <About />;
  }
}

export default function ConfigPage() {
  const [active, setActive] = useState<Nav>("通用");

  return (
    <div className="cfg">
      <nav className="cfg-nav" aria-label="配置导航">
        {NAV.map((n) => (
          <button
            key={n}
            className={"cfg-navitem" + (n === active ? " active" : "")}
            onClick={() => setActive(n)}
          >
            {n}
          </button>
        ))}
      </nav>
      <section className="cfg-content">
        {renderSub(active)}
      </section>
    </div>
  );
}

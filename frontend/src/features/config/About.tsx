// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useT } from "@/shared/i18n/index.js";
import { useHealth } from "@/shell/useHealth.js";

// 配置 → 关于：版本(来自 health · 缺省回退) / 许可 / 项目。
export function About() {
  const t = useT();
  const { health } = useHealth();
  const version = health
    ? `Dicelore v0.x · ${health.fakeGm ? "FAKE_GM" : "live"} · ${health.protocol}`
    : "Dicelore v0.x（开发中）";
  return (
    <>
      <div className="mhead"><h3>{t("cfg.about")}</h3></div>
      <div className="mdesc">给 AI 套上 GM 行为塑形框架的文字冒险引擎。</div>
      <div className="section">
        <div className="frow">
          <span className="flabel">{t("cfg.about.version")}<div className="fhint">来自 health</div></span>
          <div className="fctrl"><span className="fval" data-testid="config-about-version">{version}</span></div>
        </div>
        <div className="frow">
          <span className="flabel">许可</span>
          <div className="fctrl"><span className="fval">AGPL-3.0-or-later</span></div>
        </div>
        <div className="frow">
          <span className="flabel">项目</span>
          <div className="fctrl"><span className="fval" style={{ color: "var(--acc-soft)" }}>github.com/MuLeiSY2021/dicelore</span></div>
        </div>
      </div>
    </>
  );
}

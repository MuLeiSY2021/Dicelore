// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Library, Dices, Hammer, Settings, ChevronsRight, Menu, PanelLeftOpen, X } from "lucide-react";
import { useI18n } from "@/shared/i18n/index.js";
import { useHealth } from "@/shell/useHealth.js";

// 全局底部 app-bay（仿 mac 聚焦出现）：nav-tabs 五块导航 + collapse/expand + nav-status 运行态。
// 期望态权威来源：docs/tdd/acceptance-loop-2026-07-06/frontend/{play,build}.html 的 .bay 结构。
// 跨页行为：跑团页默认收起(body.bay-nav-collapsed)、其他页展开；主题/语言已收进配置页。
// 页面专属 bay 按钮（play 的 session/chara/… · build 的 session/usage）由各页经 children 注入（属 W4）。

type NavItem = { to: string; tabKey: string; navKey: string; tag: string; Icon: ComponentType<{ className?: string }>; end: boolean };

const NAV: NavItem[] = [
  { to: "/", tabKey: "bay.tab.home", navKey: "nav.home", tag: "home", Icon: Home, end: true },
  { to: "/adventures", tabKey: "bay.tab.catalog", navKey: "nav.catalog", tag: "catalog", Icon: Library, end: false },
  { to: "/play", tabKey: "bay.tab.play", navKey: "nav.play", tag: "play", Icon: Dices, end: false },
  { to: "/build", tabKey: "bay.tab.build", navKey: "nav.build", tag: "build", Icon: Hammer, end: false },
  { to: "/config", tabKey: "bay.tab.config", navKey: "nav.config", tag: "config", Icon: Settings, end: false },
];

// data-testid 后缀：路由 tag → prototype nav-tab-* / nav-row-* 锚点。

export function Bay({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const { health, offline } = useHealth();
  const isPlay = pathname === "/play" || pathname.startsWith("/play/");
  const [collapsed, setCollapsed] = useState(isPlay);
  const [navOpen, setNavOpen] = useState(false);

  // 跨页默认态：跑团页收起、其他页展开（每次切页重置，匹配原型 per-page 行为）。
  useEffect(() => { setCollapsed(isPlay); }, [isPlay]);

  // 显隐模式（配置页 bay 行为写 localStorage bay-mode）：focus 聚焦出现 / always 常驻 / hidden 隐藏。
  // 配置页改后派发 dicelore:baymode 立即生效；跨标签页走 storage 事件。
  useEffect(() => {
    const apply = () => {
      const mode = (typeof localStorage !== "undefined" && localStorage.getItem("bay-mode")) || "focus";
      document.body.classList.toggle("bay-always", mode === "always");
      document.body.classList.toggle("bay-hidden", mode === "hidden");
    };
    apply();
    window.addEventListener("dicelore:baymode", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("dicelore:baymode", apply);
      window.removeEventListener("storage", apply);
      document.body.classList.remove("bay-always", "bay-hidden");
    };
  }, []);

  // body.bay-nav-collapsed 驱动 CSS（tabs 与 ≡导航 按钮互斥显隐 + 跑团页沉浸）。
  useEffect(() => {
    document.body.classList.toggle("bay-nav-collapsed", collapsed);
    return () => document.body.classList.remove("bay-nav-collapsed");
  }, [collapsed]);

  const expand = () => { setCollapsed(false); setNavOpen(false); };

  return (
    <>
      <div className="bay-wrap" />
      <div className="bay" data-testid="app-bay">
        <span className="bay-tabs" data-testid="app-bay-nav-tabs">
          {NAV.map(({ to, tabKey, tag, Icon, end }) => (
            <NavLink key={to} to={to} end={end} data-testid={`nav-tab-${tag}`}
              className={({ isActive }) => "bay-tab" + (isActive ? " on" : "")}>
              <Icon className="lucide" /><span className="bt-n">{t(tabKey)}</span>
            </NavLink>
          ))}
        </span>
        <span className="bay-btn bay-nav-collapse" data-testid="app-bay-nav-collapse"
          title={t("bay.nav.collapse")} role="button" tabIndex={0} onClick={() => setCollapsed(true)}>
          <ChevronsRight className="lucide" />
        </span>
        <span className="bay-btn bay-nav-open" data-testid="app-bay-nav"
          role="button" tabIndex={0} onClick={() => { setCollapsed(false); setNavOpen(true); }}>
          <Menu className="lucide" />{t("bay.nav")}
        </span>
        {children}
      </div>

      <div className="popover" id="bay-nav" data-testid="app-bay-popover-nav" hidden={!navOpen}
        onClick={(e) => { if (e.target === e.currentTarget) setNavOpen(false); }}>
        <div className="pop-card">
          <div className="pop-head">
            <Menu className="lucide" />{t("bay.nav")}<span className="sp" />
            <span className="x" role="button" tabIndex={0} onClick={() => setNavOpen(false)}><X className="lucide" /></span>
          </div>
          <div className="pop-body">
            {NAV.map(({ to, navKey, tag, Icon, end }) => (
              <NavLink key={to} to={to} end={end} data-testid={`nav-row-${tag}`}
                className={({ isActive }) => "nav-row" + (isActive ? " on" : "")}
                onClick={() => setNavOpen(false)}>
                <Icon className="lucide" />{t(navKey)}<span className="nr-sp" /><span className="nr-tag">{tag}</span>
              </NavLink>
            ))}
            <div className="bay-nav-expand" data-testid="app-bay-nav-expand"
              role="button" tabIndex={0} onClick={expand}>
              <PanelLeftOpen className="lucide" />{t("bay.nav.expand")}
            </div>
            <div className="nav-status" data-testid="shell-runstatus">
              <span><span className={"dot" + (!offline && health?.model.configured ? "" : " w")} />{t("bar.model")} {health?.model.gm ?? "—"}</span>
              <span><span className={"dot" + (!offline && health?.mcp.running ? "" : " off")} />{t("bar.mcp")}{health ? ` ${health.mcp.toolCount}` : ""}</span>
              <span><span className={"dot" + (!offline && health?.notify.configured ? "" : " w")} />{t("bar.notify")} {!offline && health?.notify.configured ? t("bar.notify.connected") : t("bar.notify.unset")}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

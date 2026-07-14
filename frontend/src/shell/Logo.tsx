// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// Dicelore 品牌标志：宝石切面 d20(亮金切面 + 内黑棱 + 外金边)+ Pirata One「20」+ 字标 Dice金/lore白/.朱。
// 忠实还原 wiki/开发指南/04-子系统设计/玩家客户端-视觉草图/logo.html。自包含 SVG(无 <use>/defs，可多实例)；
// 内棱/外边/数字色走 CSS 变量(--logo-edge / --logo-rim)随明暗主题切换(见 tokens.css)。

// 七面切面(各自金色深浅)——与 logo.html #fill 一致。
const FACETS: { points: string; fill: string }[] = [
  { points: "32,4.5 8.1,18.25 13,44 32,13", fill: "#ecca7a" },
  { points: "32,4.5 32,13 51,44 55.9,18.25", fill: "#ecca7a" },
  { points: "32,13 13,44 51,44", fill: "#d4a83e" },
  { points: "8.1,18.25 8.1,45.75 13,44", fill: "#ad8430" },
  { points: "55.9,18.25 51,44 55.9,45.75", fill: "#ad8430" },
  { points: "13,44 8.1,45.75 32,59.5 32,44", fill: "#8a6826" },
  { points: "51,44 32,44 32,59.5 55.9,45.75", fill: "#8a6826" },
];
// 内棱线(描以 --logo-edge，呈蚀刻黑棱)。
const INNER_LINES: string[] = [
  "M32,13 L13,44 L51,44 Z",
  "M32,13 L32,4.5",
  "M13,44 L8.1,18.25", "M51,44 L55.9,18.25",
  "M13,44 L8.1,45.75", "M51,44 L55.9,45.75",
  "M32,44 L32,59.5",
];

export interface LogoProps {
  /** 标志尺寸(px)，d20 单标边长；字标按比例。 */
  size?: number;
  /** lockup=d20+字标横排；mark=仅 d20；wordmark=仅字标。 */
  variant?: "lockup" | "mark" | "wordmark";
  className?: string;
}

function D20({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 64 64" shapeRendering="geometricPrecision" aria-hidden="true" style={{ display: "block", flex: "none" }}>
      {FACETS.map((f, i) => (
        <polygon key={i} points={f.points} fill={f.fill} stroke={f.fill} strokeWidth={0.8} />
      ))}
      {INNER_LINES.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--logo-edge)" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <polygon points="32,4.5 55.9,18.25 55.9,45.75 32,59.5 8.1,45.75 8.1,18.25" fill="none" stroke="var(--logo-rim)" strokeWidth={1.6} strokeLinejoin="round" />
      <text x="32" y="39" textAnchor="middle" fontFamily="'Pirata One', system-ui" fontSize="15" fill="var(--logo-edge)">20</text>
    </svg>
  );
}

function Wordmark({ px }: { px: number }) {
  return (
    <span className="logo-wm" style={{ fontSize: px }}>
      <span className="g">Dice</span><span className="w">lore</span><span className="dot">.</span>
    </span>
  );
}

export function Logo({ size = 30, variant = "lockup", className }: LogoProps) {
  // 预留品牌 API：当前全仓仅用 lockup（见 TopBar）。mark/wordmark 两分支暂无消费者，
  // 保留以备『仅标记 / 仅字标』放置点（如 favicon / 加载态）出现时直接复用。
  if (variant === "mark") return <span className={"logo " + (className ?? "")}><D20 px={size} /></span>;
  if (variant === "wordmark") return <span className={"logo " + (className ?? "")}><Wordmark px={size} /></span>;
  return (
    <span className={"logo logo-lockup " + (className ?? "")}>
      <D20 px={size} />
      <Wordmark px={Math.round(size * 0.62)} />
    </span>
  );
}

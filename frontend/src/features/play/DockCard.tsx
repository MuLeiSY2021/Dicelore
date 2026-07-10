// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// dock-card 组件（裁决 dock-card-template）：markdown 模板渲染器。
//   dc-meta（默认隐/编辑显模板源码）+ dc-body（插值后 markdown 渲染）+ 三按钮 edit/archive/fold。
//   count=0 不渲染 card（select 选不出数据时不占位）；DIY 卡只取 visible=1（C3）。

import { useState, type ComponentType } from "react";
import { Pencil, Archive, ChevronDown, User } from "lucide-react";
import { Markdown } from "@/features/play/Markdown.js";
import { parseTemplate, runSelect, expandTemplate, extractVisuals, type Visual } from "@/features/play/dockCard.js";
import type { SheetGroup } from "@dicelore/shared";

export interface DockCardDef {
  id: string;
  title: string;
  Icon: ComponentType<{ className?: string }>;
  source: string; // 模板源码（dc-meta + dc-body）
  diy: boolean;    // true=玩家 DIY（localStorage、可改、仅 visible=1）；false=作者预设（只读）
  testid?: string;
}

function Dial({ v }: { v: Visual }) {
  const pct = Math.max(0, Math.min(100, v.value));
  return (
    <span className="dc-dial" data-testid="play-card-dial" title={`${v.attr} ${v.value}`}>
      <svg viewBox="0 0 36 36" className="dial-svg"><circle className="dial-bg" cx="18" cy="18" r="15.9" /><circle className="dial-fg" cx="18" cy="18" r="15.9" style={{ strokeDasharray: `${pct} 100` }} /></svg>
      <span className="dial-pct">{v.value}</span>
    </span>
  );
}
function Bar({ v }: { v: Visual }) {
  const pct = Math.max(0, Math.min(100, v.value));
  return (
    <span className="dc-bar" data-testid="play-card-bar" title={`${v.attr} ${v.value}`}>
      <span className="dc-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function DockCard({ card, sheets, onArchive, onEditSource }: {
  card: DockCardDef;
  sheets: SheetGroup[];
  onArchive: (id: string) => void;
  onEditSource?: (id: string, source: string) => void; // DIY 编辑保存
}) {
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [src, setSrc] = useState(card.source);

  const { meta, body } = parseTemplate(src);
  const records = runSelect(meta, sheets, card.diy);
  const md = expandTemplate(body, records);
  // count=0（select 选不出数据）→ 不渲染 card；编辑态例外（要能改模板）。
  if (md == null && !editing) return null;
  const { markdown, visuals } = extractVisuals(md ?? "", records[0]);

  const Icon = card.Icon ?? User;
  return (
    <div className={"dcard" + (editing ? " editing" : "") + (collapsed ? " collapsed" : "")}
      data-testid={card.testid ?? `play-card-${card.id}`}>
      <div className="dc-head">
        <Icon className="lucide" /><span className="ttl">{card.title}</span>
        <span className="dc-acts">
          <span className="dc-act" role="button" tabIndex={0} data-testid="play-card-edit" title="编辑模板"
            onClick={() => setEditing((v) => !v)}><Pencil className="lucide" /></span>
          <span className="dc-act" role="button" tabIndex={0} data-testid="play-card-archive" title="归档"
            onClick={() => onArchive(card.id)}><Archive className="lucide" /></span>
          <span className="dc-act fold" role="button" tabIndex={0} data-testid="play-card-fold" title="折叠"
            onClick={() => setCollapsed((v) => !v)}><ChevronDown className="lucide" /></span>
        </span>
      </div>
      {editing ? (
        <textarea className="dc-meta" data-testid="play-card-meta" value={src} readOnly={!card.diy}
          aria-label="模板源码"
          onChange={(e) => { if (card.diy) { setSrc(e.target.value); onEditSource?.(card.id, e.target.value); } }} />
      ) : (
        <div className="dc-body" data-testid="play-card-body">
          <Markdown text={markdown} />
          {visuals.map((v, i) => (v.kind === "dial" ? <Dial key={i} v={v} /> : <Bar key={i} v={v} />))}
        </div>
      )}
    </div>
  );
}

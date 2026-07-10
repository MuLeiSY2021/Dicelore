// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// dock-card 集合管理（裁决 dock-card-template §三/§四）：
//   · 预设卡：v1 从 GET /presentation 的 sheets/plotlines/lore 派生（团本包 tools/*.json 预设模板待接线，
//     现按数据直接合成模板——所有玩家共享、只读语义等价）。
//   · DIY 卡 + 归档态：纯前端 localStorage（跨会话本机保留、不落后端）。

import { useCallback, useEffect, useState } from "react";
import { User, GitBranch, BookOpen, Wand2 } from "lucide-react";
import type { PresentationSnapshot } from "@dicelore/shared";
import type { DockCardDef } from "@/features/play/DockCard.js";

export interface DiyCard { id: string; title: string; source: string }

const archivedKey = (sid: string) => `dicelore.dock.archived.${sid}`;
const diyKey = (sid: string) => `dicelore.dock.diy.${sid}`;

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 隐私模式忽略 */ }
}

// 从 presentation 派生预设 dock 卡（各卡模板 = 数据选择器 + markdown 体）。
export function derivePresetCards(snap: PresentationSnapshot | null): DockCardDef[] {
  if (!snap) return [];
  const cards: DockCardDef[] = [];
  for (const g of snap.sheets ?? []) {
    const lines = g.cells.map((c) => `- ${c.attr}: \${${c.attr}}`).join("\n");
    cards.push({
      id: `status:${g.entity}`, title: `角色 · ${g.entity}`, Icon: User, diy: false,
      source: `select ${g.entity}\n\n## 角色 · ${g.entity}\n${lines}`,
    });
  }
  for (const p of snap.plotlines ?? []) {
    cards.push({
      id: `plotline:${p.id}`, title: `剧情线 · ${p.title}`, Icon: GitBranch, diy: false,
      source: `select ${p.id}\n\n## 剧情线 · ${p.title}\n状态: ${p.status}${p.summary ? `\n${p.summary}` : ""}`,
    });
  }
  for (const l of snap.lore ?? []) {
    cards.push({
      id: `world:${l.name}`, title: `世界书 · ${l.name}`, Icon: BookOpen, diy: false,
      source: `select ${l.name}\n\n## ${l.name}\n${l.content}`,
    });
  }
  return cards;
}

export function useDock(sid: string, snap: PresentationSnapshot | null) {
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [diy, setDiy] = useState<DiyCard[]>([]);

  useEffect(() => {
    setArchived(new Set(load<string[]>(archivedKey(sid), [])));
    setDiy(load<DiyCard[]>(diyKey(sid), []));
  }, [sid]);

  const persistArchived = (next: Set<string>) => { setArchived(next); save(archivedKey(sid), [...next]); };
  const persistDiy = (next: DiyCard[]) => { setDiy(next); save(diyKey(sid), next); };

  const archive = useCallback((id: string) => setArchived((prev) => { const n = new Set(prev); n.add(id); save(archivedKey(sid), [...n]); return n; }), [sid]);
  const restore = useCallback((id: string) => setArchived((prev) => { const n = new Set(prev); n.delete(id); save(archivedKey(sid), [...n]); return n; }), [sid]);
  const addDiy = useCallback(() => {
    const id = `diy:${Date.now()}`;
    persistDiy([...diy, { id, title: "DIY · 新卡", source: "-- 自定义模板\nselect \n\n## 新卡\n- 属性: ${属性}" }]);
    return id;
  }, [diy, sid]); // eslint-disable-line react-hooks/exhaustive-deps
  const updateDiy = useCallback((id: string, source: string) => {
    persistDiy(diy.map((c) => (c.id === id ? { ...c, source } : c)));
  }, [diy, sid]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets = derivePresetCards(snap);
  const diyDefs: DockCardDef[] = diy.map((c) => ({ id: c.id, title: c.title, Icon: Wand2, diy: true, source: c.source }));
  const all = [...presets, ...diyDefs];
  const visible = all.filter((c) => !archived.has(c.id));
  const archivedCards = all.filter((c) => archived.has(c.id));

  return { cards: visible, archivedCards, archive, restore, addDiy, updateDiy };
}

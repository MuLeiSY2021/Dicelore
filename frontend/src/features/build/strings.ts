// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 构建页专属文案（build surface 大重构新增的词条）。与全局 i18n 同 zh/en 双语、同 {var} 插值口径。
// 放本地是为了让 build surface 重构自洽在 features/build/* 内（不外扩 shared/i18n）；
// useBuildT 先查本地词条、缺则回退全局 t（既有 build.* 键继续复用全局）。

import { useI18n } from "@/shared/i18n/index.js";

type Dict = Record<string, string>;

const ZH: Dict = {
  // ctx 四按钮
  "bd.validate": "校验整包", "bd.import": "导入原著",
  "bd.commit": "提交版本到库", "bd.export": "导出团本包",
  "bd.commit.title": "commit 版本到 catalog·会话活跃→归档", "bd.export.title": "导出 Pack 文件包",
  "bd.badge.draft": "草稿",
  // 三态
  "bd.none.title": "还没有构建会话", "bd.none.sub": "新建一个构建会话，或从最近会话继续。",
  "bd.none.new": "新建构建会话", "bd.none.recent": "最近：{name} · {when}（点此恢复）",
  "bd.exported.title": "已提交版本到库", "bd.exported.sub": "{name} · 会话已归档",
  "bd.exported.continue": "继续编辑此版本", "bd.exported.tocatalog": "回库查看",
  // sidenav 组
  "bd.grp.content": "内容（五域）", "bd.grp.scaffold": "叙事脚手架",
  "bd.grp.closure": "收口", "bd.grp.materials": "素材",
  "bd.grp.progress": "构建进度（点可跳转）",
  // 五域
  "bd.nav.lore": "世界设定", "bd.nav.npc": "NPC", "bd.nav.pool": "卡池",
  "bd.nav.rule": "规则·分档", "bd.nav.state": "状态·sheets",
  // 叙事脚手架
  "bd.nav.front": "阵线 Front", "bd.nav.plotline": "剧情线", "bd.nav.foreshadow": "伏笔",
  "bd.nav.anchor": "锚点", "bd.nav.relation": "关系",
  // 收口 + 素材
  "bd.nav.prologue": "开场白 prologue", "bd.nav.manifest": "Manifest", "bd.nav.materials": "素材包",
  // guideline 进度
  "bd.stg.source": "摸源·清洗", "bd.stg.world": "世界观", "bd.stg.npc": "NPC·卡池",
  "bd.stg.rule": "机制·分档", "bd.stg.manifest": "manifest 收口",
  // main
  "bd.editor.title": "内容编辑器", "bd.card.new": "新建",
  "bd.card.edit": "inline 编辑", "bd.card.del": "删除",
  "bd.editor.empty": "此域暂无内容，用右侧构建助手补全、或点「新建」。",
  "bd.edit.save": "保存", "bd.edit.cancel": "取消", "bd.edit.ph": "写点什么…",
  // aside chat
  "bd.assistant": "构建助手",
  "bd.assistant.welcome": "用自然语言让我补全人物 / 设定 / 卡池 / 阵线，我会调构建工具产出，即写即读刷新左侧内容。",
  "bd.assistant.ph": "对构建助手说…", "bd.send": "发送",
  "bd.gen.title": "助手编排中…", "bd.gen.cancel": "中止本轮",
  "bd.err.prefix": "上一轮出错：", "bd.err.locate": "点校验报告可定位。",
  // validate report
  "bd.report": "整包校验", "bd.report.err": "{n} error", "bd.report.warn": "{n} warn",
  "bd.report.hint": "点顶部「{label}」或此处运行 Draft 校验",
  "bd.report.ok": "整包通过校验·可提交",
  // materials
  "bd.mat.drop": "拖拽文件到此 / 点选文件", "bd.mat.done": "已落盘", "bd.mat.uploading": "上传中 {pct}%",
  "bd.mat.empty": "还没有素材，拖入原著 / 设定文件开始摸源。",
  // bay
  "bd.bay.session": "构建会话", "bd.bay.usage": "用量",
  "bd.bay.session.title": "构建会话", "bd.bay.usage.title": "用量详情",
  "bd.sess.active": "活跃", "bd.sess.archived": "已归档", "bd.sess.new": "新建构建会话",
  "bd.usage.turn": "本轮 usage", "bd.usage.session": "当前构建会话",
  "bd.usage.total": "累计 token", "bd.usage.price": "估价", "bd.usage.perturn": "各轮 · per-turn",
  "bd.usage.empty": "本会话还没有产生用量（发一条消息后出现）。",
  // new-session modal
  "bd.new.title": "新建构建会话", "bd.new.sub": "填团本元数据，助手会据此起步编排（也可后补）。",
  "bd.new.name": "团本名", "bd.new.flows": "flows", "bd.new.clock": "clock", "bd.new.entry": "entry",
  "bd.new.confirm": "创建", "bd.new.cancel": "取消",
  "bd.new.name.ph": "黑风寨的钟声", "bd.new.flows.ph": "dicelore-flow-投骰裁决",
  "bd.new.clock.ph": "世界.钟楼示警", "bd.new.entry.ph": "钟楼",
  // toasts / misc
  "bd.toast.created": "已创建构建会话：{name}", "bd.toast.committed": "已提交版本·会话已归档",
  "bd.toast.exported": "已导出团本包", "bd.toast.deleted": "已删除条目",
  "bd.confirm.commit": "当前有 warn（不阻断），确认提交版本到库？",
  "bd.confirm.del": "把这条条目交给助手删除？",
  "bd.npc.nocard": "缺 sheet 卡", "bd.npc.hascard": "有 sheet 卡", "bd.npc.prose": "人设散文", "bd.sheet": "sheet 卡",
};

const EN: Dict = {
  "bd.validate": "Validate", "bd.import": "Import source",
  "bd.commit": "Commit to library", "bd.export": "Export pack",
  "bd.commit.title": "Commit a version to catalog · active session → archived", "bd.export.title": "Export the Pack file bundle",
  "bd.badge.draft": "draft",
  "bd.none.title": "No build session yet", "bd.none.sub": "Create a build session, or resume a recent one.",
  "bd.none.new": "New build session", "bd.none.recent": "Recent: {name} · {when} (click to resume)",
  "bd.exported.title": "Version committed to library", "bd.exported.sub": "{name} · session archived",
  "bd.exported.continue": "Keep editing this version", "bd.exported.tocatalog": "Back to library",
  "bd.grp.content": "CONTENT (5 domains)", "bd.grp.scaffold": "NARRATIVE SCAFFOLD",
  "bd.grp.closure": "CLOSURE", "bd.grp.materials": "MATERIALS",
  "bd.grp.progress": "PROGRESS (click to jump)",
  "bd.nav.lore": "World", "bd.nav.npc": "NPC", "bd.nav.pool": "Pools",
  "bd.nav.rule": "Rules · bands", "bd.nav.state": "State · sheets",
  "bd.nav.front": "Fronts", "bd.nav.plotline": "Plotlines", "bd.nav.foreshadow": "Foreshadows",
  "bd.nav.anchor": "Anchors", "bd.nav.relation": "Relations",
  "bd.nav.prologue": "Prologue", "bd.nav.manifest": "Manifest", "bd.nav.materials": "Materials",
  "bd.stg.source": "Source · clean", "bd.stg.world": "World", "bd.stg.npc": "NPC · pools",
  "bd.stg.rule": "Mechanics · bands", "bd.stg.manifest": "Manifest closure",
  "bd.editor.title": "Content editor", "bd.card.new": "New",
  "bd.card.edit": "Inline edit", "bd.card.del": "Delete",
  "bd.editor.empty": "Nothing here yet — use the assistant or click New.",
  "bd.edit.save": "Save", "bd.edit.cancel": "Cancel", "bd.edit.ph": "Write something…",
  "bd.assistant": "Build Assistant",
  "bd.assistant.welcome": "Tell me in plain language to fill in characters / lore / pools / fronts — I'll call the build tools and the left pane refreshes live.",
  "bd.assistant.ph": "Tell the assistant…", "bd.send": "Send",
  "bd.gen.title": "Assistant working…", "bd.gen.cancel": "Cancel this turn",
  "bd.err.prefix": "Last turn failed: ", "bd.err.locate": "Click the validation report to locate.",
  "bd.report": "Validation", "bd.report.err": "{n} error", "bd.report.warn": "{n} warn",
  "bd.report.hint": "Click \"{label}\" above or here to validate the Draft",
  "bd.report.ok": "Draft passed — ready to commit",
  "bd.mat.drop": "Drop files here / click to pick", "bd.mat.done": "stored", "bd.mat.uploading": "uploading {pct}%",
  "bd.mat.empty": "No materials yet — drop source / lore files to begin.",
  "bd.bay.session": "Session", "bd.bay.usage": "Usage",
  "bd.bay.session.title": "Build sessions", "bd.bay.usage.title": "Usage detail",
  "bd.sess.active": "active", "bd.sess.archived": "archived", "bd.sess.new": "New build session",
  "bd.usage.turn": "This turn", "bd.usage.session": "Current session",
  "bd.usage.total": "Total tokens", "bd.usage.price": "Est. cost", "bd.usage.perturn": "Per turn",
  "bd.usage.empty": "No usage yet (appears after you send a message).",
  "bd.new.title": "New build session", "bd.new.sub": "Fill in the adventure metadata; the assistant starts from it (or add later).",
  "bd.new.name": "Name", "bd.new.flows": "flows", "bd.new.clock": "clock", "bd.new.entry": "entry",
  "bd.new.confirm": "Create", "bd.new.cancel": "Cancel",
  "bd.new.name.ph": "The Bells of Blackwind", "bd.new.flows.ph": "dicelore-flow-roll",
  "bd.new.clock.ph": "world.bell-alarm", "bd.new.entry.ph": "belltower",
  "bd.toast.created": "Created build session: {name}", "bd.toast.committed": "Committed · session archived",
  "bd.toast.exported": "Pack exported", "bd.toast.deleted": "Entry deleted",
  "bd.confirm.commit": "There are warnings (non-blocking). Commit this version to the library?",
  "bd.confirm.del": "Ask the assistant to delete this entry?",
  "bd.npc.nocard": "no sheet", "bd.npc.hascard": "has sheet", "bd.npc.prose": "Character prose", "bd.sheet": "sheet",
};

const DICTS: Record<string, Dict> = { zh: ZH, en: EN };

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type BuildTFunc = (key: string, vars?: Record<string, string | number>) => string;

// 先查本地 build 词条（本重构新增），缺则回退全局 t（既有 build.* / 通用键）。
export function useBuildT(): BuildTFunc {
  const { lang, t } = useI18n();
  return (key, vars) => {
    const local = DICTS[lang]?.[key] ?? DICTS.zh[key];
    if (local !== undefined) return interpolate(local, vars);
    return t(key, vars);
  };
}

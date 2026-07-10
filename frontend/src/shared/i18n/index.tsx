// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

// 轻量 i18n：zh/en 双语，localStorage 持久化，切换即时全 UI 生效。
// t(key, vars?) 取词条；缺词回退到 key 本身(便于发现遗漏)。

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "zh", label: "简体中文" },
  { value: "en", label: "English" },
];

const STORAGE_KEY = "dicelore.lang";

type Dict = Record<string, string>;

const ZH: Dict = {
  "nav.home": "主页", "nav.catalog": "团本", "nav.play": "跑团", "nav.build": "团本制作", "nav.config": "配置",
  "bay.tab.home": "主页", "bay.tab.catalog": "目录", "bay.tab.play": "跑团", "bay.tab.build": "制作", "bay.tab.config": "配置",
  "bay.nav": "导航", "bay.nav.collapse": "收起导航", "bay.nav.expand": "展开常驻导航",
  "bar.lang": "语言", "bar.theme": "明暗",
  "bar.model": "模型", "bar.mcp": "MCP", "bar.notify": "notify", "bar.notify.unset": "未配", "bar.notify.connected": "已连",
  // 主页
  "home.greeting.morning": "早上好", "home.greeting.afternoon": "下午好",
  "home.greeting.evening": "晚上好", "home.greeting.night": "夜深了",
  "home.traveler": "旅人",
  "home.welcome.empty": "欢迎回到案上", "home.welcome.resume": "要继续{title}吗？",
  "home.sub.empty": "选一个团本，开一局新的故事。", "home.sub.resume": "上次的故事还在等你落座。",
  "home.sample.title": "示例 · 黑风寨", "home.sample.where": "一键造示例团本并开局(验证闭环)",
  "home.sample.btn": "造团本并开局", "home.sample.btn.busy": "开局中…",
  "home.continue": "继续跑团",
  "home.quick.newgame": "开新局", "home.quick.newgame.d": "选团本 / 存档起一局",
  "home.quick.build": "团本制作", "home.quick.build.d": "丢本小说造团本",
  "home.quick.sessions": "会话管理", "home.quick.sessions.d": "搜索 / 续档 / 删档",
  "home.quick.config": "配置", "home.quick.config.d": "服务 / MCP / 模型",
  "home.recent": "最近 Session", "home.recent.empty": "暂无会话，去开新局",
  "home.error": "加载失败：{msg}",
  "status.active": "进行中", "status.archived": "已存档", "status.ended": "终局",
  // 配置
  "cfg.group": "设置",
  "cfg.general": "通用", "cfg.service": "服务与网络", "cfg.mcp": "MCP 服务器",
  "cfg.model": "模型连接", "cfg.theme": "主题外观", "cfg.data": "数据与存储", "cfg.about": "关于",
  "cfg.save": "保存", "cfg.saved": "已保存", "cfg.test": "连接测试", "cfg.testing": "测试中…",
  "cfg.test.ok": "连接正常", "cfg.test.fail": "连接失败",
  "cfg.general.lang": "语言", "cfg.general.startup": "启动行为",
  "cfg.startup.home": "打开时落到主页", "cfg.startup.last": "打开上次会话",
  "cfg.service.port": "主页端口", "cfg.service.host": "监听地址", "cfg.service.notify": "notify webhook",
  "cfg.service.notify.status": "连通状态", "cfg.service.proto": "协议版本",
  "cfg.model.gm": "GM 模型", "cfg.model.agent": "Agent 底座", "cfg.model.agent.hint": "驱动 GM 的运行时：Harness(默认) 或 Claude Agent SDK", "cfg.model.base": "API baseURL",
  "cfg.model.key": "API key", "cfg.model.key.ph": "sk-… 或留空走环境变量", "cfg.model.show": "显示", "cfg.model.hide": "隐藏",
  "cfg.model.fakehint": "当前为 FAKE_GM 模拟模式，未接真实模型推理。",
  "cfg.mcp.add": "添加 MCP", "cfg.mcp.core": "核心 · 规范态来源", "cfg.mcp.custom": "自定义 · out-of-canon",
  "cfg.mcp.required": "必需", "cfg.mcp.authorized": "已授权", "cfg.mcp.authorize": "授权",
  "cfg.mcp.tools": "{n} 工具", "cfg.mcp.warn": "⚠ 联网 · 数据外流",
  "cfg.mcp.note": "out-of-canon 工具调用仍落 event 留痕，但不参与 L3 审计比对、不发呈现 notify；外部副作用不进快照、rewind 撤不回。远程 server 首次调用需显式授权。",
  "cfg.mcp.del": "删除", "cfg.mcp.name.ph": "服务器名", "cfg.mcp.transport": "传输",
  "cfg.mcp.url.ph": "https://… (远程 SSE)", "cfg.mcp.cmd.ph": "命令路径 (本地 stdio)",
  "cfg.theme.theme": "主题", "cfg.theme.inkgold": "墨金（默认）", "cfg.theme.mode": "明暗",
  "cfg.theme.dark": "暗", "cfg.theme.light": "亮", "cfg.theme.system": "跟随系统",
  "cfg.theme.accent": "强调色", "cfg.theme.font": "字体",
  "cfg.data.dir": "会话目录", "cfg.data.fts": "检索模式", "cfg.data.count": "会话数",
  "cfg.about.product": "产品", "cfg.about.version": "版本", "cfg.about.proto": "协议契约", "cfg.about.shell": "运行壳",
  "accent.gold": "金（默认）", "accent.copper": "铜", "accent.teal": "青", "accent.crimson": "绛", "accent.indigo": "靛",
  // 跑团
  "play.rail.world": "设定", "play.rail.tools": "工具",
  "play.rail.add": "拖出生成面板",
  "play.bar.session": "会话", "play.bar.pack": "团本", "play.bar.hide": "隐藏会话栏", "play.bar.show": "显示会话栏",
  "play.bar.group.date": "按日期", "play.bar.group.pack": "按团本", "play.bar.nosession": "（无会话，去主页开新局）",
  "play.tools.search": "全文搜索设定", "play.tools.log": "本局日志", "play.tools.pins": "已钉到呈现台", "play.tools.none": "暂无可用工具",
  "play.date.today": "今天", "play.date.week": "本周", "play.date.earlier": "更早",
  "play.search.world": "搜设定（名称 / 分类）",
  "play.narr.empty": "等待 GM 开场……输入你的第一个行动。",
  "play.narr.prestart": "点击下方「开始游戏」，GM 将带来这一局的开场。",
  "play.input.ph": "你做什么？（回车发送）",
  "play.roll": "丢骰子", "play.roll.hint": "这一掷决定上面的结果",
  "play.generating": "GM 正在叙述……",
  "play.stage": "呈现台", "play.stage.grid": "网格", "play.stage.reset": "复位默认布局", "play.stage.empty": "暂无呈现数据（首屏快照加载中，或本局尚无可见状态）",
  "play.panel.attrs": "人物属性", "play.panel.clock": "倒计时钟", "play.panel.inv": "库存", "play.panel.reveal": "揭示 · 设定",
  "play.tree.empty": "（无可浏览条目）",
  // 团本制作
  "build.validate": "校验整包", "build.import": "导入原著", "build.export": "导出团本包",
  "build.nav.content": "内容", "build.nav.progress": "构建进度",
  "build.world": "世界设定", "build.npc": "NPC", "build.pool": "卡池", "build.rule": "规则·分档", "build.front": "阵线 Front", "build.manifest": "Manifest",
  "build.stage.world": "世界观", "build.stage.people": "人物", "build.stage.pool": "卡池", "build.stage.mech": "机制",
  "build.assistant": "构建助手", "build.assistant.ph": "对构建助手说…",
  "build.assistant.welcome": "用自然语言让我补全人物 / 设定 / 卡池，我会调构建工具产出。",
  "build.new": "新建", "build.search": "搜索", "build.select": "选择团本", "build.create": "新建团本",
  "build.refresh": "刷新产物",
  "build.npc.nocard": "缺卡", "build.npc.collapse": "折叠",
  "build.npc.prose": "人设散文", "build.npc.prose.empty": "（无人设散文）",
  "build.send": "发送",
  "build.validate.hint": "点顶部「{label}」运行整包校验",
  "build.validate.pass": "校验通过，无问题",
  "build.chat.received": "已接收({id})。产物写入后点「{refresh}」重读。",
  "build.chat.error": "发送失败：{msg}",
  "build.report": "整包校验", "build.report.errors": "{n} error", "build.report.warns": "{n} warn",
  "build.empty": "还没有团本，新建一个或去主页造示例。",
  "common.cancel": "取消", "common.confirm": "确定", "common.loading": "加载中…",
  // 团本目录页
  "catalog.title": "团本目录", "catalog.sub": "选一个团本开始游戏，或去团本制作创建 / 导入。",
  "catalog.start": "新开一局", "catalog.edit": "编辑", "catalog.versions": "{n} 版本",
  "catalog.empty.title": "还没有团本", "catalog.empty.sub": "去团本制作创建一个，或一键造示例团本。",
  "catalog.empty.build": "去团本制作", "catalog.empty.sample": "造示例团本",
  "catalog.starting": "开局中…",
  // Play 开场层 / 会话
  "play.start": "点击开始游戏", "play.start.hint": "GM 将带来开场……",
  "play.start.busy": "开场中…",
  "play.session.delete": "删除会话", "play.session.empty.title": "还没有任何会话",
  "play.session.empty.sub": "去团本目录选一个团本开始游戏。", "play.session.empty.cta": "去团本目录",
  "play.rewind": "读档", "play.rewind.hint": "恢复到最近一次自动存档（每回合末自动存）",
  "play.rewind.confirm": "读档将把本局恢复到最近一个回合末的自动存档，此回合后的状态变更会被覆盖。确定？",
  "play.timeout.title": "GM 这一回合超时了",
  "play.timeout.retry": "重试", "play.timeout.skip": "跳过本回合",
  "play.timeout.hint": "可重发上一步让 GM 再试，或跳过继续。",
};

const EN: Dict = {
  "nav.home": "Home", "nav.catalog": "Adventures", "nav.play": "Play", "nav.build": "Build", "nav.config": "Settings",
  "bay.tab.home": "Home", "bay.tab.catalog": "Catalog", "bay.tab.play": "Play", "bay.tab.build": "Build", "bay.tab.config": "Config",
  "bay.nav": "Nav", "bay.nav.collapse": "Collapse nav", "bay.nav.expand": "Pin nav bar",
  "bar.lang": "Language", "bar.theme": "Theme",
  "bar.model": "Model", "bar.mcp": "MCP", "bar.notify": "notify", "bar.notify.unset": "unset", "bar.notify.connected": "connected",
  "home.greeting.morning": "Good morning", "home.greeting.afternoon": "Good afternoon",
  "home.greeting.evening": "Good evening", "home.greeting.night": "Late night",
  "home.traveler": "Traveler",
  "home.welcome.empty": "Welcome back to the table", "home.welcome.resume": "The night is young — continue {title}?",
  "home.sub.empty": "Pick an adventure and start a new story.", "home.sub.resume": "Your last story is still waiting.",
  "home.sample.title": "Sample · Blackwind Stockade", "home.sample.where": "Build a sample adventure and start instantly (smoke test)",
  "home.sample.btn": "Build & Play", "home.sample.btn.busy": "Starting…",
  "home.continue": "Continue",
  "home.quick.newgame": "New Game", "home.quick.newgame.d": "Pick an adventure / save to start",
  "home.quick.build": "Build", "home.quick.build.d": "Turn a novel into an adventure",
  "home.quick.sessions": "Sessions", "home.quick.sessions.d": "Search / resume / delete",
  "home.quick.config": "Settings", "home.quick.config.d": "Service / MCP / Model",
  "home.recent": "Recent Sessions", "home.recent.empty": "No sessions yet — start one",
  "home.error": "Failed to load: {msg}",
  "status.active": "Active", "status.archived": "Archived", "status.ended": "Ended",
  "cfg.group": "SETTINGS",
  "cfg.general": "General", "cfg.service": "Service & Network", "cfg.mcp": "MCP Servers",
  "cfg.model": "Model", "cfg.theme": "Appearance", "cfg.data": "Data & Storage", "cfg.about": "About",
  "cfg.save": "Save", "cfg.saved": "Saved", "cfg.test": "Test connection", "cfg.testing": "Testing…",
  "cfg.test.ok": "Connected", "cfg.test.fail": "Connection failed",
  "cfg.general.lang": "Language", "cfg.general.startup": "Startup",
  "cfg.startup.home": "Open the Home page", "cfg.startup.last": "Open last session",
  "cfg.service.port": "Port", "cfg.service.host": "Host", "cfg.service.notify": "notify webhook",
  "cfg.service.notify.status": "Status", "cfg.service.proto": "Protocol",
  "cfg.model.gm": "GM model", "cfg.model.agent": "Agent runtime", "cfg.model.agent.hint": "Runtime that drives the GM: Harness (default) or Claude Agent SDK", "cfg.model.base": "API baseURL",
  "cfg.model.key": "API key", "cfg.model.key.ph": "sk-… or leave blank for env", "cfg.model.show": "Show", "cfg.model.hide": "Hide",
  "cfg.model.fakehint": "Running in FAKE_GM mode — no real model inference.",
  "cfg.mcp.add": "Add MCP", "cfg.mcp.core": "Core · canonical source", "cfg.mcp.custom": "Custom · out-of-canon",
  "cfg.mcp.required": "required", "cfg.mcp.authorized": "authorized", "cfg.mcp.authorize": "Authorize",
  "cfg.mcp.tools": "{n} tools", "cfg.mcp.warn": "⚠ network · data egress",
  "cfg.mcp.note": "out-of-canon tool calls still log events but are excluded from L3 audit and presentation notify; side effects are not snapshotted and cannot be rewound. Remote servers require explicit authorization on first call.",
  "cfg.mcp.del": "Delete", "cfg.mcp.name.ph": "server name", "cfg.mcp.transport": "Transport",
  "cfg.mcp.url.ph": "https://… (remote SSE)", "cfg.mcp.cmd.ph": "command path (local stdio)",
  "cfg.theme.theme": "Theme", "cfg.theme.inkgold": "Ink-Gold (default)", "cfg.theme.mode": "Mode",
  "cfg.theme.dark": "Dark", "cfg.theme.light": "Light", "cfg.theme.system": "System",
  "cfg.theme.accent": "Accent", "cfg.theme.font": "Fonts",
  "cfg.data.dir": "Sessions dir", "cfg.data.fts": "FTS mode", "cfg.data.count": "Sessions",
  "cfg.about.product": "Product", "cfg.about.version": "Version", "cfg.about.proto": "Protocol", "cfg.about.shell": "Shell",
  "accent.gold": "Gold (default)", "accent.copper": "Copper", "accent.teal": "Teal", "accent.crimson": "Crimson", "accent.indigo": "Indigo",
  "play.rail.world": "Lore", "play.rail.tools": "Tools",
  "play.rail.add": "Drag out a panel",
  "play.bar.session": "Session", "play.bar.pack": "Adventure", "play.bar.hide": "Hide session bar", "play.bar.show": "Show session bar",
  "play.bar.group.date": "By date", "play.bar.group.pack": "By adventure", "play.bar.nosession": "(no sessions — start one from Home)",
  "play.tools.search": "Search lore", "play.tools.log": "Session log", "play.tools.pins": "Pinned to stage", "play.tools.none": "No tools available",
  "play.date.today": "Today", "play.date.week": "This week", "play.date.earlier": "Earlier",
  "play.search.world": "Search lore (name / category)",
  "play.narr.empty": "Waiting for the GM… type your first action.",
  "play.narr.prestart": "Click “Start game” below — the GM will open this session.",
  "play.input.ph": "What do you do? (Enter to send)",
  "play.roll": "Roll", "play.roll.hint": "This roll decides the outcome above",
  "play.generating": "The GM is narrating…",
  "play.stage": "Stage", "play.stage.grid": "Grid", "play.stage.reset": "Reset layout", "play.stage.empty": "No presentation yet (loading snapshot, or nothing visible this session)",
  "play.panel.attrs": "Attributes", "play.panel.clock": "Clock", "play.panel.inv": "Inventory", "play.panel.reveal": "Reveal · Lore",
  "play.tree.empty": "(nothing to browse)",
  "build.validate": "Validate", "build.import": "Import source", "build.export": "Export pack",
  "build.nav.content": "CONTENT", "build.nav.progress": "PROGRESS",
  "build.world": "World", "build.npc": "NPC", "build.pool": "Pools", "build.rule": "Rules", "build.front": "Fronts", "build.manifest": "Manifest",
  "build.stage.world": "World", "build.stage.people": "People", "build.stage.pool": "Pools", "build.stage.mech": "Mechanics",
  "build.assistant": "Build Assistant", "build.assistant.ph": "Tell the assistant…",
  "build.assistant.welcome": "Tell me in plain language to fill in characters / lore / pools — I'll call the build tools.",
  "build.new": "New", "build.search": "Search", "build.select": "Select adventure", "build.create": "New adventure",
  "build.refresh": "Refresh output",
  "build.npc.nocard": "no sheet", "build.npc.collapse": "Collapse",
  "build.npc.prose": "Character prose", "build.npc.prose.empty": "(no prose)",
  "build.send": "Send",
  "build.validate.hint": "Click \"{label}\" above to run a full-pack validation",
  "build.validate.pass": "Validation passed — no issues",
  "build.chat.received": "Received ({id}). Click \"{refresh}\" to reload after output is written.",
  "build.chat.error": "Send failed: {msg}",
  "build.report": "Validation", "build.report.errors": "{n} error", "build.report.warns": "{n} warn",
  "build.empty": "No adventures yet — create one or build the sample from Home.",
  "common.cancel": "Cancel", "common.confirm": "OK", "common.loading": "Loading…",
  "catalog.title": "Adventures", "catalog.sub": "Pick an adventure to start, or create / import one in Build.",
  "catalog.start": "New game", "catalog.edit": "Edit", "catalog.versions": "{n} versions",
  "catalog.empty.title": "No adventures yet", "catalog.empty.sub": "Create one in Build, or build the sample.",
  "catalog.empty.build": "Go to Build", "catalog.empty.sample": "Build sample",
  "catalog.starting": "Starting…",
  "play.start": "Click to start", "play.start.hint": "The GM will set the scene…",
  "play.start.busy": "Opening…",
  "play.session.delete": "Delete session", "play.session.empty.title": "No sessions yet",
  "play.session.empty.sub": "Pick an adventure in Adventures to start.", "play.session.empty.cta": "Go to Adventures",
  "play.rewind": "Load save", "play.rewind.hint": "Restore to the latest autosave (saved at each turn end)",
  "play.rewind.confirm": "Loading will restore this session to the latest end-of-turn autosave; state changes after that turn will be overwritten. Continue?",
  "play.timeout.title": "The GM timed out on this turn",
  "play.timeout.retry": "Retry", "play.timeout.skip": "Skip this turn",
  "play.timeout.hint": "Resend your last action to let the GM try again, or skip to continue.",
};

const DICTS: Record<Lang, Dict> = { zh: ZH, en: EN };

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: TFunc; }
const Ctx = createContext<I18nCtx | null>(null);

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return saved === "en" || saved === "zh" ? saved : "zh";
  });
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, [lang]);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback<TFunc>((key, vars) => interpolate(DICTS[lang][key] ?? DICTS.zh[key] ?? key, vars), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (v) return v;
  // 无 provider 回退(隔离组件测试 / 渐进增强)：默认 zh，setLang noop。
  return { lang: "zh", setLang: () => { /* noop */ }, t: (k, vars) => interpolate(DICTS.zh[k] ?? k, vars) };
}
export function useT(): TFunc { return useI18n().t; }

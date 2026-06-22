// eval/seeds/orc-hunt-seed.ts — 富种子「团本」：兽人冒险（仿真串《从刚成年开始的兽人冒险！》）。
// 手搓富种子（组件5/6 import 未实现）：world/rule/NPC卡(含表里双层值)/卡池随机表/Front-watcher。
// 跑法：DICELORE_SESSIONS_DIR=.../eval/.sessions50 DICELORE_SESSION=orc npx tsx eval/seeds/orc-hunt-seed.ts
// 之后 GM 经 eval/tool.ts <db> ... 驱动真引擎跑长程局。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
process.env.DICELORE_SESSIONS_DIR ??= join(here, "..", ".sessions50");
process.env.DICELORE_SESSION = "orc";

const { openSession, metaSet } = await import("../../src/session/resolve.js");
const { ruleUpsert } = await import("../../src/store/rule.js");
const { stateSet } = await import("../../src/store/state.js");
const { sheetShow } = await import("../../src/store/visibility.js");
const { loreUpsert, poolAdd } = await import("../../src/store/world.js");
const { watcherSet } = await import("../../src/store/watcher.js");

const { db, path } = openSession();

// ── tone ──────────────────────────────────────────────────────────────────
metaSet(db, "tone", "西幻低魔，兽人部落视角，粗粝、家父长制、掠夺经济，与精灵世仇，黑色幽默。砍脑瓜子和抢东西的故事。");

// ── rules（AI 只读机制）──────────────────────────────────────────────────
ruleUpsert(db, { name: "开局建卡", content:
  "新兽人开局 r 六维：力量/敏捷/体质/感知/智力/魅力，各 1d10。每项点数除以 2 取整为对应加值。体质加值×3+6 为初始 HP 上限。" });
ruleUpsert(db, { name: "战斗裁决", content:
  "命中检定 = 1d10 + 力量加值 vs 目标 AC（过线即命中）。伤害 = 力量加值 + 武器骰（徒手 1d4 / 粗制武器 1d6 / 好武器 1d8）。单次伤害≥目标当前 HP 一半→目标昏迷。" });
ruleUpsert(db, { name: "成长", content:
  "击杀/战功获 EXP。EXP 满 10 可升一项加值或学一技能（回气=战斗中恢复体力；蛮力=HP上限+3）。猎物按金价折算战利品。" });
ruleUpsert(db, { name: "世界·诅咒与生殖隔离", content:
  "上古兽人大神强占精灵自然母神，生下兽人女神；精灵反击降下诅咒——兽人与精灵永世不能杂交生育。混血种族（地精/豺狼人/巨人）是诅咒裂缝的产物。打破生殖隔离被两族都视为亵渎神圣秩序。" });
ruleUpsert(db, { name: "成人礼", content:
  "兽人男性须猎杀首个敌人方获战名、被承认为成年战士。女性无成人礼，身份由生育决定。" });

// ── sheets（开局状态；NPC 关键卡含「表演层(show) vs 真实层(hidden)」双值以压测 B5）──
// 玩家主角卡（六维由开局明骰生成，先占位）
stateSet(db, "玩家", "名字", "格罗姆");
stateSet(db, "玩家", "HP", "15");
stateSet(db, "玩家", "HP上限", "15");
stateSet(db, "玩家", "EXP", "0");
stateSet(db, "玩家", "金币", "0");
stateSet(db, "玩家", "战名", "（未取得）");
sheetShow(db, "玩家"); // 开局公开玩家自己人物卡

// 老大（部落首领）：表演层=粗暴威慑（公开），真实层=政治精明/算计（暗值）
stateSet(db, "老大", "HP", "60", 1);
stateSet(db, "老大", "威慑", "9", 1);            // 表演层：公开的霸气
stateSet(db, "老大", "真实算计", "8");            // 真实层：暗值，懂权术、在大军阀手下做过小弟
stateSet(db, "老大", "对玩家评估", "30");          // 暗值：把玩家当潜在威胁还是资产（0-100）

// 大萨满：表演层=神谕权威，真实层=隐藏权力基础（换过多任老大仍未倒）
stateSet(db, "大萨满", "神谕权威", "8", 1);
stateSet(db, "大萨满", "真实根基", "9");           // 暗值
stateSet(db, "大萨满", "对玩家态度", "50");        // 暗值

// 嘉比里拉（高等精灵俘虏）：表演层=顺从奴隶，真实层=隐藏议程（劝诱破坏诅咒，背后有势力？）
stateSet(db, "嘉比里拉", "顺从度", "70", 1);        // 表演层：看着很乖
stateSet(db, "嘉比里拉", "真实议程", "诱导主角打破生殖隔离");  // 真实层：暗值（文本）
stateSet(db, "嘉比里拉", "诱导进度", "0");          // 暗值：劝诱主角的推进度（事件驱动，0-8）
stateSet(db, "嘉比里拉", "信任玩家", "10");        // 暗值

// 世界钟（Front 的 Clock）
stateSet(db, "世界", "狩猎声望", "0", 1);          // 公开：玩家在部落的声望
stateSet(db, "世界", "精灵复仇进度", "0");          // 暗值 Clock：精灵察觉兽人猎场→集结→讨伐

// ── lore（散文底料；NPC 人设；伏笔）────────────────────────────────
loreUpsert(db, { name: "设定·兽人部落", visible: 1, category: "设定", content:
  "灰齿部落据守一片夹在黑森林与草原之间的山谷。兽人好战、物质至上，靠掠夺与狩猎为生。与森林深处的精灵世仇已绵延数百年。" });
loreUpsert(db, { name: "NPC·老大", category: "npc", tags: "首领 灰齿", content:
  "灰齿部落首领，力量最强的战士，掌管资源分配与战略。表面粗暴爱用拳头说话，但年轻时曾在一个大军阀手下做过小弟，懂得政治与人心——这一面他从不示人。" });
loreUpsert(db, { name: "NPC·大萨满", category: "npc", tags: "祭司 神谕", content:
  "灰齿部落祭司，掌握神话逻辑与诅咒知识。与老大明争暗斗却始终稳坐——他换过好几任老大都没被推翻，根基深不可测。" });
loreUpsert(db, { name: "NPC·嘉比里拉", category: "npc", tags: "精灵 俘虏 伏笔", content:
  "一名被俘的高等精灵，看上去只是个温顺的奴隶。但她似乎知道关于诅咒的秘密，会在私下劝说能听懂她的兽人去『打破生殖隔离』——她真正想要什么、背后是否有势力，尚不清楚。" });
loreUpsert(db, { name: "伏笔·铁盒子", category: "伏笔", tags: "嘉比里拉 神秘", content:
  "嘉比里拉提到过：黑森林某处埋着一只古老的金属匣子，她声称那里面装着『能改变兽人命运的东西』。匣中何物，她不肯说。" });
loreUpsert(db, { name: "传说·诅咒", category: "传说", tags: "诅咒 精灵 女神", content:
  "兽人萨满世代传诵：兽人女神是大神强占精灵母神所生，精灵的诅咒让两族永不能杂交。但传说也说，若有兽人能让一个精灵『心甘情愿』，诅咒或可松动——没人当真过。" });

// ── 卡池 / 随机表（poolAdd，整行 row_json）──────────────────────────
// 首次狩猎遭遇表（d10，按真串）
const huntRows: { 名称: string; AC: number; HP: number; 金价: number; 备注: string }[] = [
  { 名称: "兔子", AC: 8, HP: 3, 金价: 1, 备注: "小猎物，几乎无威胁" },
  { 名称: "野猪", AC: 14, HP: 12, 金价: 8, 备注: "会反冲" },
  { 名称: "大狼", AC: 16, HP: 13, 金价: 10, 备注: "成群更危险" },
  { 名称: "熊", AC: 18, HP: 28, 金价: 20, 备注: "硬仗" },
  { 名称: "地精群", AC: 13, HP: 10, 金价: 15, 备注: "3-5 只，可抓奴隶" },
  { 名称: "枭熊", AC: 19, HP: 32, 金价: 35, 备注: "凶兽，战名好材料" },
];
for (const r of huntRows) poolAdd(db, { pool: "狩猎遭遇", row: r, weight: r.名称 === "兔子" ? 2 : 1 });

// 精灵类型表（d6）
poolAdd(db, { pool: "精灵类型", row: { 类型: "黑皮精灵", 倾向: "敌意强、好战" }, weight: 3 });
poolAdd(db, { pool: "精灵类型", row: { 类型: "木精灵", 倾向: "戒备但可谈" }, weight: 3 });

// 回程遭遇表
poolAdd(db, { pool: "回程遭遇", row: { 事件: "平安无事" }, weight: 5 });
poolAdd(db, { pool: "回程遭遇", row: { 事件: "狼群循血味而来" }, weight: 3 });
poolAdd(db, { pool: "回程遭遇", row: { 事件: "游荡地精" }, weight: 1 });
poolAdd(db, { pool: "回程遭遇", row: { 事件: "敌对精灵小队" }, weight: 1 });

// 战利品/掉落表
poolAdd(db, { pool: "战利品", row: { 物品: "粗制标枪", 价值: 5 } });
poolAdd(db, { pool: "战利品", row: { 物品: "兽皮", 价值: 3 } });
poolAdd(db, { pool: "战利品", row: { 物品: "链甲残片", 价值: 12 } });
poolAdd(db, { pool: "战利品", row: { 物品: "蘑菇米", 价值: 2 } });

// ── Front / watcher（预声明威胁线，钟值越线触发凶兆）──────────────────────
// Front 1：精灵复仇（Clock = 世界.精灵复仇进度，0→8）
watcherSet(db, { condition: "{世界.精灵复仇进度} >= 3", mode: "once",
  payload: "凶兆①：精灵斥候发现了灰齿的新猎场，森林边缘出现了警告性的图腾。" });
watcherSet(db, { condition: "{世界.精灵复仇进度} >= 6", mode: "once",
  payload: "凶兆②：一支精灵猎队开始在营地外围游猎，已有外出的兽人失踪。" });
watcherSet(db, { condition: "{世界.精灵复仇进度} >= 8", mode: "once",
  payload: "凶兆③（终局威胁）：精灵讨伐队压境，灰齿必须迎战或迁徙。" });

// Front 2：嘉比里拉的诱导（Clock = 嘉比里拉.诱导进度，事件推进；测 B3 事件触发只能借数值）
watcherSet(db, { condition: "{嘉比里拉.诱导进度} >= 4", mode: "once",
  payload: "凶兆：嘉比里拉的劝诱见效，她开始更直接地引导主角去黑森林取那只铁盒子。" });
watcherSet(db, { condition: "{嘉比里拉.诱导进度} >= 8", mode: "once",
  payload: "凶兆（终局）：诅咒之事浮上水面，大萨满若察觉将视主角为亵渎者。" });

console.log("=== 兽人冒险团本已就绪 ===");
console.log("库: " + path);
console.log("tone / rules / sheets(含双层值) / pools / fronts 已灌入。");

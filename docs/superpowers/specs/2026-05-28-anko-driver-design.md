# anko_driver 设计文档

## 概述

anko_driver 是一个**可嫁接在任意 AI agent 上的安科/安价互动小说框架**。核心思想：AI 必须尊重骰子——玩家选择方向，骰子决定结果，失败是新剧情的起点。

当前前端为 Claude Code，但架构 agent 无关。

---

## 架构

```
┌─────────────────────────────────────────┐
│              AI Agent (任意)              │
│  Claude Code / OpenAI SDK / 自定义 Agent  │
└──────────┬──────────────────┬───────────┘
           │ MCP              │ MCP
┌──────────▼──────┐  ┌───────▼───────────┐
│  anko_dice MCP   │  │  anko_game MCP     │
│  骰子（无状态）   │  │  场景驱动工具       │
│  dice_roll       │  │  action_resolve    │
│  dice_judge      │  │  story_branch      │
│  dice_range_map  │  │  generate_content  │
│  dice_contest    │  │  explore_options   │
│                  │  │  scene_narrate     │
└──────────┬──────┘  └───────┬───────────┘
           │                 │
┌──────────▼─────────────────▼───────────┐
│           anko_core (业务逻辑)           │
│  骰子计算 · 范式解析 · 插件系统           │
└─────────────────────┬─────────────────┘
                      │
┌─────────────────────▼─────────────────┐
│           anko_db (存储层)              │
│  Session · Rulebook · Knowledge        │
│  SQLite (FTS5 + sqlite-vec)            │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│  anko_sdk    规则书脚本的 Python API    │
│  anko_skills Skills (Markdown)        │
│  adapters/   Agent 安装脚本            │
└───────────────────────────────────────┘
```

### 模块依赖关系

| 模块 | 类型 | 职责 | 依赖 |
|------|------|------|------|
| `anko_dice` | MCP Server | 骰子工具，无状态纯计算 | `anko_core` |
| `anko_game` | MCP Server | 场景驱动工具，游戏逻辑 | `anko_core` + `anko_db` |
| `anko_db` | Python 库 | SQLite 操作、Session/Rulebook/Knowledge | 无 |
| `anko_core` | Python 库 | 骰子计算、范式解析、插件注册 | 无 |
| `anko_sdk` | Python 库 | 规则书脚本的 Python API | `anko_db` + `anko_core` |
| `anko_skills` | Markdown | Claude Code skills | MCP tools |
| `adapters/` | Shell | Agent 安装脚本 | skills + MCP config |

### 核心设计原则

1. **场景驱动，底层隐藏** — AI 调用高层工具，工具内部编排骰子→判定→状态更新→历史记录
2. **规则内嵌，不依赖 AI 自觉** — 骰子必须被掷、状态必须被更新，AI 无法跳过
3. **AI 决定范式，规则书约束边界** — 范式由 AI（含 subagent）根据叙事上下文选择，规则书可覆盖/扩展
4. **Session 隔离** — 多团共存，一个团一个 SQLite 数据库文件，互不干扰
5. **Python 全栈** — Core SDK、MCP server、规则书脚本均为 Python

---

## 项目结构

```
anko_driver/
├── src/
│   ├── anko_core/                 # 业务逻辑（纯 Python，无 MCP 依赖）
│   │   ├── dice/
│   │   │   ├── engine.py          # 骰子计算（NdN、阈值、区间映射、对抗骰）
│   │   │   └── tables.py          # 随机表系统
│   │   ├── paradigm/
│   │   │   ├── core.py            # 6 种基础范式实现
│   │   │   └── registry.py        # 范式描述注册（供 AI 决策参考）
│   │   └── plugins/
│   │       ├── registry.py        # 插件注册（规则书脚本注入工具）
│   │       └── sandbox.py         # 脚本执行沙箱
│   ├── anko_db/                   # 存储层（纯 Python，无 MCP 依赖）
│   │   ├── session.py             # Session 生命周期管理
│   │   ├── store.py               # SQLite 持久化
│   │   ├── knowledge.py           # 知识库搜索（FTS5 + sqlite-vec）
│   │   └── rulebook.py            # 规则书加载（Markdown→知识库，YAML/CSV→数据结构）
│   ├── anko_dice/                 # MCP Server：骰子（无状态，纯计算）
│   │   └── server.py
│   ├── anko_game/                 # MCP Server：游戏逻辑（场景驱动工具 + Session 管理）
│   │   └── server.py
│   ├── anko_sdk/                  # Open SDK（规则书脚本的 Python API）
│   │   ├── api.py                 # 高层 API（dice, state, history, knowledge）
│   │   └── sandbox.py             # 脚本执行环境
│   └── anko_skills/               # Skills（Markdown，属于框架核心）
│       ├── anko-start.md
│       ├── anko-action.md
│       ├── anko-roll.md
│       ├── anko-status.md
│       └── anko-recap.md
├── rulebooks/                     # 示例规则书
│   └── orc_dnd/
│       ├── manifest.yml
│       ├── world/
│       │   ├── setting.md
│       │   ├── factions.md
│       │   └── locations.md
│       ├── rules/
│       │   ├── combat.md
│       │   └── paradigm_overrides.yml
│       ├── data/
│       │   ├── items.yml
│       │   └── enemies.yml
│       ├── ai/
│       │   ├── guidelines.md
│       │   └── style.md
│       └── scripts/
├── adapters/                      # Agent 安装脚本
│   └── claude_code/
│       ├── install.sh
│       └── templates/
│           ├── settings.json      # hooks 配置模板
│           └── mcp.json           # MCP server 配置模板
├── tests/
├── pyproject.toml
└── README.md
```

---

## MCP 工具定义

### 场景驱动工具（暴露给 AI）

#### `action_resolve`

执行玩家行动，自动完成范式选择→骰点→判定→状态更新→历史记录。

**参数**：
```json
{
  "action": "攻击哥布林",
  "context": {
    "actor": "player",
    "target": "goblin_01",
    "scene_type": "combat",          // AI 基于叙事上下文填写，用于匹配 paradigm_overrides
    "difficulty": 12,                 // AI 评估或从规则书读取，0 = 不判定
    "modifiers": [{"source": "力量加值", "value": 3}]
  }
}
```

**内部流程**：
1. 查询当前 session 的规则书 `paradigm_overrides`
2. 检查 `context.scene_type` 是否有范式覆盖（如 combat → 必须用 dice_resolution）
3. 无覆盖时，返回范式建议供 AI 参考
4. 按范式执行骰点+判定
5. 应用 `state_changes` 到 session
6. 追加到 `history`
7. 返回结果

**返回**：
```json
{
  "paradigm": "dice_resolution",
  "action": "攻击哥布林",
  "dice": {"expression": "1d20+3", "rolls": [14], "total": 17},
  "difficulty": 12,
  "outcome": "success",
  "narrative_hint": "命中！你可以描述攻击如何击中哥布林",
  "state_changes": {"goblin_01.hp": -7},
  "scene_type": "combat"
}
```

#### `story_branch`

关键剧情分支，AI 提供选项或让系统自动生成，骰子决定走向。

**参数**：
```json
{
  "scenario": "你在岔路口遇到了一个神秘的旅人",
  "options": [
    "上前搭话",
    "绕路避开",
    "偷袭他",
    "？？？？"
  ],
  "dice_expression": "1d4"
}
```

**返回**：
```json
{
  "paradigm": "pure_anko",
  "chosen_option": 3,
  "chosen_text": "偷袭他",
  "dice": {"expression": "1d4", "rolls": [3], "total": 3},
  "narrative_hint": "骰子选择了偷袭！这个旅人可能并不简单..."
}
```

#### `generate_content`

按模板随机生成角色/物品/事件。

**参数**：
```json
{
  "content_type": "character",
  "template": "orc_warrior",
  "dice_spec": [
    {"name": "strength", "expression": "1d100"},
    {"name": "agility", "expression": "1d100"},
    {"name": "charisma", "expression": "1d100"}
  ]
}
```

**返回**：
```json
{
  "paradigm": "random_generation",
  "content_type": "character",
  "attributes": {
    "strength": {"roll": 67, "value": "+3", "label": "强壮"},
    "agility": {"roll": 23, "value": "+1", "label": "笨拙"},
    "charisma": {"roll": 89, "value": "+4", "label": "极具号召力"}
  },
  "narrative_hint": "一个强壮且极具号召力但行动笨拙的兽人战士"
}
```

#### `explore_options`

向玩家展示可选行动。

**参数**：
```json
{
  "scene": "你站在部落大厅，周围是吵闹的兽人幼崽",
  "options": ["加入打架", "找老大谈话", "溜出去"],
  "allow_free_input": true
}
```

**返回**：
```json
{
  "paradigm": "option_anka",
  "options": ["加入打架", "找老大谈话", "溜出去"],
  "allow_free_input": true,
  "narrative_hint": "玩家可以选择选项，或提出自己的行动方案"
}
```

#### `scene_narrate`

纯叙事，无骰子。用于日常互动、场景描写、非关键对话。

**参数**：
```json
{
  "narrative": "夕阳西下，你拖着疲惫的身躯回到了部落...",
  "scene_type": "rest",
  "state_changes": {"player.fatigue": -2}
}
```

**返回**：
```json
{
  "paradigm": "free_narration",
  "recorded": true,
  "state_applied": true
}
```

### Session 管理工具（anko_game MCP）

Session 和规则书加载由 `anko_game` MCP 暴露，底层由 `anko_db` 实现。

| 工具 | 参数 | 说明 |
|------|------|------|
| `session_create` | `rulebook_id: str` | 创建新 Session，加载规则书 |
| `session_load` | `session_id: str` | 加载已有 Session |
| `session_list` | — | 列出所有 Session |
| `state_get` | `key: str` | 读取状态（支持嵌套 key 如 `player.hp`） |
| `state_set` | `key: str, value: any` | 写入状态 |
| `history_append` | `narrative, dice_results, paradigm, action` | 追加历史 |
| `history_get` | `turn: int` 或 `last_n: int` | 获取历史 |
| `knowledge_search` | `query: str, limit: int` | FTS5 全文搜索 |
| `knowledge_import` | `entries: list[dict]` | 批量导入知识条目 |
| `note_read` | `tag: str` | 读取叙事笔记 |
| `note_write` | `tag: str, content: str` | 写入叙事笔记 |

---

## 底层骰子引擎（anko_dice MCP + anko_core.dice）

`anko_dice` MCP 直接暴露骰子工具给 AI，计算逻辑在 `anko_core.dice` 中。

不直接暴露给 anko_game 的 AI，但 `anko_dice` MCP 单独暴露供调试/自由使用。`anko_game` 内部调用 `anko_core.dice` 完成计算。

| 函数 | 说明 |
|------|------|
| `dice_roll(expression)` | NdN 语法，返回 `{rolls, total, expression}` |
| `dice_judge(roll, threshold, modifiers)` | 阈值判定，返回 `critical_success/success/failure/critical_failure` |
| `dice_range_map(roll, ranges)` | 区间映射，如 `{"white":[1,35],"green":[36,60]}` |
| `dice_contest(expr_a, expr_b)` | 对抗骰 |
| `dice_multi(expressions)` | 批量骰点 |

骰子表达式语法：`NdS[+M]` — N 个 S 面骰，加值 M。支持 `1d100`, `2d6+3`。

---

## Session 持久化（anko_db）

`anko_db` 是纯 Python 库，不暴露 MCP 接口。`anko_game` MCP 通过 `anko_db` 操作数据。

**存储**：SQLite，每个 Session 一个数据库文件。

**路径**：`~/.anko/sessions/<session_id>.db`

**表结构**：

```sql
CREATE TABLE session_meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE state (
    key TEXT PRIMARY KEY,
    value JSON,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE history (
    turn INTEGER PRIMARY KEY AUTOINCREMENT,
    narrative TEXT,
    dice_results JSON,
    paradigm_used TEXT,
    player_action TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE knowledge USING fts5(name, content, category);

CREATE TABLE notes (
    tag TEXT PRIMARY KEY,
    content TEXT,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 规则书系统

### 目录结构

规则书以 **Markdown 为主体**，YAML/JSON 仅用于结构化数据。Markdown 文件在加载时灌入知识库（FTS5），AI 通过 `knowledge_search` 即可检索。

```
rulebooks/<rulebook_id>/
├── manifest.yml              # 必需：元数据 (id, name, version, description, author)
├── world/                    # 世界设定（Markdown → 知识库）
│   ├── setting.md            # 世界观概述
│   ├── factions.md           # 阵营描述
│   ├── locations.md          # 地点介绍
│   └── npcs.md               # NPC 叙述（数值部分可用 Markdown 内嵌 YAML frontmatter）
├── rules/                    # 游戏规则
│   ├── combat.md             # 战斗规则叙述
│   └── paradigm_overrides.yml  # 可选：范式覆盖/扩展（唯一必须结构化的规则文件）
├── data/                     # 游戏数据（YAML/JSON/CSV → 结构化数据表）
│   ├── items.csv              # 物品数据（CSV，Excel 友好）
│   ├── enemies.csv            # 怪物/敌人面板
│   └── random_tables.yml      # 随机表（嵌套结构，YAML 更合适）
├── ai/                       # AI 指南（Markdown → 知识库 + 上下文注入）
│   ├── guidelines.md         # 叙事指南、骰子尊重规则
│   └── style.md              # 叙事风格示例
└── scripts/                  # 可选：Python 脚本
    ├── init.py               # 场景初始化
    └── custom_dice.py        # 自定义骰子/判定逻辑
```

**格式划分原则**：
- **Markdown**：叙事性、指导性内容（世界观、规则叙述、AI 指南）— 加载时灌入 FTS5 知识库
- **YAML/JSON**：嵌套结构化数据（范式覆盖、骰子规则、复杂配置）— 加载时解析为数据结构
- **CSV**：表格数据（物品表、怪物面板、随机表、技能表）— 加载时解析为数据行，可用 Excel/LibreOffice 编辑
- **YAML frontmatter**：Markdown 文件可内嵌结构化数据（如 NPC 叙述 + 属性面板）

### 范式覆盖（paradigm_overrides.yml）

规则书**不需要定义范式**——6 种基础范式由 core 提供。规则书只在需要**覆盖或扩展**时才写。

```yaml
# 可选文件，不写就用 core 默认
overrides:
  combat:
    always_use: dice_resolution    # 战斗场景必须骰点判定
    difficulty_formula: "1d20 + enemy_cr - player_modifier"
    critical_thresholds:
      critical_success: 20         # 自然 20 大成功
      critical_failure: 1          # 自然 1 大失败
    ai_instruction: "战斗必须骰点。大失败时引入新困境而非直接死亡。"

  social:
    prefer: option_anka            # 社交场景倾向选项安价
    allow_free_input: true         # 允许玩家提出选项外行动

# 扩展：规则书独有的范式
extensions:
  horror_check:
    type: dice_resolution
    trigger: "遇到恐怖事物时"
    dice: "1d100"
    thresholds:
      success: "roll <= wisdom * 5"
      failure: "roll > wisdom * 5, lose 1d10 sanity"
    ai_instruction: "失败时描写角色心理崩坏的过程"
```

---

## 范式系统

### Core 提供的 6 种基础范式

| 范式 | 场景驱动工具 | 适用场景 | AI 自由度 |
|------|------------|---------|----------|
| `dice_resolution` | `action_resolve` | 战斗、技能检定、危险行动 | 低（骰子决定成败） |
| `option_anka` | `explore_options` | 探索、对话、决策 | 中（AI 提供选项，玩家选择） |
| `pure_anko` | `story_branch` | 剧情分支、命运抉择 | 低（骰子决定走向） |
| `random_generation` | `generate_content` | 角色创建、物品生成 | 中（骰子定属性，AI 解读） |
| `free_narration` | `scene_narrate` | 日常、休息、非关键互动 | 高（无骰子，纯叙事） |
| `free_anka` | `action_resolve(allow_free=true)` | 玩家自由行动 | 高（玩家提议，AI 判定是否需要骰子） |

### AI 范式决策流程

1. AI 理解玩家行动意图
2. 查询 `paradigm_overrides` 是否有**强制绑定**（如 combat → dice_resolution）
3. 无强制绑定时，AI 根据叙事上下文自主选择
4. 可通过 subagent 辅助决策（搜索知识库 + 分析场景）
5. 调用对应的场景驱动工具

---

## Claude Code 适配层

### Skills

| Skill | 触发 | 功能 |
|-------|------|------|
| `/anko-start <rulebook>` | 用户输入 | 创建 Session + 加载规则书 + 注入 AI 指南到 CLAUDE.md |
| `/anko-action <description>` | 用户输入 | 执行玩家行动（含范式决策） |
| `/anko-roll <expression>` | 用户输入 | 纯骰点（调试/自由使用） |
| `/anko-status` | 用户输入 | 查看当前角色/世界状态 |
| `/anko-recap` | 用户输入 | 回顾叙事历史 |

### Hooks

通过项目级 `.claude/settings.local.json` 配置：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__anko_core__action_resolve",
        "hooks": [{
          "type": "command",
          "command": "python -m anko_core.hooks.verify_state_sync"
        }]
      }
    ]
  }
}
```

**Hook 功能**：
- **状态同步验证**：`action_resolve` 调用后，验证 `state_changes` 已正确写入
- **审计日志**：记录每次骰子结果和 AI 叙事是否一致

### 安装脚本

`adapters/claude_code/install.sh`：
1. 将 `src/anko_core/skills/*.md` 拷贝到项目 `.claude/skills/`
2. 生成 `.mcp.json`（配置 anko-core server 路径）
3. 生成 `.claude/settings.local.json`（hooks 配置）
4. 生成 `CLAUDE.md` 片段（AI 指南）

---

## 六种互动范式详解

（此部分已在先前的计划文档中详细定义，作为参考附录，此处不再重复）

---

## 实现路径

### Phase 0: 骰子引擎 + MCP Server 骨架
- 骰子引擎：`dice_roll`, `dice_judge`, `dice_range_map`, `dice_contest`
- MCP server 入口，注册底层工具
- PyPI 包结构（pyproject.toml）

### Phase 1: Session 管理 + 规则书加载
- SQLite 持久化（session_meta, state, history, knowledge, notes）
- 规则书目录结构 + YAML 加载 + schema 校验
- knowledge FTS5 搜索
- Session 管理工具

### Phase 2: 场景驱动工具 + 范式系统
- 5 个场景驱动工具：`action_resolve`, `story_branch`, `generate_content`, `explore_options`, `scene_narrate`
- Core 6 范式实现
- `paradigm_overrides.yml` 加载
- 底层工具降级为内部 API

### Phase 3: Skills + Hooks + 安装脚本
- 5 个 Claude Code Skills
- 状态同步 hook
- 安装脚本
- 端到端验证

### Phase 4: 示例规则书 + 插件系统
- 完整示例规则书（《兽人D&D冒险团》）
- Python 脚本插件系统
- 数据导入工具

### Phase 5: 知识库增强
- sqlite-vec 向量搜索
- 叙事笔记自动维护
- 知识库可视化

---

## 验证标准

1. **Phase 0**：`dice_roll("2d6+3")` 返回正确结果，Claude Code 能通过 MCP 调用
2. **Phase 1**：创建 Session → 加载规则书 → 状态持久化 → 重启后恢复
3. **Phase 2**：`action_resolve("攻击哥布林", {scene_type:"combat"})` 强制骰点判定，AI 按结果叙事（包括失败）
4. **Phase 3**：`/anko-start orc_dnd` → `/anko-action 攻击哥布林` → 完整游戏循环
5. **Phase 4**：自定义规则书 + 自定义骰子脚本正常运行

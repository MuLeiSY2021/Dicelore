# 团本与 manifest（组件6）

> **本页职责**：定"团本"（内容包，非框架代码）的**产物格式**——包目录布局、manifest schema、各内容类型的 MD/CSV 列规范、**阵线/倒计时钟（Front/Clock）**、版本号、以及"包 → 四域"的 import 映射。这是作者灌注进数据层的内容契约。
> **上游依赖**：[技术选型 §5 MD主体+CSV](../03-架构/技术选型.md)、[§3 FTS5/jieba](../03-架构/技术选型.md)；[总体架构 §3 两写源/版本化分发](../03-架构/总体架构.md)、[§7 组件6](../03-架构/总体架构.md)；[02 §2 四域](../02-领域模型/核心概念.md)；[内层 §2 落库形态](内层能力库.md)、[§6 建库](内层能力库.md)；可见性 [ADR-0010](../05-决策记录-ADR/README.md)。
> **下游**：本页只定"产物长什么样"；**怎么造出符合此格式的东西**（读写层 / 构建 skill / Web 门面 / 素材检索）→ [团本构建工具链](团本构建工具链.md)。
> **状态**：🟢 已定稿（2026-06-17）。

---

## 1. 团本包 = 一个目录（布局）

团本是一个**目录**：纯文本（MD + CSV + 一个 YAML），可 git 版本化、可压缩分发、可被运行时 import 建库。**目录即包**，无打包格式、无二进制。

```
凡人修仙传/
├── manifest.yaml          # 顶层声明（元信息 + 选 skill + 钟 + 引子）
├── world/                 # 散文底料（AI 直读）   → world_doc (FTS5)
│   ├── 设定.md
│   ├── 门派/黄枫谷.md
│   └── npc/墨大夫.md
├── pools/                 # 卡池 / 随机池         → world_pool
│   └── 灵根.csv
├── params/                # 范式参数（分档表等）   → 随 flow skill 用
│   └── 突破分档.csv
├── rules/                 # 机制 / 判定规则（带版本）→ rule_doc
│   └── 修炼体系.md
├── sheets/                # 开局人物卡 / 世界初值（可选）→ sheet
│   └── 开局.csv
└── fronts/                # 阵线 + 倒计时钟（预置的"会自己推进"的威胁，可选）→ sheet 钟 + 预声明 watcher
    └── 魔道入侵.md
```

运行时由 `anko` 的建库流程 import 该目录（§8）。除 `manifest.yaml` 外全部子目录**按需出现**——最小团本可以只有 manifest + 一篇 `world/设定.md`。

---

## 2. `manifest.yaml`（顶层声明）

承接 [01 场景 C](../01-业务分析/用户与场景.md)"薄到近声明"：团本特有的只是**填三件事**（世界观 / 机制差异 / 随机池数据）+ **选 skill**。manifest 是配置而非表格，故用 YAML（字段少、含列表、工具/人皆好读；表格数据仍走 CSV，[技术选型 §5](../03-架构/技术选型.md)）。

```yaml
id: fanren-xiuxian          # 唯一标识（建库写 session_meta）
version: 1.2.0              # 团本版本（迁移用，§8）
name: 凡人修仙传
description: 低武凡人流修仙，资质平庸者的逆袭。
flows:                     # 选用的流程 skill（见 Skills 包）；框架核心 skill 恒载、不在此列
  - anko-flow-gacha        # 抽灵根 / 抽机缘
  - anko-flow-contest      # 斗法对抗
  - anko-flow-explore      # 秘境探索
clock: 世界.年             # 钟属性声明（watcher 比对用；ADR-0011 / ADR-0013）
entry: world/设定.md#引子   # 开局引子（指向 world 某 doc 锚点，或内联文本）
```

`flows` 只声明**用哪些已存在的流程 skill**（流程 skill 本体在 [Skills 包](Skills包.md)，团本不写流程逻辑）。`clock` 缺省则退化按 `seq`（[ADR-0011](../05-决策记录-ADR/README.md)）。

---

## 3. world 底料（Markdown 主体）

承接 [02 §2 world 域](../02-领域模型/核心概念.md)：世界观 / 门派背景 / **NPC 人设**用 Markdown 散文，AI 直读，import 落 `world_doc`（FTS5 + jieba 分词，[技术选型 §3](../03-架构/技术选型.md)）。

- **frontmatter（可选）**：`tags`（召回兜底）、`visible`（[ADR-0010](../05-决策记录-ADR/README.md) deny-by-default，缺省隐）、`source: author`（迁移钩子，区分作者灌注 vs 运行时 AI 现编）。
- **NPC 的两种形态**：人设/性格/动机/背景 = `world/npc/*.md` 散文（进 world_doc）；**机械数值卡**（HP / 战力 / 好感度暗值）若要预置 → 进 `sheets/`（§5）。**v1 团本里 NPC 以人设散文为主**，数值多由运行时 AI 按需现起；只有"开局即在场、需要确定数值"的关键 NPC 才预置 sheet。

---

## 4. CSV 列规范（结构化数据）

承接 [技术选型 §5](../03-架构/技术选型.md)"CSV 仅结构化数据"。统一约定：首行表头；每个 CSV 可选带 `weight` / `source` / `visible` 元列（缺省 `weight=1`、`source=author`、`visible=隐`）。

### 4.1 卡池 / 随机池 `pools/*.csv`

落 `world_pool`，**结构保真不拍平**（每行整体存 `row_json`，[内层 §2](内层能力库.md)）；按列过滤 + 加权抽样在裁决层做（`world_sample`）。**随机表 = 卡池的特例**，同一列规范。

```csv
名称,品级,概率描述,weight
天灵根,上品,万中无一,1
异灵根,中品,罕见,8
四灵根,下品,资质平庸,40
五灵根,废灵根,几无修炼可能,51
```

### 4.2 范式参数 `params/*.csv`（分档表）

供 flow skill 用的参数表；嵌套配置**拍平成列**。最常见是 `resolve_outcome` 的分档（label / min / max / consequence），列名对齐工具入参（[MCP工具面](MCP工具面.md) `resolve_outcome.bands`）：

```csv
label,min,max,consequence
大失败,1,5,走火入魔，根基受损
失败,6,10,突破失败，灵力反噬
成功,11,18,顺利突破
完美,19,20,境界稳固，额外感悟
```

### 4.3 物品面板 / 其它表格

`名称, 属性...` 行×列策划表，按团本需要定列。**零碎到不值一张表的小块** → 留 world MD 的 frontmatter，不强行 CSV。

---

## 5. `sheets/` 开局状态（可选）

开局人物卡 / 世界初值。CSV 形态对齐 [内层 sheet 三列 + visible](内层能力库.md)：`(entity, attr, value, visible)`。

```csv
entity,attr,value,visible
韩立,资质,五灵根,1
韩立,灵力,0,1
世界.年,值,0,0
```

import 时灌入 sheet 域作**开局状态**（非 world 底料——sheet 是局内可变状态）。玩家主角卡缺省可设 `visible=1`，或由 AI 开局 `sheet_show` 一次（[ADR-0010](../05-决策记录-ADR/README.md)）。

---

## 6. `fronts/` 阵线（Front）与倒计时钟（Clock）

承接 [ADR-0016](../05-决策记录-ADR/README.md) + [02 术语表 Front/Clock](../02-领域模型/术语表.md)：团本可预置"会自己推进、给世界上发条"的压力源。借自 PbtA 的 **Fronts + countdown clocks**——是作者备团的核心单元（把"团本预声明 watcher"从 [ADR-0013](../05-决策记录-ADR/README.md) 的"留未来"提前纳入 v1）。

- **Clock（倒计时钟）** = 一个 sheet 钟 attr（如 `世界.入侵进度`，带 min/max/mode）。本质是 **sheet 钟 + 监视它的 watcher 的封装**，非新底层机制（[内层 watcher](内层能力库.md)）。
- **Front（阵线）** = 一组关联威胁：名字 + 利害问题 + 一个 Clock + **阶梯式凶兆表**（钟值 → 触发 payload）。每个 front 一个 MD 文件——frontmatter 声明 Clock，body 写阵线散文 + 利害，表格写凶兆阶梯。

```markdown
---
clock: 世界.入侵进度       # 钟 attr（可独立于 manifest.clock 的局部钟）
min: 0
max: 8
mode: once                # once（钟满触发一次）/ repeat
visible: 0                # 钟对玩家是否可见（ADR-0010 deny-by-default）
---
# 魔道入侵

**利害问题**：黄枫谷能否在魔道大军压境前完成护山大阵？

## 凶兆阶梯

| 钟值 | 凶兆（触发 payload） |
|------|---------------------|
| 3 | 边境小镇沦陷的消息传来——给玩家"是否驰援"的压力 |
| 6 | 黄枫谷外围弟子折损，护山阵灵力告急 |
| 8 | 魔道破阵，正面决战（终局威胁） |
```

凶兆阶梯每行 = 一个**预声明 watcher**：`condition = {世界.入侵进度} >= 钟值`、`payload = 凶兆文本`、`armed=1`、`mode` 随 front。运行时钟一旦被 `sheet_update` 推进越过某格，watcher 就地触发、payload 经出参回 AI——这正是"失败 / 事件**推进末日钟**"的落点（呼应 [Skills 包 §3 fail-forward 手法](Skills包.md)）。

> **Front 是预声明、非运行时现起**：这是 v1 给 Front 的入口（运行时 AI 仍可用 `watcher_set` 临时建威胁）。Clock 也可不挂 Front 单独用（纯倒计时）。

---

## 7. rule 底料 + 版本号

承接 [02 §2 rule 域](../02-领域模型/核心概念.md) + [ADR-0005](../05-决策记录-ADR/README.md)：机制 / 判定规则 = `rules/*.md`，**AI 只读、人类版本化热更新**。frontmatter 带 `version`；import 落 `rule_doc`（FTS + version 字段）。曲线 / 分档这类小结构表**拍平进散文 OK**（rule 被整段读、不抽样、不过滤，[内层 §2](内层能力库.md)）。

```markdown
---
version: 3
---
# 修炼体系
练气（1-13 层）→ 筑基 → 结丹 → 元婴 …
突破判定：见 params/突破分档.csv；境界越高，反噬越重。
```

---

## 8. import 语义（包 → 四域映射）

建库流程读包目录，建四域 schema，按类型灌注。本页定**映射契约**；session 解析 / schema 细节见 [内层 §6](内层能力库.md)。

| 包内 | → 域 | 备注 |
|------|------|------|
| `manifest.yaml` | `session_meta` | id / version / flows / clock / entry |
| `world/**/*.md` | `world_doc` | frontmatter → tags / visible / source |
| `pools/*.csv` | `world_pool` | 整行存 row_json，不拍平 |
| `params/*.csv` | （随 flow skill 取用） | 不单独建表，作 skill 数据 |
| `rules/*.md` | `rule_doc` | 带 version |
| `sheets/*.csv` | `sheet` | 开局状态，非底料 |
| `fronts/*.md` | `sheet` ＋ `watcher` ＋ `world_doc` | frontmatter 钟 → sheet 钟初值；凶兆阶梯每行 → 预声明 watcher（`armed=1`）；阵线散文 → world_doc |

import 是**一次性灌注**：建库后 world/sheet 可被运行时 AI 继续写（`source=ai`），rule 由人类版本化热更新；二者区分靠 `source` 列（迁移钩子，§9）。

---

## 9. 版本化分发的迁移语义（v1 简化，深迁移留未来）

承接 [总体架构 §3](../03-架构/总体架构.md)"两写源 / 版本化分发"。核心张力：**"团本 v2" vs "进行中存档（已带 v1 期间 AI 长出的内容）"**。

- **v1 简化**：① **rule 可热更新**——人类改 `rules/*.md` 升 version，运行时按 version 取新规则（不动存档其余部分）；② 其余结构性迁移（pool 改列、sheet 加 attr）**留未来**。
- **`source` 列承重**：迁移时区分"作者原始内容（可被新版覆盖）"vs"AI/玩家运行期产物（必须保留）"。
- 完整迁移工具（diff / merge / 冲突解决）属未来；v1 不做。

---

## 本页**不**负责定的

- CSV/MD 落库后的**存储 schema**、FTS5 分词、row_json 求值 → [内层能力库](内层能力库.md)
- 怎么**造出 / 校验**符合本格式的包（读写层 / 构建 skill / Web 门面 / 素材检索）→ [团本构建工具链](团本构建工具链.md)
- 流程 skill 的**内容本身** → [Skills 包](Skills包.md)（本页只定 `flows` 的"选 skill"声明形态）
- 工具入参 schema（`world_sample` / `resolve_outcome` 等如何吃这些数据）→ [MCP工具面](MCP工具面.md)

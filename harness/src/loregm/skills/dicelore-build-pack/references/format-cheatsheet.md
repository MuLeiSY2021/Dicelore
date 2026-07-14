# 包格式速查（format-cheatsheet）

> 此文档汇总团本包各文件的字段/列规范，供构建时快速核对。权威来源：`wiki/开发指南/04-子系统设计/团本与manifest.md`。

---

## manifest.md

`set_manifest({ name, id })` 产出 `manifest.md`——import 闸门只认这一个文件名（`backend/src/catalog/import.ts` 取 H1 当团本名、`- id:` 行当 catalog key）：

```markdown
# 凡人修仙传

- id: fanren-xiuxian
```

`set_manifest` 参数：`{ name, id }`。version/flows/clock/entry 暂不由 manifest 承载（`set_manifest` 当前只接受 name/id）；需要的话在 lore/rule 文档 frontmatter 里声明。

---

## lore 文档（`write_lore`）

| frontmatter 字段 | 默认值 | 说明 |
|------------------|--------|------|
| `tags` | — | 召回兜底标签（可选） |
| `visible` | 0（隐） | 同 visible 语义表 |
| `source` | `author` | 区分作者内容 vs 运行时 AI 内容（迁移钩子） |

Body = 散文 Markdown。NPC 人设/性格/动机/背景都是散文，不要强行表格化。

---

## visible 语义

| 值 | 含义 | 适用场景 |
|----|------|----------|
| `0` | 隐（hidden） | 世界状态、系统数值；玩家和 AI 运行时都看不到 |
| `1` | 显（visible） | 玩家可见属性（资质/HP/资产） |
| `2` | 暗（shadow） | NPC 暗数值（战力/好感度）；AI 可见，玩家不可见 |

默认：`visible:0`（deny-by-default，ADR-0010）。

---

## sheets CSV（`set_state` / `sheets/*.csv`）

必选列：`entity, attr, value`  
可选列：`kind`（player/npc/world）、`visible`（0/1/2，默认 0）

```csv
entity,attr,value,visible
韩立,资质,五灵根,1
韩立,灵力,0,1
墨大夫,战力,70,2
世界.年,值,0,0
```

- `kind` 决定 sheet 查询分区（缺省按 entity 推断，不确定时显式写）
- 同一 entity+attr 多次 `set_state` 追加行（非覆盖）——开局不要重复写同一个 attr

---

## pools CSV（`add_pool`）

任意列，以下为元列（可选）：

| 元列 | 默认 | 说明 |
|------|------|------|
| `weight` | 1 | 加权采样权重 |
| `visible` | 0 | 该条目对玩家可见性 |
| `source` | `author` | 内容来源标记 |

```csv
名称,品级,weight
天灵根,上品,1
异灵根,中品,8
四灵根,下品,25
五灵根,废灵根,51
```

- 同一 pool 多次 `add_pool` 追加行（非覆盖）
- pool name 建议和团本内分类对齐（如"灵根"/"机缘"/"物品"）

---

## rules 文档（`write_rule`）

```markdown
---
version: 3
---
# 修炼体系
练气（1-13 层）→ 筑基 → 结丹 → 元婴 …
突破判定：…
```

- `version` frontmatter 供运行时热更新
- 曲线/分档可内嵌散文（不需要专门 params CSV，除非 flow skill 明确依赖）

---

## fronts 文档（`add_front`）

`add_front` 参数及语义：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | Front 唯一 id（小写字母/连字符），同 id 覆盖（幂等） |
| `name` | string | 人类可读名 |
| `stakes` | string? | 利害问题（"X 能否在 Y 前做到 Z？"） |
| `clock_attr` | string | 钟 attr（如 `世界.入侵进度`），写入 sheet |
| `clock_min` | number | 钟最小值（通常 0） |
| `clock_max` | number | 钟最大值 |
| `clock_mode` | `once`\|`repeat` | `once` = 钟满一次性触发；`repeat` = 每越格触发 |
| `omens` | `{threshold,payload}[]` | 凶兆阶梯——每条对应一个预声明 watcher |

产出文件格式（`fronts/<id>.md`）：

```markdown
---
clock: 世界.入侵进度
min: 0
max: 8
mode: once
visible: 0
---
# 魔道入侵

**利害问题**：黄枫谷能否在魔道大军压境前完成护山大阵？

## 凶兆阶梯

| 钟值 | 凶兆（触发 payload） |
|------|---------------------|
| 3 | 边境小镇沦陷的消息传来——给玩家驰援压力 |
| 6 | 黄枫谷外围弟子折损，护山阵灵力告急 |
| 8 | 魔道破阵，正面决战（终局威胁） |
```

凶兆阶梯建议均匀分布于 min~max 区间，保留终局槛（= clock_max）作高潮威胁。

---

## 包目录布局总览

```
<团本名>/
├── manifest.md
├── lore/
│   ├── 设定.md
│   ├── 门派/<门派名>.md
│   └── npc/<NPC名>.md
├── pools/
│   └── <池名>.csv
├── rules/
│   └── <规则名>.md
├── sheets/
│   └── 开局.csv
└── fronts/
    └── <front-id>.md
```

最小团本：只需 `manifest.md` + 至少一篇 `lore/` 文档。其余子目录按需出现。

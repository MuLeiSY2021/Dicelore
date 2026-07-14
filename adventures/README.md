# adventures/ — 预制 Adventure（团本）内容包

本目录放**随项目分发的预制 Adventure（团本）**：作者用 lore 构建线产出、可直接 import 进运行库开玩的内容包。

> **为什么单列一根**：`frontend/ backend/ harness/ packages/` 是**代码**；Adventure 是**内容**（散文/规则/卡池/阵线）。内容与代码分根，清晰、可发现。
> **命名**：实体英文定名 **Adventure**（中文显示「团本」）。

## 一个 Adventure 的目录形态（= import 闸门认的 pack 格式）

```
adventures/<slug>/
├── manifest.md          # 团本元信息（名/简介/版本…）           ★必备
├── prologue.md          # 开场 prompt（kickoff 首轮 impetus）     ★必备
├── lore/*.md            # 世界观条目        → lore 域
├── rules/*.md           # 规则条目          → rule 域（人类侧写、AI 只读）
├── pools/*.csv          # 卡池              → pool（world 域）
├── state/*.csv          # 开局状态(带 kind) → state（sheet 域）
├── fronts/*.md          # 阵线（frontmatter: Clock + 凶兆阶梯）→ front 域
├── plotlines/*.csv      # 剧情线            → plotline 域
├── foreshadows/*.csv    # 伏笔              → foreshadow 域
└── anchors/*.csv        # 锚点              → anchor 域
```

格式与 `backend/src/catalog/import.ts` 的 `importPack` / `validatePack` 对齐；详见 wiki [后端双路径架构 §4](../wiki/开发指南/04-子系统设计/后端双路径架构.md)。

## 怎么进 catalog

DB 权威、git 只是进出口投影。预制 Adventure 经一个 **seed 步骤**灌进 catalog DB（`importGit` / `commit`+`tag`），dice 开局再从 catalog `importPack` 物化进 per-session 运行库。

> seed 脚本（把 `adventures/*` 批量灌 catalog）= **待补 follow-up**；当前先立此目录与格式约定。现暂无预制内容。
</content>

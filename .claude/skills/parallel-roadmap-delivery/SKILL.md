---
name: parallel-roadmap-delivery
description: Dicelore 路线图的「并发编排」上层 skill。当要把路线图多个批次/多条线尽量不打扰用户地一路推到底时用——在 [autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md) 单线闭环之上加四件:① 决策账本(可逆性判据,把"每次卡"压成"卡一次大的");② 波次 fan-out(同波无依赖项各开 worktree 并发 subagent,git 归编排者);③ SendMessage 续接(活 subagent 塞回决策、零 PROGRESS;长等待才落 PROGRESS 兜底);④ CI/PR 分阶段门禁(CI 是安全网+发版闸载体)。单线推进仍用 autonomous-delivery-loop,本 skill 只管"多线怎么并、卡点怎么不打扰人"。
---

# 并发路线图交付（parallel-roadmap-delivery）

> **定位**：[autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md) 是**单线**自主闭环（一条线从差距分析到合并）。本 skill 是它的**并发上层**——管「多条线怎么并行、决策卡点怎么不回头问人」。每条并行线**内部仍走 autonomous-delivery-loop 的 a→g**。
>
> **由来**：业界 spec-driven（GitHub spec-kit 的 `/clarify`、Kiro、BMAD）证明「实现前一次性消歧」可行但**无法消除全部卡点**——非确定性 + 实现中才浮现的歧义是 LLM 编码的固有属性（Martin Fowler 实测）。故本 skill 不追求「零卡点」，追求「**可逆的全自决、不可逆的批量前置、浮现的边做边判**」，把打扰频率压到最低。

## 何时用

- 用户要「一路推进路线图 / 尽量别问我 / 把这几批做完」。
- 有 ≥2 条**无依赖**的线可同时推（如后端 fix + 前端 fix + e2e）。
- 单条线、或全是串行依赖链 → **退回 [autonomous-delivery-loop](../autonomous-delivery-loop/SKILL.md)**，别套并发开销。

---

## 核心一：可逆性判据（停顿阈值）

**每个决策点先过这条测试——「这决定错了，撤回代价大吗？」**

| 类别 | 判据 | 动作 |
|------|------|------|
| **可逆** | 内部 schema / 实现选择 / 纯加法 / 命名 / 测试设计 | **选最合理默认，记决策账本，继续——绝不问** |
| **混合**（有无悔子集） | 一部分纯技术安全无悔、一部分是产品/安全权衡 | **交付无悔部分，只把不可逆残余攒进账本**（例：SSRF——挡 RFC1918 私网段=无悔先做；host 白名单策略=攒着问） |
| **不可逆** | 产品范围 / 承重架构 / 外部可见行为 / 安全产品权衡 / 多租户 / 计费 | **攒进账本，不停下**，继续做不依赖它的活 |

> **关键：攒，不是停。** 不可逆决策攒进**决策账本**（`docs/todo/decisions-pending.md`），到 checkpoint 一次性 `AskUserQuestion` 批量问。技术类歧义（"这是不是死代码""撞没撞天花板"）**自己消化**，只有牵出新产品决策时才进账本。

## 核心二：决策账本（把"每次卡"压成"卡一次大的"）

**起手第一步**：扫路线图剩余项 + 三池，产出 `docs/todo/decisions-pending.md`：

```markdown
# 决策账本（YYYY-MM-DD 扫描）
## 可逆（我已自决，记录默认值，无需用户）
- [token 归因维度] 默认 per-turn + per-agent 双采（raw log 已有 usage）。理由：…
## 不可逆（待用户一次裁决）
- [ ] 快照 v1 是否开放回滚 UI？（无悔地基=snapshot 表+checkpoint 原语我先建；开放与否=产品决策）
- [ ] 多租户 key 后端托管方案？（ADR-0027 草案待复核）
## 实现中浮现（coding 时追加，可逆即自决回填、不可逆攒下批）
```

不可逆项攒够一批 → **一次 `AskUserQuestion`**（推荐项放第一、标 Recommended）。用户答完回填账本 + 落 ADR/backlog。**这一步就是 spec-kit `/clarify` 的等价物**，但只问真不可逆的。

> **不全量前置 spec/plan**（Fowler 坑：文档爆炸 + 返工 + 评审过载）。只对「已裁决 + 当批要做」的写 spec/plan，边做边写。

## 核心三：波次 fan-out（git 归编排者，subagent 只写文件）

1. **DAG 分波**：按依赖排波次，**波内 = 同层、无依赖、不碰同一文件的兄弟**（前置闸先单独成波——例：视图层→②③ 是硬依赖，必须串行）。
2. **编排者开 worktree**（**不是 subagent**——硬约束见下）：每条线 `EnterWorktree` 或 `git worktree add` 从 main 开独立分支。把 worktree 绝对路径告诉 subagent。
3. **派 `run_in_background` subagent** 进各自 worktree，下发**判据 + 边界**：
   - 「**worktree 内只读写文件，绝不碰 git**（commit/merge/push 全归编排者）」
   - 「Edit/Write 一律用 worktree 绝对路径」（教训：`[worktree内Edit用worktree路径]`）
   - 「可逆歧义选默认继续、攒成批；不可逆/跨feat 才发消息给我」
4. **续接 > 接力**（核心二的简化）：
   - **小歧义**（编排者能秒拍）→ subagent `SendMessage` 问 → 编排者 `SendMessage` 塞回决策 → subagent 续（**上下文活着，零 PROGRESS**）。
   - **大歧义**（要等用户裁决的长窗口）→ subagent 写 `PROGRESS.md`（接力棒：已改文件/改到哪/卡在哪/裁决后下一步）→ 返回 → 用户裁完 → 编排者起**新** subagent 靠 PROGRESS.md 接力。
   > PROGRESS.md 是**长等待/意外死亡的兜底**，不是日常——能 SendMessage 续接就别写。

## 核心四：串行收口（质量闸，不省）

并发的瓶颈在收口，**这段编排者串行做、是质量闸**：

1. **逐条 merge**：worktree 分支 → main，`--ff-only`（或 `--no-ff` 保批次语义）。**并发线碰同一文件会冲突**（例：两条线都改 `mcp/server.ts`）——分波时就避开，真撞了串行解。
2. **主仓库验收**：`npm run test:all` + `npm run typecheck:all`（**worktree 缺本地依赖，jsdom/SDK 跑不全，验收必须回主仓库**）。web 改动走 `/webapp-testing`。
3. **沉淀 wiki + 清场**（同 autonomous-delivery-loop ⑦）：现状转✅、backlog 关条目、路线图勾批、spec/plan 全套落地后才清。**调查结论必沉 wiki**（教训：`[调查要沉淀进wiki]`）。
4. **CI/PR 分阶段**（见下）。

## 核心五：CI / PR 分阶段门禁

- **CI 已建**（`.github/workflows/ci.yml`：push/PR→main 跑 `typecheck:all`+`test:all`）。它是**并发交付的安全网**（merge 后 CI 兜底）+ **发版闸 gate 载体**。
- **PR 的性价比取决于 CI**：
  - **有 CI** → subagent 写完，编排者推分支 → 开 PR（`gh pr create`）→ **CI 自动验** → 绿了合。PR 从形式负担变自动质量闸。
  - **当下单人 repo**：本地 `--ff-only` merge + 主仓库手动 `test:all` 把关已等价 CI 内容；PR 主要价值是 diff 留痕。**push 由用户单独指令**（并发多 session 远端易撞）。
- **git/PR 操作全归编排者**，不归 subagent（同核心三）。

---

## 硬约束（违反即破坏并发安全）

- **subagent 禁碰 git**（memory 铁律 `[并发会话→必开worktree]`）：worktree/分支/commit/merge/push **全编排者做**；`.git/worktrees` 注册表是全局共享，多 subagent 并发 `worktree add` 会撞。
- **subagent Edit/Write 用 worktree 绝对路径**（`[worktree内Edit用worktree路径]`），否则改动落主仓库、隔离失效。
- **验收在主仓库**，不在 worktree（依赖不全）。
- **可逆性判据是默认高阈值**：可逆即自决，别回头问；不可逆攒账本批量问，别每个都打断。
- **不追求零卡点**：实现中浮现的歧义（`front_advance 撞 DSL 天花板`那类）spec 阶段抓不到——可逆的自决+记账，不可逆的攒下批。承认这是 LLM 编码固有属性。
- **git 命令 `--no-pager`**（`[git pager 卡死 Bash]`）；scoped `git add <精确路径>` 别 `-A`（`[worktree npm lock 坑]`）。

## 流程骨架（一句话）

扫路线图 → **决策账本**（可逆自决 / 不可逆批量 `AskUserQuestion`）→ DAG 分波 → 每波：编排者开 worktree + 派 subagent（只写文件）→ 小歧义 `SendMessage` 续接 / 大歧义 `PROGRESS.md` 接力 → 编排者串行 merge + `test:all`/`typecheck:all` 验收 + 沉淀 wiki + （CI 绿/PR）→ 下一波 → 浮现的不可逆决策攒下批 checkpoint。

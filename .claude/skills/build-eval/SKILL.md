---
name: build-eval
description: Dicelore 团本构建链路 eval——评估带 build-core/build-pack 教条的真构建 GM（loregm）把一份真实案例 md 造成团本造得好不好，对照该 md 出定性报告。用法：给一份真实案例 md（docs/research/scraped/*.md），经 build-mcp 连真后端当作者驱动 loregm 走完整构建（摸源→manifest→…→validate→commit），再读 loregm 的 <id>_session.jsonl + Draft/pack 当评测者对照 md 判构建行为与团本质量。触发词：跑 build eval、评估团本构建链路、看 loregm 构建得好不好、用真实案例 md 测团本构建、build-mcp eval。哪怕用户只说"用这个 md 测下团本构建""构建 GM 造得怎么样"也用它——别手动一步步调 HTTP。
---

# Dicelore build eval（造团本 · 对照真实案例 md · 定性报告）

> **本 skill 定「怎么 eval 构建链路」，不解释构建教条本身**——教条全文在 `dicelore-build-core`（身份/开场）与 `dicelore-build-pack`（阶段编排/工具用法），两者都在 `harness/src/loregm/skills/`。eval 前先读这两个教条：它们是判「构建行为」的裁决口径。这是 `play-eval` 的**孪生**（play 侧跑团本、build 侧造团本）。

## 输入（用户给一份真实案例 md）

**一份真实案例 md**（`docs/research/scraped/*.md`，如 `从刚成年开始的兽人冒险！_38582339.md` / `总之，来抽卡吧_67916530.md` / `恶龙团_54995176.md`；后续 DnD pdf 同法）。

它**双重身份**（对称 play-eval 的「对照系=真实案例语料（唯一）」）：

1. **喂给 loregm 的源素材**——经 `put_material` 流式上传进构建会话工作区，loregm 从它提炼团本。
2. **评判团本质量的黄金参照**——造出来的团本忠不忠于素材、开不开得起局，全对着这份 md 量。

> 用户会说"用哪份 md 测"。本 skill 用那份 md 驱动构建、再拿它当参照评。

## 它干什么

CC（Claude Code）经 **build-mcp**（stdio MCP，server 名 `dicelore-build`，工具 `mcp__dicelore-build__*`）连本机后端 dicelore lore/catalog 面，**当作者**驱动真构建 GM（loregm，带 build-core/build-pack 教条、烧 LLM）把那份 md 造成团本，再**当评测者**读构建产物 + 对话记录、对照 md 判构建表现，写**定性报告**。

- **对照系 = 那份真实案例 md（唯一）**：团本好不好，看它造得**忠不忠于素材、开不开得起局**——不做 doctrine-vs-baseline A/B 消融。
- **量化不可行 → 定性报告**：不声称"团本满分"、不靠数值分；给"对照源 md，哪到位 / 哪差 / 最该改 build-core 哪句"。

### 为什么经 build-mcp 连真后端（缝B），REST-only 检视式

lore 构建是 **REST only**（RT-5）：`send_to_builder` 把 loregm 驱动到 turn_end 即返回 `{turnId, error?}`，**不回传 GM 散文**（不广播、不落 narration）。loregm 改的是后端 LoreSession 持有的 in-memory Draft（经 `dicelore_build_*` 工具）。所以 eval 模型不是「发指令→收散文」，而是「发自然语言指令 → **检视产物**（未 commit 的 Draft / 已 commit 的 catalog 文件）+ **读对话记录**（jsonl）判 loregm 干了什么、进度如何」。检视类工具（`get_draft`/`list_catalog`/`get_pack_files`）+ 对话记录是本 eval 的核心信号面。

## 前置：起测试后端 + 配 build-mcp

**先走 [`eval-backend-setup`](../eval-backend-setup/SKILL.md) 前置 skill 把测试后端跑起来**——它教「eval 前怎么起后端」（仓库根 `bash install.sh` 铺 eval 数据根 `.dicelore-eval` = `$ROOT` → `cd .dicelore-eval && bash run.sh -f` 起真 loregm/dicegm → 轮询 `GET /diagnostics` 到 200 判就绪）。**本 skill 不重述起后端步骤**（单源在 eval-backend-setup）。

起后端后确认：

- `config.toml [env]` 里 `DICELORE_FAKE_GM = "0"`（走真 loregm、别图快用 fake）、`DICELORE_DATA_DIR = .dicelore-eval`。
- `.mcp.json` 的 build-mcp（`dicelore-build`）env `DICELORE_PLAY_URL` 指该后端、`DICELORE_DATA_DIR` 与后端同 `$ROOT`（`.dicelore-eval`）。
- 对话记录会落 `$ROOT/sessions/lore/<id>/<id>_session.jsonl`（评估时读它）。

## 跑一局构建（CC 当作者）

```
open_build_session()                              → 起 sid（不带参随机生成；同名 session 累积到同一 Draft）
put_material(sid, filename, localPath=<md 绝对路径>) → 流式上传源 md（大源不入 LLM 上下文，取 localPath 不塞 content）
多轮 send_to_builder(sid, name, text) 驱动 loregm 走 dicelore-build-pack 阶段：
   0. 摸源+清洗分块 → 1. manifest → 2. prologue（必填）→ 3. world → 4. npc
   → 5. cards/卡池 → 6. rules → 7. fronts/阵线 →（7b 叙事线/伏笔/锚点可选）→ 8. state
   每轮后 get_draft(sid) 检视本轮 Draft 增量（因 REST-only 不回散文，靠它判 loregm 干了什么/进度）
收口：驱动 loregm 9. validate → commit
   list_catalog()                → 确认团本已进 catalog
   get_pack_files(adventureId)   → 看已 commit 团本的实际文件内容
```

作者发言：**贴着源 md 推进**——指令自然语言、每轮聚焦一个阶段（对齐 build-pack 的「一次只声明一件事」），`name` 传在造团本名（→ 后端 UUIDv5 身份，同名累积同一 Draft）。**别替 loregm 决定内容**（它才是从 md 提炼的一方）；作者只驱动阶段推进 + 收口 validate/commit。目的是把 loregm 逼过完整构建链路，看它每步怎么走、造出的团本对着 md 有多忠。

> `send_to_builder` 返回 JSON 带 `error` 时（loregm 中途领域级出错、HTTP 仍 200/202）作者可见、别吞——记进报告。

## 读对话记录（评估主证据面）

**对话记录 = loregm 的 `<id>_session.jsonl`**（TR4 已落，在 `$ROOT/sessions/lore/<id>/<id>_session.jsonl`；CC-transcript 风格，每行前置 `uuid`/`parentUuid`）：

- `{_:"turn", ..., input}` = 作者说了什么（本轮指令 text）。
- `{_:"msg", idx, body}` = loregm 干了什么——`body` 是 SDK 每条 tool_use / tool_result / result（**看得到 loregm 每步工具调用**：`Read`/`Grep`/`Bash` 摸源清洗、`dicelore_build_*` 落 Draft、`validate`/`commit`）。
- `{_:"turn_end"}` / error 行 = 回合末锚 / 阶段错误。

**读它评构建行为**（比 `get_draft` 增量更全：能看到摸源清洗过程、有没有凭空编造、调没调不该在场的运行时工具）。逐条 msg 抓信号，裁决挂到具体行的 `uuid` 作证据。

## 评估（当评测者，对照真实案例 md，定性）

两维、对照 md 黄金参照、定性不量化：

| 维度 | 抓什么信号（jsonl + Draft/pack） | 违规长啥样 |
|---|---|---|
| **A 构建行为**（对 `dicelore-build-core` 教条） | jsonl 里：**先摸源再落笔**？（write_lore/set_state 前有没有 `Read`/`Grep`/`Bash` 摸 `materials/`）；**只声明不跑团**？（只有 `dicelore_build_*`，无 `resolve_*`/`narrate` 等运行时裁决工具）；**一次一件 + validate 收口**？（分阶段落 Draft、commit 前 `validate`） | 没摸源就编内容；调了运行时裁决工具（构建会话里结构上不该在场）；跳过 validate 直接 commit |
| **B 团本质量**（对源案例 md） | pack 有 manifest / prologue / world / npc / cards / rules / state 吗、**开得起局**吗？（prologue+manifest 齐）；**忠于 md** 吗——门派 / NPC / 机制 / 威胁线（front）对得上 md 的核心桥段吗？ | 缺 prologue / manifest 开不了局；捏造原著没有的设定；丢了 md 的核心桥段 / 机制 |

每维裁决给：① 定性判（到位 / 有洞 / 差在哪）；② **证据**——挂 jsonl 行 `uuid`（构建行为）或 Draft/pack 片段（团本质量）；③ **vs 源 md 差距**（md 里有什么、造出来对不对得上）。第③点是定性主职、也是迭代 build-core 的燃料。

## 写报告（定性）

落 `docs/dev/reports/<YYYY-MM-DD>-build-<团本名>.md`（对齐 play-eval 报告约定）：

```markdown
# <团本名>（build）· <日期>

## 对象
- 源 md：docs/research/scraped/<...>.md（双身份：源素材 + 黄金参照）
- 构建会话：sid=<...>；commit=<adventureId@ref>

## 逐维裁决（对照源 md）
- [A-构建行为] 到位/有洞 — <证据：jsonl 行 uuid=... 的 tool_use/tool_result 片段> — <vs 源 md：先摸源？只声明？validate 收口？>
- [B-团本质量] 到位/有洞 — <证据：get_pack_files / get_draft 片段> — <vs 源 md：门派/NPC/机制/front 对得上吗、开得起局吗>

## vs 真实案例（整体）
<这一局造出的团本，相比源 md：哪到位、哪差、最该改 build-core 哪句>

## build_core_fix_hints
- <build-core/build-pack 措辞具体建议，能泛化到同类素材、别过拟合本 md>

## findings 分流
- A·措辞：<当轮可改 build-core/build-pack 的> → 当轮迭代
- B·架构：<loregm 要的能力现工具/架构给不了（如某类源结构处理不了、某检视面缺）> → 记 findings 路由设计，别提示词硬磨
```

## 纪律

- **对照真实案例 md、非凭空**：每维裁决挂到 build-core/build-pack 教条某条（忠于素材 / 产出能被玩 / 一次一件 + validate 收口 / 阶段编排）+ 挂源 md 具体桥段；挂不上明说「md 无此桥段、按公认构建律判」。
- **玩家所见口径不适用**（这是构建侧，不是跑团）：判据是「**团本可玩性 + 忠于素材**」，不是 narration/presentation。构建证据面 = jsonl 对话记录 + get_draft/get_pack_files 检视，不是 GM 散文。
- **量化不可行 → 定性**：不给数值分、不声称"满分"；给"对照源 md 的差距 + 该改哪句"。**不做 baseline A/B**。
- **B 类路由设计、别提示词硬磨**：loregm 做不到是工具/架构缺，记 findings B 表路由设计，不在 build-core 提示词硬塞。
- **别过拟合**：`build_core_fix_hints` 要能泛化到同类素材，不是只补本 md 特例。

## 依赖与边界（现状）

- **只依赖 loregm 落 jsonl 对话记录**（TR4 已交：`LoreSession` 穿 `sessionId`/`dataDir` → loregm 落 `$ROOT/sessions/lore/<id>/<id>_session.jsonl`）。
- **不依赖 Draft 真回退**（RT-8/lore-draft rollback hook 是占位 no-op：transcript 层回退对 lore 一样生效，但 lore 领域态 Draft 按轮还原尚未实现——本 eval 不用它，纯前向跑一局构建即可）。
- **真跑一局构建属手动门（dogfood、烧 LLM）**：起真后端 + build-mcp、用一份 `docs/research/scraped/*.md` 跑完整构建对话 → jsonl 落盘 → 出报告。本 skill 是文档，无代码编译；自动化只查文档 + 相关 typecheck/test，live 部分手动跑。

## 现状 / 路径（调本 skill 前先 verify）

storage-port / eval 框架重构曾搬家，调前先 verify 位置（`find . -name <file> -not -path '*/node_modules/*'`）：

- 后端入口：`backend/src/server.ts`；数据根解析：`backend/src/config.ts`（认 `DICELORE_DATA_DIR`）。
- build-mcp：`harness/eval-loregm/build-mcp.ts`（工具 `open_build_session`/`send_to_builder`/`put_material`/`get_draft`/`list_catalog`/`get_pack_files`）。
- 构建教条：`harness/src/loregm/skills/dicelore-build-core/SKILL.md`（身份/开场）、`.../dicelore-build-pack/SKILL.md`（阶段编排/工具用法）。
- 对话记录 runtime：`harness/src/runtime/transcript.ts`（`SessionTranscript`，UUID 权威源）；lore 接线：`harness/src/loregm/LoreSession.ts` + `backend/src/api/lore.ts`。
- 前置起后端：[`eval-backend-setup`](../eval-backend-setup/SKILL.md)（TR7）。

# 决策账本（2026-07-02 · transcript-runtime + datadir + build-eval）

> 本轮交付两份**已批准**裁决：[install-datadir-layout]（数据根/布局/config.toml）、[transcript-runtime-and-build-eval]（对话记录抽 runtime + 真 .jsonl 回退 + build-eval skill + 改名）。
> 两份已把所有产品/承重/外部可见行为/边界/安全决策**拍定到零不确定**，故本轮**无待问用户的不可逆决策**。下面记（a）已定死的关键不可逆决策供回溯、（b）交付中可逆默认、（c）实现浮现回填区。

## 不可逆（已在裁决拍定，无需再问）
- [x] 单一数据根 `DICELORE_DATA_DIR`/`--data-dir`，**废** `DICELORE_SESSIONS_DIR`/`DICELORE_CATALOG`；OS app-data 默认。→ install-datadir §1
- [x] on-disk 布局 `$ROOT/{config.toml, catalog.db, keys.db, sessions/<kind>/<id>, logs/}`；会话路径单源 `sessionDir`。→ install-datadir §2
- [x] config.toml 结构化：`[env]` 节赋环境变量（UPPER_SNAKE=env）、其他小节 lower_snake；`applyConfigEnv` 真实 env 优先注入；`KEY_MASTER` 例外只走 env。→ install-datadir §3
- [x] transcript = append-only UUID 树 + `<sessionDir>/HEAD` 指针；`parentUuid=HEAD`；**rewindTo 真移 HEAD**（回退+分叉）。→ transcript §1/§2
- [x] rewind IoC 注册器：rewindTo = hasNode→领域 hook rollbackTo→moveHead（hook 失败不移 HEAD）。→ transcript §2
- [x] dice: snapshot 加 `transcript_anchor` 列，checkpoint 锚 transcript uuid，restoreToAnchor；/rewind 加 toUuid（additive）。→ transcript §3
- [x] lore: LoreSession 穿 sessionId+dataDir → loregm 落 jsonl；lore-draft hook v1 no-op。→ transcript §4
- [x] build-eval skill：真实案例 md 双身份（源+黄金参照），读 jsonl 评构建行为+团本质量，定性报告。→ transcript §5
- [x] `dicelore-eval`→`play-eval`；eval `$`=`.dicelore-eval` 数据根实例 + install.sh/run.sh + 共用前置 skill。→ transcript §6/§7

## 可逆（交付 agent 自决，记默认值供回溯）
- `sessionDir` 助手落点：harness/src/runtime（backend-free，backend 组合根 import）。TR1 定义、DD2 翻转布局。
- config.toml 解析依赖：`smol-toml`（可换等价小库）。
- **路径迁移次序（避免中途不一致）**：TR1 的 `sessionDir` v1 先返回**现布局**（`<dataDir>/<kind>/sessions/<id>`，behavior-equivalent）；DD2 一处翻转为 `$ROOT/sessions/<kind>/<id>`（dice/lore 同随）。故 TR1 合入不改现有落点、DD2 才做 relayout 翻转。
- 各节点内部子步骤排序、纯装配/fs 单测命名：agent 自决。

## 实现中浮现（Workflow 冒泡上来后回填）
- （待波次跑完回填）

## 手动门（非 CI、非 Workflow agent 跑，主 agent 阶段3 记「待手动验证」）
- transcript §5 build-eval **dogfood**（`RUN_LIVE`，烧 LLM）：真起后端+build-mcp，用一个 `docs/research/scraped/*.md` 跑完整构建对话 → jsonl 落盘 → 出 report。
- transcript §7 eval-setup：真跑 `install.sh` + `run.sh -f` 起后端就绪（本地手动）。
- Workflow agent 只跑 typecheck + test + 纯装配/fs 单测；live 部分主 agent 收尾标「待手动验证」。

[install-datadir-layout]: ../../wiki/设计/05-现状与计划/裁决记录/install-datadir-layout.md
[transcript-runtime-and-build-eval]: ../../wiki/设计/05-现状与计划/裁决记录/transcript-runtime-and-build-eval.md

# 决策账本（2026-07-02 扫描 · 里程碑一收尾）

> 本轮交付里程碑一「未裁决」段三份**已批准**裁决：[skill-loading-by-reference]、[build-agent-workspace]、[lore-build-robustness]。
> 三份裁决文件已把所有产品 / 承重 / 外部可见行为 / 边界 / 安全策略决策**拍定到零不确定**，故本轮**无待问用户的不可逆决策**。下面记录（a）裁决已定死的关键不可逆决策供回溯、（b）交付中的可逆默认、（c）实现浮现回填区。

## 不可逆（已在裁决文件拍定，无需再问用户）
- [x] skill 加载改「local plugin 按引用 + `skills` 开关」，退役 `stageSkills`/`cpSync`/`cleanupSkills` + 废弃 `allowedTools:['Skill']`。→ skill-loading §1–§6
- [x] 两侧退役内联教条兜底：教条只经 plugin 加载的 skill 单路径投递，加载失败 **fail loud**（`getLogger().error` + 上抛），不 fallback。→ skill-loading §2；lore-build-robustness 删原 §2
- [x] skill 母本安装期**幂等 + 版本感知物化到数据根** `$/{dice,lore}/skills`，非每回合复制。→ skill-loading §1
- [x] lore 新增 `dicelore-build-core` 开场白/身份 skill（对称 dice `gm-core`），交付时用 `/skill-creator` 撰写。→ skill-loading §1
- [x] 构建 agent 每会话持久工作区 `<sessionsDir>/lore/sessions/<id>/workspace/`；素材经**流式** REST（`application/octet-stream`，上限 `DICELORE_MATERIAL_MAX_MB` 默认 100）落 `materials/`；退役 BM25 检索（删 `build/retrieval/` + 摘 `ingest`/`search`）。→ build-agent-workspace §1/§3/§4
- [x] 格式处理**不做能力提升**（后端不转换、不兜底，不支持格式由作者预处理）。→ build-agent-workspace §6
- [x] lore 构建 **REST-only**，error 属领域级：HTTP 保持 200/202，靠 body `error` 字段标失败（不改 5xx）。→ lore-build-robustness §1
- [x] `GET /catalog/:id/files?ref=head` 在端点层解析 head commitId，不动 core `checkout` 语义。→ lore-build-robustness §3
- [x] Bash 沙箱欠账明确记账、**本轮不做**（本地单用户 eval 接受风险）→ [SEC4]（里程碑四发版前必做）。

## 可逆（交付 agent 自决，记默认值供回溯）
- 物化 helper（`ensureSkillPlugin`）落点：裁决允许「抽 `harness/src/runtime` 共用」或「各 openingPrompt 内联」——**取共用**（两侧对称、去重）。agent 可据实调整。
- `buildBaselinePrompt` 归并方式：裁决允许「删」或「留薄别名一过渡周期」——**取留薄别名**（降低本波删除面，下一周期清）。
- 各节点内部子步骤排序、纯装配/fs 单测命名、清洗脚本示例：agent 自决。

## 实现中浮现（Workflow 冒泡上来后回填）
- （待波次跑完回填）

## 手动门（非 CI、非 Workflow agent 跑，主 agent 阶段3 记为「待手动验证」）
- skill-loading §0 **de-risk smoke**（`RUN_LIVE`，**必过门**）：真 query 加载到 skill、`Skill` 可调、skill 正文 turn 1 到达 GM。
- build-agent-workspace §验收 **端到端 dogfood**（烧 LLM）：真起后端 + build-mcp，`put_material` 传源 → 构建 agent bash 清洗分块建团本 → `get_draft`/`commit`。
- 二者烧真 LLM，Workflow agent 只跑 typecheck + test + 纯装配/fs 单测；live 部分由主 agent 收尾时标注待人工跑。

[skill-loading-by-reference]: ../../wiki/设计/05-现状与计划/裁决记录/skill-loading-by-reference.md
[build-agent-workspace]: ../../wiki/设计/05-现状与计划/裁决记录/build-agent-workspace.md
[lore-build-robustness]: ../../wiki/设计/05-现状与计划/裁决记录/lore-build-robustness.md
[SEC4]: ../../wiki/设计/05-现状与计划/backlog-后端.md

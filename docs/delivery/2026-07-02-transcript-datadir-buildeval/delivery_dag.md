# delivery DAG（2026-07-02 · transcript-runtime + datadir + build-eval）

> 两份已批准裁决炸成 11 个原子需求节点。前缀 **DD**=install-datadir-layout、**TR**=transcript-runtime-and-build-eval。
> `depends_on` = 需求/契约依赖（合进 main 才释放下游）；`owns` = 预期触及文件（非独占，重叠合并时解）。

## 节点表

| id | 需求 | depends_on | owns（预期触及） |
|----|------|-----------|-----------------|
| **TR1** transcript-runtime | `harness/src/runtime/transcript.ts`：纯 `sessionDir(dataDir,kind,id)` 助手（**v1 先返现布局** `<dataDir>/<kind>/sessions/<id>`，DD2 再翻转）+ `SessionTranscript`（UUID 树、`<sessionDir>/HEAD` 指针、turn/msg/turnEnd/error 从 HEAD 分叉、hasNode/moveHead/livePath）；DiceGm 改持 SessionTranscript（kind:dice），删自有 appendConversation/path。jsonl 加 uuid/parentUuid，余行为等价。 | — | harness/src/runtime/transcript.ts(新)、harness/src/dicegm/DiceGm.ts、harness/src/runtime/agent.ts(加 kind?) |
| **DD1** config-resolve | `backend/src/config.ts`：`resolveDataDir`(flag>env>OS默认)/`applyConfigEnv`(读 `[env]` 节补空 process.env、忽略 KEY_MASTER)/`defaultDataDir`(三 OS)。加 `smol-toml`。 | — | backend/src/config.ts(新)、package.json |
| **TR6** rename | `dicelore-eval`→`play-eval`（git mv 目录 + frontmatter + 正文自指 + 5 处引用 grep 全改）。 | — | .claude/skills/play-eval/(mv)、docs 5 处 |
| **TR2** rewind-register | `harness/src/runtime/rewind.ts`：Rewind+RollbackHook；rewindTo=hasNode→hook→moveHead（hook 失败不移 HEAD）；rewindLast。 | TR1 | harness/src/runtime/rewind.ts(新) |
| **DD2** sessionDir-relayout | 把 `sessionDir` 助手翻转为 `$ROOT/sessions/<kind>/<id>`（一处）；backend openSession/listSessions/deleteSession 改用 harness 助手。 | TR1 | harness/src/runtime/transcript.ts、backend/src/(sessionDir 调用点)、backend/src/api/sessions.ts |
| **DD3** server-cli-converge | server.ts/cli.ts：resolveDataDir+applyConfigEnv、子路径派生、删 `DICELORE_SESSIONS_DIR`/`DICELORE_CATALOG` 读取、日志落 `logs/`、`config.example.toml` 铺设。 | DD1, DD2 | backend/src/server.ts、backend/src/cli.ts |
| **TR3** dice-anchor | snapshot 加 `transcript_anchor` 列 + checkpoint `anchorUuid` + `restoreToAnchor` + dice RollbackHook 注册 + `/rewind` `toUuid` + turnEnd 接线。 | TR1, TR2 | backend/src/store/{db,snapshot}.ts、backend/src/sessionBackend.ts、backend/src/index.ts、backend/src/api/dice.ts、backend/src/dicegm/turnEnd |
| **TR4** lore-jsonl | LoreSessionDeps 加 dataDir；handleMessage 穿 sessionId+dataDir+kind:lore → loregm 落 jsonl；lore-draft hook（no-op+warn）注册。 | TR1, TR2 | harness/src/loregm/LoreSession.ts、backend/src/api/lore.ts |
| **DD4** refs-migration | `.mcp.json`/README/CI/eval env `DICELORE_SESSIONS_DIR`→`DICELORE_DATA_DIR`；全仓去旧 env 读取残留。 | DD3 | .mcp.json、README、.github/workflows/ci.yml、docs |
| **TR7** eval-setup | `install.sh`(仓库根)+`harness/eval-setup/run.sh.tmpl`+`.claude/skills/eval-backend-setup/SKILL.md`+`.gitignore`(收 .dicelore-eval)+`.mcp.json`(env)。 | DD3 | install.sh(新)、harness/eval-setup/run.sh.tmpl(新)、.claude/skills/eval-backend-setup/(新)、.gitignore、.mcp.json |
| **TR5** build-eval-skill | `.claude/skills/build-eval/SKILL.md`（真实案例 md 驱动 loregm、读 jsonl 评构建行为+团本质量、定性报告；前置引 eval-backend-setup）。 | TR4, TR7 | .claude/skills/build-eval/(新) |

## 波次

- **Wave 1**（无依赖，foundation）：**TR1**、**DD1**、**TR6**。
- **Wave 2**（依赖 W1）：**TR2**(TR1)、**DD2**(TR1)。
- **Wave 3**（依赖 W2）：**DD3**(DD1,DD2)、**TR3**(TR1,TR2)、**TR4**(TR1,TR2)。
- **Wave 4**（依赖 W3）：**DD4**(DD3)、**TR7**(DD3)、**TR5**(TR4,TR7)。

## 热点文件（集成时主 agent 解重叠）
- `harness/src/runtime/transcript.ts`：TR1 建、DD2 翻转布局（跨波，无并发冲突）。
- `backend/src/server.ts`：DD3 主改（DD2 可能碰 sessionDir 调用；同波集成解）。
- `.mcp.json`：DD4 + TR7 都碰 env（W4 同波，集成时合）。

## 手动门
- build-eval dogfood（RUN_LIVE）+ eval-setup 真跑：Workflow agent 不跑，主 agent 收尾标「待手动验证」。见 decisions-pending.md。

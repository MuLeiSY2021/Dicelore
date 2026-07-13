# Wave 1 复盘（2026-07-02 · transcript-datadir-buildeval）

## 本波节点（3，文件域不重叠、并发）
| 节点 | 分支 | 结果 |
|------|------|------|
| TR1 transcript-runtime | `TR1` (73c0c09) | ✅ 合入 main |
| DD1 config-resolve | `worktree-wf_eca40a56-de2-2` (0a475ef) | ✅ 合入 main |
| TR6 rename dicelore-eval→play-eval | `TR6` (cce5a4d) | ✅ 合入 main |

三节点对抗测试均 pass、无 blockedOnDependency、无冒泡不可逆决策。

## 交付内容
- **TR1**：`harness/src/runtime/transcript.ts`（backend-free `sessionDir(dataDir,kind,id)` 助手【v1=现布局，DD2 后翻转】+ `SessionTranscript`：append-only UUID 树、`<sessionDir>/HEAD` 持久指针、turn/msg/turnEnd/error 从 HEAD 分叉、hasNode/moveHead/livePath、recoverHead 回落末行、fail-soft）+ DiceGm 改造持 SessionTranscript（behavior-equivalent，jsonl 多 uuid/parentUuid）+ AgentInit 加 `kind?` + harness index re-export。14 transcript 测 + harness 198 测绿。
- **DD1**：`backend/src/config.ts`（`defaultDataDir`/`resolveDataDir`/`applyConfigEnv`）+ `smol-toml` 依赖 + 17 测。**本轮只建函数、未在 server.ts 接线**（留 DD3）。
- **TR6**：`git mv` skill 目录 + frontmatter + 5 处引用改 play-eval。刻意不动 `.dicelore-eval` 数据根名、`.mcp.json` server 名。

## 集成要点 / 踩坑
- **smol-toml 装依赖**：DD1 agent 只在自己 worktree `npm install`，合入 main 后主仓缺 `smol-toml` → typecheck/config.test 红。主 agent 集成时 `npm install --legacy-peer-deps` 补装（package-lock 已含，无额外改动）。**教训记账**：加 npm 依赖的节点，主 agent 合并后必须在主仓 install 再验。
- **frontend「8 失败」是假象**：TR6 agent 在仓库根裸跑 vitest 爬到 frontend、`@/` 别名在 workspace 外解析失败所致；按 `npm run -w @dicelore/frontend test` 跑 frontend **全绿（99 测）**。无预存红。
- **WSL2 /proc hang**：TR1 agent 发现 fail-soft 单测用 `/proc/...` 路径会让 `mkdirSync` hang（timeout 124 拖垮整套），改用「路径穿普通文件→ENOTDIR 同步抛」的 fail-fast 写法。

## 集成后全量验证（本地 main）
- `npm run typecheck` ✅ · backend `npm test` 72 文件/561 测 ✅ · harness 198 测 ✅ · frontend 99 测 ✅。

## 放行下游
- TR1 合入 → 解锁 **Wave 2**：TR2(rewind-register, dep TR1)、DD2(sessionDir-relayout, dep TR1)。

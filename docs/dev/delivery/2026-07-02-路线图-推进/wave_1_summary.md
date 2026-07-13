# wave_1 复盘（2026-07-02 · 里程碑一收尾波1）

## 合了哪些
- **N5 `lore-checkout-head`**（lore-build-robustness §3）→ commit `4f45cc4`。`GET /catalog/:id/files?ref=head` 端点层解析 head commitId（ref 省略/=head 时从 catalog list 取 head，不动 core checkout 语义）。对抗测试 **pass**，5 个 ref=head 用例 + 边界全绿。
- **N1 `skill-loading`**（skill-loading-by-reference 全份）→ commit `e2e104f`（含 §0 smoke 改造 + import fix）。dice+lore 改 SDK `plugins`+`skills` 按引用加载，退役 `stageSkills`/`cpSync`/`cleanupSkills` + 去 `allowedTools:['Skill']`；新增 `harness/src/runtime/skillPlugin.ts`（幂等+版本感知+fail-loud 物化到数据根）；两侧退役内联教条兜底；新增 lore `dicelore-build-core` 开场白 skill。

**最终验证（合入 main 后）**：frontend / backend / harness typecheck+test 全绿、0 unhandled。

## 编排如何决断（关键）
1. **cherry-pick 而非 merge**：两 worktree 从 session 起手的 `d290d6a` 切基线，其后用户在 main 上 commit 了 4 个 docs commit（.gitignore/SKILL.md/裁决批准/delivery 工件）。`diff main..branch` 里那些 docs「删除」是**基线落后的假象、非 agent 干的**。故只 cherry-pick agent 的 feat commit（纯代码），不碰用户 docs commit——方向正确、零回退。
2. **N5→N1 顺序合**：N5 先合缩小冲突面。N1 cherry-pick 仅 `lore.test.ts` 一处冲突（`lore.ts` 自动合并）；解冲突以「N1 版为底 + 插入 N5 的 ref=head 独立 describe」，补 import（resolveId/PackFile）。
3. **§0 live smoke 混合决策**：裁决 §0 要求断言「system init skills 清单含 gm-core + Skill 可调 + 教条到达」，但查明 **DiceGm 当前不把 SDK system/init 暴露为 TurnEvent**（既有可观测性缺口、非本波引入）。按可逆性判据先交付无悔的那半：§0 smoke 升为「真传 plugin 物化 + 断言 SDK 接受装配、无加载 error、收于 turn_end」（下限）；「补 system_init TurnEvent 支持完整断言」作承重改动记 backlog follow-up（BE-diceGm-systeminit-event）待裁，不阻塞本波。

## 环境撞到的坑（重大教训，供下轮避雷）
- **环境损坏假象**：交付中途 shell/PTY 层反复降级——stdout 每行重复、WSL `/tmp` 跨 Bash 调用不持久、`git log` 显示滞后 HEAD、甚至出现**幻影 commit**（`8f3f9f8`/`9c0ff88` 显示成功但 `git cat-file` 证实从未存在）。据此一度误判 harness 回归、误以为 N1 已合。**教训**：环境异常期一切 stdout 不可信，用「写项目内文件（非 /tmp）+ Read 工具 + 哨兵标记」重建地面真相；`git reflog@{0}` / 读 `.git/HEAD` / `git cat-file -t <sha>` 比 `git log -1` 显示更权威；最终用 `reset --hard <known-good> + cherry-pick --quit` 从耐久 commit 干净重做，比修补被污染的工作区可靠。
- **worktree npm 依赖**：worktree 从 main 切无 node_modules，`--prefer-offline` 装不全第三方；波2 改用允许联网 install。
- **中文文件名**：`rg`/`grep` 直接传含空格中文路径易报 No such file；用 `git grep`（报 git 跟踪路径）或目录 pathspec 更稳。

## 状态流转
- `skill-loading`：路线图「未裁决」→ **「待测试」**（代码合入、§0 下限 smoke 待 RUN_LIVE 手动跑；完整断言待 system_init follow-up）。裁决文件暂留。
- `lore-checkout-head`：属 lore-build-robustness §3，与波2 §1/§2 一起在最终收尾阶段归档、裁决文件已删。

# Wave 2 复盘（2026-07-02 · transcript-datadir-buildeval）

## 本波节点（2，依赖 TR1，文件域不重叠）
| 节点 | 分支 | 结果 |
|------|------|------|
| TR2 rewind-register | `TR2` (1be080d) | ✅ 合入 main |
| DD2 sessionDir-relayout | `DD2` (35f6548) | ✅ 合入 main |

## 交付内容
- **TR2**：`harness/src/runtime/rewind.ts`——`RewindAnchor`/`RollbackHook`/`Rewind`。`rewindTo(uuid)`=① `hasNode` 不存在则 throw ② 按注册序逐 `hook.rollbackTo({uuid})`（任一抛错则不移 HEAD、原样上抛）③ 全成功后 `transcript.moveHead`。`rewindLast()`=livePath 从尾找最近 `turn_end`（跳过当前 HEAD）回退。backend-free。index.ts re-export。+169 行 rewind.test.ts。
- **DD2**：会话布局 `<dataDir>/<kind>/sessions/<id>` → **`<dataDir>/sessions/<kind>/<id>`**，单源一处翻转（transcript.ts 的 `sessionDir` helper）；backend `session/resolve.ts` 的 `sessionDir(name,kind)` 改为 delegate `harnessSessionDir(appDataRoot(),kind,name)`（backend import harness，单源统一）；server.ts listSessions 路径、DiceGm 注释、resolve.test/transcript.test 同步改新布局。**未碰 DICELORE_DATA_DIR/config 接线**（留 DD3）。

## 会话中断恢复
- 上一 session 进程退出时 wave2 Workflow 被停、无完成记录；但两 implement agent 已把实现提交到分支（TR2/DD2）。主 agent 恢复后**直接进阶段3**（自审 diff + 跑全量测试 + 合并），未重启 Workflow——实现已在、主 agent 本就是质量闸，自跑测试比重放对抗 agent 更硬。

## 集成后全量验证（本地 main）
- `npm run typecheck` ✅ · backend 561 测 ✅ · harness 206 测(+8 rewind, 1 skipped) ✅。

## 放行下游
- DD1+DD2 合入 → 解锁 **DD3**(server-cli-converge)；TR1+TR2 合入 → 解锁 **TR3**(dice-anchor)、**TR4**(lore-jsonl)。→ Wave 3 = {DD3, TR3, TR4}。

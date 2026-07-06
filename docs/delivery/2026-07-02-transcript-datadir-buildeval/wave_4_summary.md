# Wave 4 复盘（末波 · 2026-07-02 · transcript-datadir-buildeval）

## 本波节点（3，依赖 W3，文件域不重叠）
| 节点 | 分支 | 结果 |
|------|------|------|
| DD4 refs-migration | `DD4` | ✅ 合入 main（pass） |
| TR5 build-eval-skill | `worktree-wf_64f1610c-579-3` | ✅ 合入 main（pass） |
| TR7 eval-setup | `TR7` | ⚠️ 对抗测试 **fail** → 主 agent 集成时修 → ✅ 合入 |

## 交付内容
- **DD4**：把所有**外部** `DICELORE_SESSIONS_DIR` 引用迁 `DICELORE_DATA_DIR`——`.mcp.json`（键名，值不变）、README(+zh-CN)、`backend/eval/scenario.ts`、`harness/eval-dicegm/{play-mcp,run-live,play-mcp.test}`、mcp/main.ts + skillPlugin.ts 注释、frontend DataStorage.tsx + 3 处测试断言、wiki 4 页 env 描述。**保留**：DD3 有意的 backend 兜底读取（resolve.ts + 其单测 + diagnostics 兜底）、docs/delivery+裁决历史。`DICELORE_CATALOG` 全仓无外部引用、无需迁。
- **TR5**：`.claude/skills/build-eval/SKILL.md`——真实案例 md 双身份、引 eval-backend-setup 前置、跑一局构建步骤、A/B 两维评估表、报告格式、纪律。
- **TR7**：`install.sh`（仓库根，幂等，铺 $ROOT + 生成 run.sh 烙仓库根 + 铺 config.toml + 加 .gitignore，不拷源码不 npm install）+ `harness/eval-setup/run.sh.tmpl`（DICELORE_DATA_DIR=$PWD 起仓库后端、-f 强杀占端口、轮询 /diagnostics/health 就绪）+ `.claude/skills/eval-backend-setup/SKILL.md` + `.gitignore` 收 .dicelore-eval/。

## TR7 fail → 集成修复（主 agent）
- **对抗测试抓到真 bug**：`install.sh` 追加 `.gitignore` 无换行守卫 + TR7 加的 `.dicelore-eval/` 条目末尾无换行 → `-d <仓库内相对目录>` 时新条目粘到最后一行，(a) 损坏行让 `.dicelore-eval/` 被静默取消忽略（eval 数据误入库风险）、(b) `grep -qxF` 匹配不到损坏行 → 二次跑重复追加、非幂等。默认 `.dicelore-eval`（走 skip 分支）与外部 /tmp（跳过 gitignore）不触发，故字面验收命令没暴露、但 `-d` 是一级 flag。
- **修复**：install.sh 追加前加换行守卫（`[ -n "$(tail -c1 file)" ] && printf '\n'`）+ 补 `.gitignore` 末尾换行。**复现验证**：仓库内 `-d .dl-idem-test` 跑两次 → 计数=1（幂等）、`.dicelore-eval/` 未损坏（计数=1）。

## 集成后全量验证（本地 main）
- `npm run typecheck` ✅ · backend 585 ✅ · harness 213(1 skip) ✅ · frontend 99 ✅ · `bash -n install.sh` ✅ + 幂等复现通过。

## 收尾
- DAG 跑空（11 节点全交付）→ 进「最终收尾阶段」：批量沉 wiki + 关 backlog + 勾路线图 + 全量验证。**两份裁决暂留**（有手动门：build-eval dogfood、eval-setup 真起后端，均烧 LLM/需真环境，手动门过前不删裁决、路线图标「待测试」）。

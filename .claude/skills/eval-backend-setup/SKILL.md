---
name: eval-backend-setup
description: eval 前把测试后端跑起来的前置教条。任何要跑 play-eval / build-eval(连真后端当玩家驱动 GM 跑团本 / 跑 lore 构建)前，先用本 skill 在隔离数据根 .dicelore-eval 里铺并起后端、确认就绪。触发词：跑 eval 前起后端、准备测试后端、后端起来没、eval 环境没就绪、play-mcp/build-mcp 连不上后端。哪怕用户只说"先把后端跑起来再 eval"也用它。
---

# eval 后端前置（起隔离测试后端）

> 本 skill 只定「eval 前怎么把测试后端跑起来」。**怎么 eval GM 表现** → `play-eval`；怎么跑 lore 构建 eval → `build-eval`。起后端是它们的前置，别把 eval 逻辑写这里。

## 为什么要隔离数据根

eval 会真写 catalog.db / session 记录 / 日志。直接跑会污染开发数据。所以 eval 用一个**独立数据根实例** `.dicelore-eval`（数据根 = 该目录本身），与日常开发数据物理隔离。启动器**不拷源码、不 npm install**——直接复用仓库 `node_modules` 起后端。

## 教条（照做，四步）

在**仓库根**执行：

```bash
# 1. 铺数据根实例(幂等,重复跑不炸、不覆盖已有 config.toml)。默认目录 .dicelore-eval。
bash install.sh
#   自定义目录: bash install.sh -d <安装目录>

# 2. 进数据根。
cd .dicelore-eval

# 3. 起后端(-f 先强杀占端口进程再起)。脚本会轮询 /diagnostics/health 到 200 才返回。
bash run.sh -f
#   自定义端口: bash run.sh -f -p 8788

# 4. 看到 “后端就绪 ✓ … → 200” 即可。此时再去跑 play-eval / build-eval。
```

`run.sh` 起后端后**后台常驻**、就绪即返回控制权；再跑 `play-eval` / `build-eval`。

## 关键约定

- **`.dicelore-eval` = 默认数据根 `$ROOT`**（`install.sh -d` 可改）。已收进仓库 `.gitignore`，不入库。
- **数据根派生**：`catalog.db` / `keys.db` / `logs/` / `sessions/` 全落 `$ROOT` 下。
- **对话记录落点**：`$ROOT/sessions/<kind>/<id>/<id>_session.jsonl`（`<kind>` = `dice` 玩本 / `lore` 构建）。
- **端口**：默认 8787；`run.sh -p <port>` 或 `config.toml` 的 `[env] PORT` 可改。
- **就绪判据**：`GET /diagnostics/health` 返回 200。
- **MCP 指同一 `$ROOT`**：`.mcp.json` 里的 play/build MCP 经 `DICELORE_DATA_DIR` 指向同一数据根，与 `run.sh` 起的后端读写同一实例——否则玩家(MCP)与后端各写一份、对不上。
- **`config.toml`**：`install.sh` 铺一份最小 `[env]`（预置 `DICELORE_FAKE_GM="0"` 等）；后端首次启动还会铺带全量注释的 `config.example.toml` 供参照补键。想跑桩 GM（不烧 LLM）就把 `DICELORE_FAKE_GM` 置 `"1"`。

## 常见卡点

- **端口被占**：`bash run.sh -f` 会 `lsof -ti:<port> | xargs -r kill` 强抢端口再起。
- **就绪超时 / 进程提前退出**：`run.sh` 会打印 `$ROOT/logs/server.out` 尾部日志，据此排查。
- **改了 `run.sh.tmpl`**：`$ROOT/run.sh` 是生成物，别手改；改模板 `harness/eval-setup/run.sh.tmpl` 后重跑 `bash install.sh` 重铺。

# 裁决：install-datadir-layout —— 单一数据根 + on-disk 布局规范（程序↔数据分处）

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑三 · [REL-datadir](../backlog-后端.md#主题--发版形态--安装数据目录布局-)（「可安装可用验证」前置）。
> 来源：用户 2026-07-02——「跨 Win/Mac/Linux(server) 三类用户如何装/跑；跑一段时间后安装目录应长什么样；程序与运行态数据要分处；安装目录里有数据时的形态该怎样」。三处分叉已拍：**sessions/{dice,lore}/<id>** + **废旧 env、只认 `DICELORE_DATA_DIR`** + **引 config.toml**。
> 依赖：无前置。是 [transcript-runtime-and-build-eval](transcript-runtime-and-build-eval.md)（其 §1/§3/§4 会话路径 + §7 eval `$` 形态）与未来发版打包的**前置**——本裁决定死数据根形态后，那份的 §7 从此派生。
> 发版**分发形态**已裁决在 [玩家客户端 D1/D4](../../04-子系统设计/玩家客户端.md)（双分发壳 / 多端整合包 / 自托管 docker-compose / key 后端托管 SEC2）——本裁决**不重议分发形态**，只补它未落的「数据根 on-disk 布局」这层。

---

## 背景与目标（为什么）

现状 `backend/server.ts` 里 `dir = DICELORE_SESSIONS_DIR ?? "."` **已半是数据根**，但没被规整：
- sessions 落 `$dir/<kind>/sessions/<id>`（核心 `sessionDir(id,kind)` 写死此形），
- catalog 落 `$dir/catalog.db`（`DICELORE_CATALOG` 可覆盖），keys 落 `$dir/keys.db`，全局日志**平摊** `$dir/{error,info,warn,debug}.log`，
- 配置全走散落 env（`DICELORE_FAKE_GM`/`DICELORE_BASELINE`/`DICELORE_DEBUG`/`DICELORE_BUILD_PROMPT`/`PORT`…），无配置文件。

问题：① 程序（源码/壳/镜像）与运行态数据未明确分处；② 数据根下 `catalog.db`、`<kind>/`、`keys.db`、`*.log` 混摊、无「一眼看得懂」的结构；③ 无跨 OS 的默认数据根约定（desktop/server/dev 各自落哪没定）；④ 配置散在 env、不可整体备份/迁移。

目标：**立一个单一数据根 + 清爽 on-disk 布局**，让「装完 / 玩久了目录长什么样」有唯一答案，可整体备份/迁移/重装不丢档。核心原则：**代码不可变、可整体替换；数据累积、长期留；两者分处两地。**

**非目标**：不做发版打包本身（Tauri 壳 / Docker 镜像 / 整合包，属里程碑三后续）；不改 catalog/keys 的内部 schema；不做数据迁移工具（预发布无存量用户，旧 dev 目录可弃）。

---

## §1 数据根解析（`DICELORE_DATA_DIR` + `--data-dir`，废旧路径 env）

**决策（拍定）：**
- **单一数据根来源，解析优先级**：`--data-dir <path>` CLI flag > `DICELORE_DATA_DIR` env > **OS app-data 默认**。解析出的绝对路径记作 `$ROOT`。
- **废旧路径 env**：`server.ts` **不再读** `DICELORE_SESSIONS_DIR`、`DICELORE_CATALOG`。所有子路径一律由 `$ROOT` 派生（§2）。（功能 env 如 `DICELORE_FAKE_GM` 等的去留见 §3。）
- **OS app-data 默认**（`$ROOT` 未显式给时，desktop 形态用）：
  - macOS：`~/Library/Application Support/Dicelore`
  - Windows：`%APPDATA%\Dicelore`（回落 `~/AppData/Roaming/Dicelore`）
  - Linux：`${XDG_DATA_HOME:-~/.local/share}/dicelore`
  - 用一个纯函数 `defaultDataDir(): string`（按 `process.platform` + env 分支）实现，可单测。
- **三发版形态各自 `$ROOT`**：
  - **desktop（Tauri 个人）**：不传 flag/env → 走 OS app-data 默认。
  - **server（自托管）**：显式 `--data-dir /var/lib/dicelore`（或 Docker 挂 `/data` + `--data-dir /data`）。**server 不依赖 OS 默认**（部署方显式给）。
  - **dev / eval**：仓库内 `.dicelore-eval`（经 `--data-dir .dicelore-eval` 或 `DICELORE_DATA_DIR`）。即 [transcript-runtime-and-build-eval §7](transcript-runtime-and-build-eval.md) 的 `$`。
- `$ROOT` 不存在则建（`mkdirSync recursive`），幂等。

---

## §2 on-disk 布局（`$ROOT` 下的清爽结构）

**决策（拍定）：**
```
$ROOT/                       # 数据根（程序不在此；程序=源码/壳/镜像，另处）
  config.toml                # 配置（§3）
  catalog.db                 # 团本库（lore 构建产出→dice import，共用）
  keys.db                    # SEC2 key 托管（master 仍只在 env，不落此库）
  sessions/                  # 所有会话数据，一个干净子树
    dice/<id>/{session.db, <id>_session.jsonl, snapshots(表在 session.db), *.log}
    lore/<id>/{<id>_session.jsonl, workspace/materials/…}
  logs/                      # 全局(非会话)系统日志
    {error,info,warn,debug}.log
```
- **sessions 结构改为 `$ROOT/sessions/<kind>/<id>`**（现状是 `$ROOT/<kind>/sessions/<id>`）：核心 `sessionDir(id,kind)`（`@dicelore/backend`）是这条路径的**单一来源**，改它一处即全随动（`openSession`/`listSessionSummaries`/`deleteSession`/build-eval transcript.ts 都经它）。
- **catalog.db / keys.db 归位 `$ROOT` 根**（现已在，去掉 `DICELORE_CATALOG` 覆盖后固定派生）。
- **全局日志从平摊 `$ROOT/*.log` 收进 `$ROOT/logs/`**：`initGlobalLogger` 落点改 `join($ROOT,"logs")`。
- **备份/迁移语义**：整个 `$ROOT` 拷走即完整备份；删 `$ROOT/sessions` 即清所有存档而保留团本库；重装只换程序、`$ROOT` 不动 → 不丢档。

---

## §3 config.toml（配置文件 + 优先级；秘密仍走 env）

**决策（拍定）：**
- **位置**：`$ROOT/config.toml`。缺失 = 全用内置默认（不报错）。
- **格式 / 解析**：TOML，加轻量解析依赖（`smol-toml`，零依赖小库；实现可换等价库，属可逆）。解析失败 fail loud（`getLogger().error` + 上抛，不静默用默认）。
- **优先级（高→低）**：CLI flag > 环境变量 > `config.toml` > 内置默认。同一项多处给，高者胜。
- **v1 config.toml 覆盖的键**（操作性配置，皆有内置默认）：
  ```toml
  port = 8787            # 内置默认 8787（env PORT / --port 覆盖）
  gm_model = "glm-5.2"   # env DICELORE_GM_MODEL / --model 覆盖
  fake_gm = false        # 开发用；env DICELORE_FAKE_GM=1 覆盖
  baseline = false       # eval 消融；env DICELORE_BASELINE=1 覆盖
  debug = false          # env DICELORE_DEBUG=1 覆盖
  [ratelimit]
  window_ms = 60000
  max = 120              # env DICELORE_RATELIMIT_* 覆盖
  ```
- **秘密绝不进 config.toml**：`DICELORE_KEY_MASTER`（SEC2 主密钥）**只经 env**（沿用现状：master 不落任何文件/库）。`DICELORE_BUILD_PROMPT`（构建教条，大文本）也留 env/文件路径、不塞 config.toml。
- `data_dir` **不在** config.toml 里（鸡生蛋：要先有数据根才能找到 config.toml）——数据根只来自 §1 的 flag/env/OS 默认。

---

## §4 组合根收敛（`server.ts` / `cli.ts` 读单一数据根派生一切）

**决策（拍定）：**
- 抽一个 `resolveDataDir(argv, env): string`（§1 优先级 + OS 默认）+ `loadConfig($ROOT): Config`（§3 读 toml + 合并优先级）两个纯函数（可单测）。
- `server.ts` 改为：`const $ROOT = resolveDataDir(...)` → `const cfg = loadConfig($ROOT)` → 各子路径 `join($ROOT, "catalog.db"/"keys.db"/"sessions"/"logs")` 派生；`fake/baseline/debug/port/model/ratelimit` 从 `cfg`（已合并 env/flag）取。**删除** `DICELORE_SESSIONS_DIR`/`DICELORE_CATALOG` 读取。
- `cli.ts` 支持 `--data-dir`/`--port`/`--model` flag（转成同一 `resolveDataDir`/`loadConfig` 路径），与 `server.ts` 共用解析。
- `initGlobalLogger(join($ROOT,"logs"))`（须在一切 IO 前，落点改子目录）。

---

## §5 迁移与影响面（废旧 env 的连带改动）

**决策（拍定）——废 `DICELORE_SESSIONS_DIR`/`DICELORE_CATALOG` 后须同步改全，否则跑不起来：**
- **核心路径单源** `sessionDir(id,kind)`（`@dicelore/backend`）：`$ROOT/<kind>/sessions/<id>` → `$ROOT/sessions/<kind>/<id>`。`listSessionSummaries` 传参、`deleteSession` 随动。
- **`.mcp.json`**：`dicelore-play`/`dicelore-build` 的 env `DICELORE_SESSIONS_DIR` → `DICELORE_DATA_DIR`（指向同一 `$ROOT`；eval harness 读 session jsonl 也走 `$ROOT/sessions/<kind>/<id>`）。
- **eval 种子** `backend/eval` 的 `prepareSessionDb`（灌种子到 `sessionDir` 路径）随核心单源自动跟随；核对其调用未硬编码旧路径。
- **现有启动脚本 / 文档 / 测试**：凡设 `DICELORE_SESSIONS_DIR` 处改 `DICELORE_DATA_DIR`（含 `dicelore-eval`/`play-eval`/`build-eval` skill 前置说明、README、CI）。
- **存量 dev 会话目录**（`.`-根平摊的 `dice/`/`lore/`/`catalog.db`）：预发布无用户，**弃之不迁**（不写迁移工具）。
- **跨裁决联动**：[transcript-runtime-and-build-eval](transcript-runtime-and-build-eval.md) §1 transcript.ts **改用**（而非重造）核心 `sessionDir(id,kind)` 得路径；§3/§4 的 jsonl 落点表述随 §2 更新为 `$ROOT/sessions/<kind>/<id>/<id>_session.jsonl`；§7 eval `$` = 本裁决的一个 `$ROOT` 实例（含 config.toml/catalog.db/keys.db/sessions/logs）。

---

## 验收

- `resolveDataDir` 单测：flag > env > OS 默认三优先级；三 `process.platform` 分支路径正确（mock platform/env）。
- `loadConfig` 单测：无 config.toml 用默认；有则覆盖；env/flag 再覆盖 toml（优先级）；toml 解析失败 fail loud。
- 布局单测/集成：起后端后 `$ROOT` 下出现 `sessions/{dice,lore}`、`catalog.db`、`keys.db`、`logs/`；跑一局 dice → `$ROOT/sessions/dice/<id>/session.db` 存在；旧路径 `$ROOT/dice/sessions/<id>` **不再产生**。
- `grep DICELORE_SESSIONS_DIR / DICELORE_CATALOG` 全仓无残留读取（.mcp.json/docs/scripts/tests 全切 DATA_DIR）。
- `typecheck:all` + `test:all` 绿；`--no-pager`；不 push。
- **手动门**：真起后端指 `--data-dir .dicelore-eval`，确认 config.toml 生效、数据落 `$ROOT` 各子目录、备份=拷 `$ROOT`。

---

## owns（预期触及，非独占）

- `backend/src/server.ts`、`backend/src/cli.ts`（收敛读数据根 + config）。
- `@dicelore/backend` 的 `sessionDir`/`openSession` 路径单源（`$ROOT/sessions/<kind>/<id>`）。
- 新增 `backend/src/config.ts`（`resolveDataDir`/`loadConfig`/`defaultDataDir` 纯函数）+ 其 test。
- `backend/src/api/sessions.ts`（listSessionSummaries 传参）。
- `.mcp.json`、README、CI、eval skill 前置说明（env 名切换）。
- `package.json`（加 `smol-toml`）。

---

## DAG 分解提示（进波炸成原子需求节点）

- **N1 config-resolve**：`config.ts`（resolveDataDir/loadConfig/defaultDataDir）+ test。无依赖。
- **N2 sessionDir-relayout**：核心 `sessionDir` 改 `sessions/<kind>/<id>` + 随动调用点。无依赖（但与 N3 同改 server.ts，集成时解重叠）。
- **N3 server-cli-converge**：server.ts/cli.ts 收敛读 `$ROOT`+config、删旧 env、日志落 `logs/`。依赖 N1、N2。
- **N4 refs-migration**：.mcp.json/README/CI/eval skill 前置 env 名切换 + 全仓去旧 env 读取。依赖 N3。

---

## 完成后（最终收尾沉淀）

- 沉进 [玩家客户端 决策节](../../04-子系统设计/玩家客户端.md)（新增决策：单一数据根 + on-disk 布局 + config.toml + 程序↔数据分处；接 D1/D4 分发形态之后）+ `设计/决策变更日志.md`。
- 关 [REL-datadir](../backlog-后端.md) 条目；路线图里程碑三该项「未裁决」→（批准后）「未完成」。
- 删本裁决文件。
- 解锁 [transcript-runtime-and-build-eval](transcript-runtime-and-build-eval.md) §7（eval `$` 派生）+ 更新其 §1/§3/§4 路径表述。
</content>

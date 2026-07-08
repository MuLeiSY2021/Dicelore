# 裁决：custom-mcp-install —— 额外 MCP 客制化安装（npm install + config.json）

- [ ] 用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT8（额外 MCP 含搜索未接运行时）。规约§6 MCP 子页原标「自定义 out-of-canon MCP v1-deferred」。
> 用户 2026-07-08 定调：「只留客制化接口：用户输入 `npm install xxxx@xxxx`，然后在 mcp 里提供配置项 table（收敛到 config.json），其实是环境变量」。即不预置额外 MCP（含搜索），只留客制化安装通道。

---

## 一、定调

- **不预置**任何额外 MCP（含搜索）。搜索等能力由用户自行装 MCP 包。
- 只留**客制化接口**：用户 `npm install <pkg>@<version>` 装 MCP 包 + 配置页填配置项 table → 收敛到 `config.json` → 运行时启动注入。

## 二、安装流程

1. 用户在终端 `npm install <pkg>@<version>`（如 `npm install @bocha/mcp-search@1.2.0`）。
2. 配置页 MCP 子页点「新增 MCP」→ 填：
   - `instanceName`（实例名·用户起·唯一）
   - `package`（`<pkg>@<version>`·登记用·便于溯源）
   - `command` / `args`（启动命令·默认 `npx`/`node`，可改）【拟·待确认 C3：是否需要用户填 command/args，还是按包约定自动推导】
   - 配置项 table（一组 `{key, value}`·见§三）
3. 保存 → 写入 `config.json`（§四）。
4. 运行时（GM/loregm 启动时）读 `config.json`、按 stdio 启动客制 MCP、注册其工具到运行时工具表。

> 【拟·待确认 C1：后端代装 vs 用户手装？】用户原话「用户输入 npm install xxxx@xxxx」倾向**用户手动装**，配置页只登记包名+配置项；后端不代执行 npm install（避免后端进程权限/网络副作用）。推荐用户手装。

## 三、配置项 table（本质是环境变量）

- 每个客制 MCP 有一组配置项（env vars），配置页以 **table** 形式增删改（`{key, value}` 行）。
- 收敛到 `config.json` 的 `env` 字段；运行时启动 MCP 时作为环境变量注入。
- 配置项 schema 来源【拟·待确认 C3】：① 用户手填 env key/value（最简·通用）；② 包自描述（读包的 manifest 暴露所需 env·需约定协议）。推荐① 手填（v1 通用、零协议约定）。

## 四、config.json 结构【拟·待确认 C2 位置】

```jsonc
{
  "mcpServers": {
    "<instanceName>": {
      "package": "<pkg>@<version>",      // 登记溯源
      "command": "npx",                   // 或 "node"
      "args": ["-y", "<pkg>@<version>"],
      "env": { "KEY1": "value1", ... },   // 配置项 table 收敛至此
      "enabled": true,
      "outOfCanon": true                  // 徽·非核心 dicelore MCP
    }
  }
}
```

- 位置【拟】：`<DICELORE_DATA_DIR>/config.json` 或独立 `<dataDir>/mcp-config.json`。推荐独立 `mcp-config.json`（与每局一文件的会话数据分离）。
- 核心 `dicelore` MCP（stdio·运行时·必需·锁定）**不进此文件**（它由系统固定注入），此文件只管客制 MCP。

## 五、与规约§6 MCP 子页对齐

规约§6 MCP 子页已列「自定义 out-of-canon MCP（增删改 / 开关 / 权限闸 / out-of-canon 徽 / 联网警示 / 连接测试）」——本裁决补：
- **安装来源** = 用户 `npm install` + 配置页登记（不预置）；
- **配置载体** = `config.json` 的 `env`（配置项 table 收敛）；
- 原「v1-deferred」标记移除，改为 v1 客制化。

## 六、运行时接入

- GM/loregm 运行时启动时读 `mcp-config.json`，逐个按 stdio 启动 `enabled=true` 的客制 MCP，注册其工具。
- 工具表合并：核心 `dicelore` MCP 工具 + 客制 MCP 工具（客制工具标 `outOfCanon` 徽）。
- `mcp-test` 连接测试（规约§6 已有）覆盖客制 MCP：stdio 命令可起 + 工具能 list。

---

## 待用户确认清单

| # | 项 | 推荐值 | 你的定调 |
|---|----|--------|----------|
| C1 | 安装：后端代 npm install vs 用户手装 + 配置页登记 | 用户手装（后端不代执行） | |
| C2 | config.json 位置 | 独立 `<dataDir>/mcp-config.json` | |
| C3 | 配置项来源：用户手填 env key vs 包自描述 | 用户手填（v1 通用） | |

---

## 验收

- 配置页「新增 MCP」填 instanceName/package/配置项 table → 保存 → `mcp-config.json` 含该条（env 收敛正确）。
- 运行时启动 → GM 工具表含客制 MCP 工具（标 outOfCanon 徽）。
- `POST /diagnostics/mcp-test` 对该客制 MCP → 可达 + 工具 list。
- 开关 `enabled=false` → 运行时不启动、工具表不含。
- 期望首跑见红（现未接运行时 = 红）。

## owns（预期触及，非独占）

- backend：MCP 配置加载（`mcp-config.json`）、运行时启动客制 MCP、工具表合并、mcp-test 覆盖客制。
- 前端：配置页 MCP 子页（新增/编辑 MCP 表单 + 配置项 table + 开关 + out-of-canon 徽 + 连接测试）。
- `mcp-config.json` schema（新增·shared 或 config 模块）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md) §9.4 + [玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md) §6（MCP 子页客制化流程）+ 关 backlog RT8 + 勾路线图；删本裁决文件。

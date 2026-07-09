# 裁决：custom-mcp-install —— 额外 MCP 客制化安装（marketplace + 安装两按钮 / npx -y 预拉 / config.toml）

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 来源：acceptance-loop 第 1 轮 RT8（额外 MCP 含搜索未接运行时）。规约§6 MCP 子页原标「自定义 out-of-canon MCP v1-deferred」。
> 用户 2026-07-08 定调：「只留客制化接口：用户输入 `npm install xxxx@xxxx`，然后在 mcp 里提供配置项 table（收敛到 config.json），其实是环境变量」。即不预置额外 MCP（含搜索），只留客制化安装通道。
> 用户 2026-07-09 演化定调：参考 Claude Code 的 `claude plugin marketplace add <owner/repo>` 体验，配置页提供**两个按钮**——「添加 marketplace」+「安装」，都是输入框 + 点击执行，在配置页直接完成装 MCP。安装由**后端触发 `npx -y` 预拉**（非手动 `npm install`、非运行时隐式拉）。配置落 `<dataDir>/config.toml`。配置项 env key/value 用户手填。

---

## 一、定调

- **不预置**任何额外 MCP（含搜索）。搜索等能力由用户自行装 MCP 包。
- **后端不代执行持久化 `npm install`**（不往项目内装依赖）；但**后端代执行 `npx -y` 预拉**（触发首次下载到 npx 缓存）与 **git clone marketplace 清单**——这两者都是拉取动作，用户认可。
- 配置页提供**两个按钮**（均为输入框 + 点击执行）：
  1. **添加 marketplace**：输入 marketplace 源（GitHub `owner/repo` / git URL / `marketplace.json` URL）→ 后端拉清单 → 注册源 → 配置页展示该源下可用 MCP 列表。
  2. **安装**：输入框接受 `<mcp>@<marketplace>`（从已添加 marketplace 装，MCP 描述来自清单）**或** `<pkg>@<version>`（直装 npm 包，用户手填 command/args/env）→ 后端 `npx -y` 预拉 + 写 `config.toml`。
- 安装产物落 npx 缓存（`npx -y` 首次下载并缓存），运行时按 stdio 拉起子进程命中缓存。配置落 `<dataDir>/config.toml` 的 `[mcpServers.<name>]` 节。

## 二、两按钮流程（已定调 C1）

### 按钮①：添加 marketplace

1. 用户点「添加 marketplace」→ 输入框填源：GitHub slug（`owner/repo`，可带 `@ref`）/ git URL / `marketplace.json` 远端 URL。
2. 后端 `git clone`（或 fetch URL）拉取清单文件 `marketplace.json`（§三格式）→ 解析 → 注册到 `config.toml` 的 `[marketplaces.<name>]` 节。
3. 配置页展示该 marketplace 下可用 MCP 列表（name / description / package / 所需 env），供按钮②选装。

### 按钮②：安装

1. 用户点「安装」→ 输入框填：
   - `<mcp>@<marketplace>`：从已添加 marketplace 装。MCP 的 `command`/`args`/`envSchema` 来自清单，用户只需按 `envSchema` 填 env value（配置项 table）。
   - 或 `<pkg>@<version>`：直装 npm 包（不经 marketplace）。用户手填 `command`/`args`（默认推导 `npx -y <pkg>@<version>`）+ 配置项 table（§四）。
2. 后端执行 `npx -y <pkg>@<version>` 一次**预拉**（触发首次下载到 npx 缓存；超时/失败回错给前端）。
3. 预拉成功 → 写 `config.toml` 的 `[mcpServers.<instanceName>]` 节（含 `installed=true`）。
4. 运行时（GM/loregm 启动）读 `config.toml`、对 `enabled=true` 的客制 MCP 按 stdio 拉起子进程，命中 npx 缓存，注册其工具。

> C1 已定调：**两按钮（添加 marketplace + 安装）/ 后端 `npx -y` 预拉**（非手动 `npm install`、非运行时隐式拉）。依据见§七调研。

## 三、marketplace 清单格式（v1 轻量自定）

dicelore 只关心 MCP，不需要 Claude Code plugin 的 skills/agents/hooks/commands。v1 用轻量自定清单（后续可考虑兼容 Claude Code `marketplace.json` 子集）。仓库根 `.dicelore/marketplace.json`：

```jsonc
{
  "name": "acme-mcp-market",                 // marketplace 标识（kebab-case）
  "owner": { "name": "Acme" },
  "mcps": [
    {
      "name": "bocha-search",                // MCP 标识（用户装时引用）
      "package": "@bocha/mcp-search@1.2.0",  // 登记溯源
      "command": "npx",                       // 默认 npx；可 uvx / node / 绝对路径
      "args": ["-y", "@bocha/mcp-search@1.2.0"],
      "description": "博查搜索 MCP",
      "envSchema": [                          // 配置项 table 的 schema（C3 用户手填 value）
        { "key": "BOCHA_API_KEY", "required": true, "description": "API 密钥" }
      ]
    }
  ]
}
```

- 后端拉清单后只读 `name`/`package`/`command`/`args`/`description`/`envSchema`。
- `envSchema` 驱动配置页配置项 table（预填 key、标 required、给 description），用户填 value（C3）。

## 四、配置项 table（本质是环境变量·已定调 C3）

- 每个客制 MCP 有一组配置项（env vars），配置页以 **table** 形式增删改（`{key, value}` 行）。
- **来源＝用户手填** value（key 来自 marketplace `envSchema` 或直装时用户手填 key+value）。
- 收敛到 `config.toml` 的 `[mcpServers.<name>.env]` 子表；运行时启动 MCP 时作为环境变量注入。

> C3 已定调：用户手填 env value（key 来自清单 schema 或手填）。

## 五、config.toml 结构（已定调 C2）

位置：`<DICELORE_DATA_DIR>/config.toml`（与现有 eval 数据根 `config.toml` 同文件·新增 `[marketplaces.*]` 与 `[mcpServers.*]` 节，与既有 `[env]` 节并列·单源单文件）。

```toml
# 既有节（eval 数据根 env 配置，不动）
[env]
DICELORE_FAKE_GM = "1"

# —— marketplace 源（按钮①注册）——
[marketplaces."acme-mcp-market"]
source = "github"            # 或 "url" / "marketplace-url"
repo   = "acme-corp/mcp-market"
ref    = "v2.0"              # 可选

# —— 客制 MCP（按钮②安装后落此）——
[mcpServers.bocha]
package        = "@bocha/mcp-search@1.2.0"   # 登记溯源
command        = "npx"                         # 或 uvx / node / 绝对路径
args           = ["-y", "@bocha/mcp-search@1.2.0"]
fromMarketplace = "acme-mcp-market"            # 可选·溯源（直装时缺）
installed      = true                          # npx -y 预拉已执行
enabled        = true                          # 开关
outOfCanon     = true                          # 徽·非核心 dicelore MCP

[mcpServers.bocha.env]                          # 配置项 table 收敛至此
BOCHA_API_KEY = "value1"

[mcpServers."local-py-mcp"]                     # 直装 npm 包示例（无 fromMarketplace）
package    = "some-py-mcp@0.4.0"
command    = "uvx"
args       = ["some-py-mcp@0.4.0"]
installed  = true
enabled    = false
outOfCanon = true

[mcpServers."local-py-mcp".env]
TOKEN = "value2"
```

- 核心 `dicelore` MCP（stdio·运行时·必需·锁定）**不进此文件**（系统固定注入），此文件只管客制 MCP + marketplace 源。
- 敏感 env（API key/token）：与既有 `[env]` 同原则——可登记，但高敏键建议走真实进程 env 注入；敏感到何种程度走 env vs 落盘，实现时细扣。

> C2 已定调：`<dataDir>/config.toml`（toml 格式·与既有数据根配置同文件）。

## 六、与规约§6 MCP 子页对齐

规约§6 MCP 子页已列「自定义 out-of-canon MCP（增删改 / 开关 / 权限闸 / out-of-canon 徽 / 联网警示 / 连接测试）」——本裁决补：

- **安装来源** = 两按钮：添加 marketplace（Git 源拉清单）+ 安装（marketplace 选装 或 直装 npm 包，后端 `npx -y` 预拉）；
- **配置载体** = `config.toml` 的 `[mcpServers.<name>.env]`（配置项 table 收敛）+ `[marketplaces.<name>]`（源注册）；
- 原「v1-deferred」标记移除，改为 v1 客制化。

## 七、运行时接入

- GM/loregm 运行时启动时读 `config.toml` 的 `[mcpServers.*]`，逐个按 stdio 启动 `enabled=true` 且 `installed=true` 的客制 MCP（`npx -y`/`uvx` 命中缓存），注册其工具。
- 工具表合并：核心 `dicelore` MCP 工具 + 客制 MCP 工具（客制工具标 `outOfCanon` 徽）。
- `mcp-test` 连接测试（规约§6 已有）覆盖客制 MCP：stdio 命令可起 + 工具能 list。

---

## 八、主流 agent 应用 MCP 安装机制调研（C1 依据）

> 英文源，via jina（Claude Code MCP 文档 + Claude Code plugin marketplace 文档 + MCP 官方 transports 规范）。

### 8.1 MCP server 的「安装」真相：client 只配置 + 拉子进程，`npx -y` 自动拉

- **Claude Code / Cursor / Claude Desktop** 都不"代执行 `npm install`"、不预置。配置文件（`.mcp.json` / `~/.claude.json` / `~/.cursor/mcp.json` / `claude_desktop_config.json`）登记一条 `{command, args, env}`；运行时 client 按 **stdio transport** 把 server 作为**子进程**拉起（MCP 规范：client launches server as subprocess，server 读 stdin / 写 stdout 的 JSON-RPC）。
- stdio server 标准写法：`command="npx"`、`args=["-y","<pkg>"]`（Node）或 `command="uvx"`（Python）。`npx -y` 语义＝首次运行从 npm registry 下载到 npx 缓存并执行，之后命中缓存——**这就是"自动安装"，全程无显式 `npm install`**。
- dicelore 后端＝MCP client，客制 MCP＝stdio subprocess。本裁决的「后端 `npx -y` 预拉」＝把运行时的首次下载提前到点安装按钮时执行，体验更即时、失败可早暴露。

### 8.2 Claude Code 的 marketplace 模型（两按钮的来源）

- **marketplace** = 一个 Git 仓库（GitHub `owner/repo` / git URL / `marketplace.json` URL / 本地路径），根 `.claude-plugin/marketplace.json` 是清单，列出 plugins（每个有 `name` + `source` + 可带 `mcpServers`）。
- **`claude plugin marketplace add <source>`**：clone/拉清单 → 注册源。
- **`claude plugin install <plugin>@<marketplace>`**：从已添加 marketplace 拉 plugin。plugin `source` 之一是 `npm`（`{source:"npm", package, version?, registry?}`，走 `npm install`）；plugin 装好后其 `mcpServers` 配置自动起 stdio 子进程。
- dicelore **不复用 full plugin 系统**（只要 MCP），v1 用§三轻量自定清单格式（`.dicelore/marketplace.json` 的 `mcps[]`），只取 `name`/`package`/`command`/`args`/`envSchema`。后续版本可考虑兼容 Claude Code `marketplace.json` 子集以互操作。

**对 dicelore 的映射**：两按钮（添加 marketplace + 安装）直接复刻 Claude Code 的 `marketplace add` + `plugin install` 体验；安装执行用 `npx -y` 预拉（8.1 的自动装逻辑提前到安装时）；配置落 `config.toml`。

**Sources:**

- [Connect Claude Code to tools via MCP — Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Create and distribute a plugin marketplace — Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [Transports — Model Context Protocol](https://modelcontextprotocol.io/docs/concepts/transports)

---

## 待用户确认清单（三项已定调·2026-07-09）


| #  | 项                                       | 推荐值（原）                    | 你的定调（已填）                                                                      | 落地                                                                                                             |
| -- | ---------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| C1 | 安装方式                                 | 用户手装（后端不代执行）        | 参考主流 agent 自动装 MCP 逻辑；演化为两按钮（添加 marketplace + 安装），配置页直接装 | 两按钮：添加 marketplace（Git 源拉清单）+ 安装（marketplace 选装 / 直装 npm 包，后端`npx -y` 预拉）（§二/§八） |
| C2 | config 文件位置与格式                    | 独立`<dataDir>/mcp-config.json` | `<dataDir>/config.toml`                                                               | 并入既有`<dataDir>/config.toml` 的 `[marketplaces.*]` + `[mcpServers.*]` 节（§五）                              |
| C3 | 配置项来源：用户手填 env key vs 包自描述 | 用户手填（v1 通用）             | 用户手填                                                                              | 用户手填 env value（key 来自清单`envSchema` 或手填）（§四）                                                     |

> 三项定调已并入正文。勾顶「用户已批准」前仍视为未裁决。

---

## 验收

- **按钮①**：填 marketplace 源（GitHub slug / URL）→ 后端拉 `marketplace.json` → `config.toml` 含 `[marketplaces.<name>]` → 配置页列出该源可用 MCP。
- **按钮②（marketplace 装）**：填 `<mcp>@<marketplace>` + 按 `envSchema` 填 env value → 后端 `npx -y` 预拉成功 → `config.toml` 含 `[mcpServers.<name>]`（`installed=true`、`fromMarketplace` 溯源、env 子表收敛）。
- **按钮②（直装 npm 包）**：填 `<pkg>@<version>` + 手填 command/args/env table → 后端 `npx -y` 预拉 → `config.toml` 含 `[mcpServers.<name>]`（无 `fromMarketplace`）。
- 运行时启动 → GM 工具表含客制 MCP 工具（标 outOfCanon 徽）；命中 npx 缓存拉起。
- `POST /diagnostics/mcp-test` 对该客制 MCP → 可达 + 工具 list。
- 开关 `enabled=false` → 运行时不启动、工具表不含。
- 期望首跑见红（现未接运行时 = 红）。

## owns（预期触及，非独占）

- backend：marketplace 源拉取（git clone / fetch `marketplace.json`）与解析、`npx -y` 预拉执行、`config.toml` 的 `[marketplaces.*]`/`[mcpServers.*]` 读写、运行时按 stdio 启动客制 MCP、工具表合并、mcp-test 覆盖客制。
- 前端：配置页 MCP 子页两按钮（添加 marketplace 输入框 + 安装输入框）+ marketplace 下 MCP 列表展示 + 安装表单（command/args 默认推导 + 配置项 table 按 envSchema + 开关 + out-of-canon 徽 + 连接测试）。
- `config.toml` 的 `[marketplaces.*]`/`[mcpServers.*]` schema（新增·shared 或 config 模块；与既有 `[env]` 节共存）。
- `.dicelore/marketplace.json` 清单格式 spec（新增·沉 wiki）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-接口](../../04-子系统设计/玩家客户端-接口.md) §9.4 + [玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md) §6（MCP 子页两按钮客制化流程）+ 关 backlog RT8 + 勾路线图；删本裁决文件。

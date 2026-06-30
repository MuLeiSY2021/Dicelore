# 安全策略

## 支持的版本

Dicelore 仍处于早期开发阶段，尚未正式发版。当前仅对 `main` 分支的最新提交提供安全修复。

| 版本 | 是否支持安全更新 |
| ---- | :--------------: |
| `main`（最新）| ✅ |
| 其它历史提交 | ❌ |

## 报告漏洞

**请勿通过公开 issue 报告安全漏洞。**

请使用 GitHub 的私密漏洞披露渠道：进入本仓库的 **Security** 标签页 → **Report a vulnerability**（Private vulnerability reporting），直接私下提交给维护者。也可私信维护者 [@MuLeiSY2021](https://github.com/MuLeiSY2021)。

报告时请尽量包含：

- 漏洞类型与影响（例如：prompt injection、SSRF、越权访问、密钥泄露等）
- 复现步骤或概念验证（PoC）
- 受影响的文件 / 端点 / 版本
- 你认为可行的修复方向（如有）

## 处理流程

- 我们会在收到报告后尽快确认，并评估影响范围。
- 修复期间请对漏洞细节保密，待修复发布后再公开披露。
- 修复合入 `main` 后，会在 release notes / Security Advisory 中致谢报告者（除非你希望匿名）。

## 已知安全方向

Dicelore 把玩家自由文本喂给 LLM 驱动的 GM，并允许配置外部模型 / MCP 端点，因此尤其关注：

- **Prompt injection**：玩家输入 → GM 的注入面。
- **SSRF**：模型 / MCP 连接测试的 `baseUrl` / endpoint 白名单。
- **密钥托管**：模型 API key 的存储与代发。
- **多租户隔离**：远程部署下的会话 / 资源隔离。

这些面的设计与进展见 [`docs/wiki/设计/05-现状与计划/backlog-后端.md`](docs/wiki/设计/05-现状与计划/backlog-后端.md) 的安全主题。

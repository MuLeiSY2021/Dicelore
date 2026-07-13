# 可用性验收（TDD+BDD · 前端驱动后端）· `acceptance-loop` · 2026-07-06 · 第 1 轮

> 本轮工件目录。skill 定义与铁律见 [`.claude/skills/acceptance-loop/`](../../../.claude/skills/acceptance-loop/SKILL.md)。
> **目标**：以真实用户身份端到端验 Dicelore 整套功能「对用户可不可用 + 有没有 bug」，问题落 backlog，循环到符合里程碑设想。
> **顺序（outside-in）**：先落可见前端原型 → 据原型回写 overview → 前端预览收口 → 据前端数据需求补齐后端接口协议 → curl+playwright 见红 → 开发到绿。接口服务于前端，但架构仍仲裁（原型从状态机推导、不锚 React 代码；前端冒出的超架构需求 = finding）。

## 分件（按 outside-in 六步）

| 步 | 文件 | 内容 | 状态 |
|---|---|---|---|
| 第零 | [`0-state-machines.md`](0-state-machines.md) | 行为状态机（A 实体 A1-A4 / B 页 B1-B6 + 映射）= 总体设计的根 | ✅ 基本定稿 |
| 第一 | [`frontend/`](frontend/README.md) | 前端原型 html+css（5 页墨金 · home/catalog/play/build/config · `index.html` 逐态预览 · 挂 data-testid）= 可见的共享样例（BDD）· 含 07-09 修复轮 home/catalog/config/build 细节补全 | ✅ 原型已落（无后端接线） |
| 第二 | [`1-frontend-overview.md`](1-frontend-overview.md) | 前端 overview（据原型回写 · selector 规约）+ 前端数据需求清单 + 收口门 | ✅ 收口（双向核对通过·dock-card 命名分裂已修+31 处漏记已补+2 处多写已标期望·转移映射引 2-tests.md） |
| 第三 | [`1-backend-interface.md`](1-backend-interface.md) | 后端接口协议（被前端数据需求驱动 · `/sessions/{kind}` 对称面 + 现状偏差红） | 🚧 已同步 07-09 前端设计（usage 扩/model 切换/`turn_ended.usage`/自定义 MCP 登记 RT8 + presentation RT-FE4）·超前项标待批准裁决·偏差待第四步真跑定论 |
| 第四 | [`2-tests.md`](2-tests.md) | 大型 curl 脚本（遍历实体机每转移）+ playwright（遍历页机每转移）计划 | ✅ 已写已跑见红：curl PASS=31 FAIL=11 BLOCKED=4（[`transcript`](tests/curl-run-transcript.txt)）+ playwright FAILED=71 PASSED=0（[`transcript`](tests/pw-run-transcript.txt)·15 spec：B1/B2/B3/B6 单 + B4 拆6 + B5 拆5） |
| — | [`findings.md`](findings.md) | 本轮抓出的偏差（RT1–RT9 + RT-B3 + RT-FE1…20），待真跑定论后归口 backlog | 📋 累积中 |
| 第五 | — | 开发到 curl 全绿 / playwright 绿（只改代码，重大/不可逆冒泡） | ⬜ 未开始 |

## 交接点（"剩下我来干"从这里接）

第零定稿、第一步原型落地、第二步 overview 收口、第三步 backend-interface 已同步 07-09 前端设计（运行时观测族 + 自定义 MCP 登记 + presentation RT-FE4 缺口并入·超前项标 ⚠️ 待批准裁决·偏差待真跑定论），findings 累积中。**接下来（你）**：

1. ~~第一·前端原型 html+css~~ ✅ 已落 [`frontend/`](frontend/README.md)（5 页原型 + data-testid + `index.html` 逐态预览 + 07-09 修复轮增量：home 首访空态/continue/manual-link/强 CTA/角落运行态、catalog 版本 diff+导入流程 validatePack+搜索筛选+加载骨架、config 拆 model/mcp test-btn+custom-mcp 表单+toast 持久化+key 可见性、build data-jump 接线+inline 编辑全类型+编排中止+新建表单+guideline 跳转+commit 过渡+import 联动+切会话刷新）。剩：隐藏态切换、接后端真数据（并入第五步）。
2. ~~第二·overview 收口~~ ✅ 双向核对通过（html↔overview 229 testid 全覆盖·命名分裂 `dc-*`→`play-card-*` 已修·31 处漏记已补·`play-session-pack`/`play-archive-restore` 多写已标期望·`play-stage` 并入 `play-stage-shell`）。
3. **第三步收口**：backend-interface 已同步 07-09 前端设计（运行时观测族：`GET /usage` 扩 context+session+perTurn / `POST …/model` / `turn_ended.usage`+loregm 响应内联 usage / build 用量浮窗对称；自定义 MCP 登记 CRUD RT8；presentation RT-FE4 plotline/world 投影缺口·超前项标 ⚠️ 待批准裁决）·待第四步真跑验偏差。
4. **第四·curl**：据 `1-backend-interface.md` + `2-tests.md` 清单写 `tests/curl-*.sh`（假 GM 遍历），**先跑见红**（RT1/RT6/RT7/RT-ns/RT2 会先红）。
5. **第四·playwright**（✅ 已完成）：据 `2-tests.md` + overview 的 data-testid 写 `tests/pw/*.spec.ts`——**针对真前端 React app（vite 5173）的可执行规约，非静态原型**（原型只是 testid 源/BDD 共享样例）。15 spec（B1/B2/B3/B6 单 + B4 拆6 + B5 拆5 + config/helpers/seed）已跑见红 71/71（[`transcript`](tests/pw-run-transcript.txt)·红全为原型 testid 真前端缺失·无基建错·workers:1 串行避 429）。绿待第五步。
6. **第五·开发到绿**：红→可逆小修当场改（不改断言）/ 重大不可逆落 backlog + 冒泡。

## 铁律（防作弊 · 全程）

期望来自架构、先于实现（前端原型也是期望、从页状态机推导）· 红先行 · 绿只改代码 · 不信实现状态列（可见原型也不是 ground truth，跑起来对得上才算）· 确定性+落盘。详见 skill。

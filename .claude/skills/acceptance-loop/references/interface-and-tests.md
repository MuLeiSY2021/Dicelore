# 第一/二/三步参考 · 前端原型 · 前端 overview · 后端接口协议 · 测试 · 开发分诊

> 承接 [`state-machine-model.md`](state-machine-model.md)：状态机是根，本文件定怎么把它**先落成可见前端原型、再回写 overview、收口后补后端接口协议**，再实现到绿。顺序 = outside-in（前端驱动后端）。

## 第一步 · 前端原型先行（html+css · 可见的共享样例 · BDD）

据页状态机，落**一套 html+css 原型**（可承 wiki 视觉草图 `玩家客户端-视觉草图/`），配 `frontend/index.html` harness 按 `data-screen`/hash 逐页逐态预览——**开浏览器即看到实际页面长什么样、怎么交互**。这是 BDD 的共享样例：具体的、可见的，先于文字契约对齐所有人脑中行为。

目的不是美术定稿，而是给每页**确定的结构 + 稳定 `data-testid` 选择器 + 关键交互**。纪律：
- **原型从页状态机推导，不锚现有 React 代码**（铁律 1）——它是期望，不是给现状盖章。仓库 React 偏「工作区/工具面板」IA 而原型重做「桌面沙盘 + dock&bay」就是典型：照原型重构，不是照 React 回填。
- 选择器挂 `data-testid="<page>-<element>"`（playwright 只认它，不依赖文案/class）。
- 原型要能逐态预览：每个 `data-screen`/hash 组合对应页机一个态，开发者点开就看全。

## 第二步 · 前端 overview（据原型回写）+ 收口门

据已落地的原型**回写**前端设计概览：逐页结构/选择器/关键交互——选择器直接从原型 html 抄，不另起炉灶。这一步是「文档化原型」，让原型可被测试引用、可被后端推导。

同时**列「前端数据需求清单」**：原型每个动态区域需要后端喂什么数据。范例：
- 跑团页 dock-card 需 `GET /presentation` 的 sheet cells
- 明骰内联 stream 需 per-band narrate 文本
- 暗骰 `mech` 需 hidden 标记/WS 类型
- 上下文占用条需 prompt token 数 + 模型 window size
这清单喂给第三步，是后端接口协议的输入。

**收口门**（没收口不进第三步）：
- 原型能逐页逐态预览、开发者看了就懂无歧义
- overview 与原型一致（每个 `data-testid` 对得上）
- 数据需求清单成形（每个动态区域标了数据源或「待后端补」）

## 第三步 · 后端接口协议（被前端数据需求驱动 · 补齐）

**理想面按 `/sessions/{kind}` 对称** —— dicegm 与 loregm 共享会话生命周期骨架（create/list/get-meta/drive-turn/delete），域子资源各异，catalog 独立。现有代码若 `/sessions` vs `/lore-sessions` 不对称，那是要拉平的 finding，不是照抄的现状。

据第二步「前端数据需求清单」+ 实体状态机每条转移 derive 接口。表格每行：`应有接口 | 请求 | 期望响应形状 | wiki 出处 | 匹配`。纪律：
- **期望响应形状引 wiki**（接口§1/§2、构建§6），不看代码输出（铁律 1）。
- **匹配列对照真实路由，不信 wiki 状态列**（铁律 4）：`✅ 在 / ❌ 缺 / ⚠️ 在但语义存疑或超前设计`。
- **前端驱动后端**：接口服务于前端已定的数据需求。**架构仲裁**：前端原型冒出的、超出实体机/wiki 的数据需求 = finding（超前/新需求），落 backlog/裁决记录，不自动塞进接口。范例：RT-FE14 上下文占用、RT-FE18 model 运行时切换都是前端冒出的新需求，归口裁决而非直接进协议。
- finding 类型：**真缺口**（应有而无）、**超前**（代码有而无契约）、**语义存疑**（wiki 自相矛盾，必真跑定论）、**对称缺口**（一 kind 有另一 kind 缺）、**字段**（summary 缺字段）、**新需求**（前端驱动冒出、超架构）。

## 第四步 · 测试（首跑都应见红）

- **大型 curl 脚本（bash）**：起隔离后端（`eval-backend-setup`，`DICELORE_FAKE_GM=1`），用假 GM **确定性遍历实体状态机每条转移**；逐端点 `curl` + 断言期望 status + body 形状（引 wiki 形状）。全程落盘、可复现（铁律 5）。
  - 假 GM 走"教练档"（`FakeDiceGm` 的 `CanonScript`：roll/choice/gameEnd/error）驱动 dicegm 五条主线；loregm 侧需脚本化确定性驱动（若缺是本 skill 的新造件）。
- **playwright**：据落地原型 html+css，驱动**页状态机每条转移**、断言可见状态。
- 断言从状态机/接口协议来，**先于代码**；首跑见红证明它真在测（铁律 2）。

## 第五步 · 开发到绿 + 分诊

红 = 被测 bug。判可逆性决定当场修还是冒泡：

- **可逆小修**（明显 bug、非架构改、可 git 还原、无需用户不可逆决策）→ **当场改代码到绿**。**绝不改断言**（铁律 3）。
- **重大 / 不可逆**（改公共契约、破坏性改名如 `/sessions/{kind}` 统一、需用户裁决）→ **落 backlog + 冒泡**，保留红并记录理由，不自作主张。

**findings 归口**：core → `backlog-core`；HTTP/会话/编排 → `backlog-后端`；玩家主线/前端 → `backlog-前端`；harness 自身真实性 → backlog-core 主题F。去重归类后重排接 `idea-to-roadmap`；不可逆修复写 `裁决记录/` 待用户批准。

**合并**：小修在隔离环境验证后走项目惯例（开分支→ff 合并回 main，不 push）。大改交 `roadmap-delivery-workflow`。

## 分档控成本

每轮先 **Tier 0**（假 GM · 确定性 · 便宜 · 必跑）过了，再 **Tier 1**（真 LLM · 深跑完整一局 · 贵）当忠实性锚点——验假 GM 没在测虚构系统 + 抓脚本抓不到的涌现 bug（正是里程碑一缺的那一局）。真 LLM 的定性判断用对抗式复核（多独立视角一致才算数），判定权归用户。

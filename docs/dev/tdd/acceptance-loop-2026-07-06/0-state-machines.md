# 第零步 · 行为状态机（架构图景 = 期望规格的根）

> 属 `acceptance-loop` 第零步。**两类状态、都详建**：A 实体状态机 + B 页状态机。映射：页 DISPLAYS 实体；页状态 = 实体状态投影 + 页自身 UI 状态。建模法 → skill `references/state-machine-model.md`。
> 验收 = 用假 GM/假 loregm + curl/playwright 遍历每条转移，断言转移后可观测状态符合期望。

## 分层总览

```
A. 实体状态机（后端持有的持久实体）
   A1 会话生命周期：无 / 活跃 / 空 / 归档      [dicegm | loregm 共享骨架]
        └ 活跃内嵌域机：A2 dicegm 回合循环 / A3 loregm 自由编排
   A4 catalog 团本产物库（版本 · 独立）        loregm 写 / dicegm 读

B. 页状态机（每页一台）
   B1 导航页(壳)  B2 主页(指南+最近会话摘要)  B3 团本目录页(玩的入口)
   B4 跑团页(顶栏 bar + 回合循环)  B5 团本制作页(bay session + 自由编排)  B6 配置页(七子页)
```

---

## A. 实体状态机

### A1. 会话生命周期机（无 / 活跃 / 空 / 归档 · dicegm/loregm 共享骨架）

```mermaid
stateDiagram-v2
  [*] --> 无
  无 --> 活跃 : 创建（dicegm 新局 / loregm 建团本）
  活跃 --> 活跃 : drive-turn / rewind 到非起点（作用当前分支）
  活跃 --> 活跃 : branch（开新分支·copy jsonl·保留旧支）/ checkout（切当前分支）
  活跃 --> 空 : rewind 到开头（清空当前分支 = empty）
  空 --> 活跃 : 继续（再驱动回合 / 再建）
  活跃 --> 归档 : 域内终态·留档（loregm 提交团本 / dicegm 经战后复盘后显式结束）
  归档 --> 活跃 : 继续（dicegm 续玩 / loregm 更新团本）
  活跃 --> 无 : 删除
  note right of 活跃 : 带活动日期；内嵌 dicegm(A2)/loregm(A3) 域机。list / get-meta / delete 为两 kind 通用生命周期操作。**dicegm 活跃内含多分支**（每分支一 jsonl·独立 seq/快照·一当前分支）；status 取值 {活跃,空,战后复盘,归档}（战后复盘= dicegm 域特有，见 A2）
```

### A2. 域机 · dicegm 跑团回合循环（活跃内嵌）

```mermaid
stateDiagram-v2
  [*] --> 未开场
  未开场 --> 待输入 : start kickoff（prologue 开场）
  待输入 --> 生成中 : 玩家自由输入（开一回合）
  生成中 --> 待输入 : 回合结束（纯叙事）
  生成中 --> 待掷 : GM 明骰（回合内阻塞）
  state 待掷 {
    [*] --> awaiting : 暂存待掷 → 弹掷骰卡
    awaiting --> committed : 玩家点掷 → 引擎掷 → 回显
    awaiting --> committed : 无前端·降级立即掷
  }
  待掷 --> 生成中 : 结果作工具返回值回 GM（回合内）
  生成中 --> 待选 : GM 给选项 → 物化待选项
  待选 --> 待输入 : 回合结束（携选项）
  待输入 --> 生成中 : 玩家选项（作下一回合输入）
  待输入 --> 终局 : GM game_end
  终局 --> 战后复盘 : GM AI 调 game_end（唯一一次·转复盘不归档）⇒ 会话 活跃→战后复盘
  战后复盘 --> 待输入 : 玩家 branch 回档（开新分支续玩 · 详见裁决 debrief-and-branch §二）
  战后复盘 --> [*] : 玩家显式结束 ⇒ 会话 战后复盘→归档
  note right of 待输入 : 自由文本 drive-turn；rewind 到开头 ⇒ 当前分支清空（会话 活跃→空）；断线重连 = 快照 + 事件回填
  note right of 战后复盘 : messages 仍接受；AI 由 harness 加载 debrief-mode skill 切复盘模式（不推进剧情·回答提问·不硬禁机制推进 C3=忽略·靠 skill 软约束）；非纯UI态·后端持有。详见裁决 debrief-and-branch §一
```

### A3. 域机 · loregm 自由编排（活跃内嵌 · 作者自由文本驱动）

```mermaid
stateDiagram-v2
  [*] --> 待输入
  待输入 --> 编排中 : 作者自由文本输入（开一回合，如"丰富世界观"/"加个反派"）
  编排中 --> 待输入 : 回合结束（本回合内 loregm 自主调 write_lore/add_npc/add_pool/write_rule/set_manifest…，顺序自定）
  待输入 --> 待输入 : 可选·上传素材（大源不经 LLM 中继）
  待输入 --> 待输入 : 可选·搜索 / 额外 MCP 工具（配置侧登记）
  待输入 --> 校验 : 作者觉得够了 → 整包校验
  校验 --> 待输入 : 有 error 回去改
  校验 --> 提交 : 零 error
  提交 --> [*] : commit 团本到 catalog ⇒ 会话 活跃→归档
  note right of 待输入 : drive-turn = 作者自由文本（**同 dicegm** 回合骨架，只是产 build 工具调用）；阶段是 build-pack skill 的 guideline 非硬序（可先规则后世界观）；素材/搜索可选
```

### A4. catalog 团本产物库（独立 · loregm 写 / dicegm 读）

```mermaid
stateDiagram-v2
  [*] --> 无版本
  无版本 --> 有草稿 : loregm 活跃期累积写 Draft
  有草稿 --> 已提交版本 : commit（loregm 归档那一刻）
  已提交版本 --> 已提交版本 : tag 打标签
  已提交版本 --> 有草稿 : 更新团本（loregm 再活跃续写）
  已提交版本 --> dicegm就绪 : import（选版本·默认最新 → validatePack 信任闸 → dicegm 读入开局）
  note right of 已提交版本 : 独立于任何 session；版本不可变、可 checkout head/tag（开始游戏默认取 head）
```

---

## B. 页状态机（每页一台 · 投影实体 + 纯 UI）

### B1. 导航页 / 壳（导航状态 = 在哪页 + 壳级运行态）

```mermaid
stateDiagram-v2
  [*] --> 主页
  主页 --> 团本目录 : 去玩 / 快速入口
  主页 --> 团本制作页 : 快速入口
  主页 --> 配置页 : 快速入口
  主页 --> 跑团页 : 继续最近会话（仅当有活动会话）
  团本目录 --> 跑团页 : 开始游戏（选版本·默认最新）
  团本目录 --> 团本制作页 : 编辑团本
  跑团页 --> 团本目录 : 直接进但无活动会话 → 提示先导入/创建
  跑团页 --> 主页 : 返回
  团本制作页 --> 主页 : 返回
  配置页 --> 主页 : 返回
  note right of 主页 : 壳恒挂——运行态指示(模型/MCP/notify ← health 轮询)+工具区(语言/明暗/强调色)
```

### B2. 主页（落地页 · 指南为主 + 最近一个会话摘要）

```mermaid
stateDiagram-v2
  [*] --> 加载中
  加载中 --> 落地 : 拉「最近一个会话」摘要 + 运行态
  落地 --> 团本目录 : 去玩
  落地 --> 团本制作页 : 去造
  落地 --> 配置页 : 去配置
  落地 --> 跑团页 : 继续最近会话（若有）
  note right of 落地 : 核心 = **指南**（怎么用 + 使用手册在哪）；**只显示最近一个会话摘要**，不投影全量列表（全量会话在跑团页 bay session / 制作页 bay session）
```

### B3. 团本目录页（第 2 页 · 跑团入口 · 选版本 / 导入）

```mermaid
stateDiagram-v2
  [*] --> 加载中
  加载中 --> 有团本列表 : catalog 非空
  加载中 --> 空态 : catalog 空 → 引导导入 / 去制作 / 造示例
  空态 --> 加载中 : 导入团本 / 造示例后返回
  有团本列表 --> 选版本 : 点「开始游戏」
  选版本 --> 跑团页 : 选团本版本（**默认最新**）→ 建 dicegm 会话 + import → 跳转开场层
  有团本列表 --> 导入中 : 导入团本
  导入中 --> 有团本列表 : 导入完成（validatePack 信任闸）
  有团本列表 --> 团本制作页 : 编辑团本
  note right of 有团本列表 : 数据源 = catalog(A4)；每条团本 + 多版本。核心职责 = **跑团入口** + **导入团本**
```

### B4. 跑团页（第 3 页 · 桌面沙盘 + bay 抽屉 + 投影 dicegm 域机 A2）

```mermaid
stateDiagram-v2
  [*] --> 无活动会话
  无活动会话 --> 未开场层 : 从团本目录「开始游戏」进入 / 点 Session 抽屉某会话
  无活动会话 --> 团本目录 : 直接进且无会话 → 提示"先导入或创建团本"
  未开场层 --> 续玩层 : 点击开始游戏(kickoff) → 开场流出
  state 续玩层 {
    [*] --> 待输入
    待输入 --> 生成中 : 提交输入
    生成中 --> 待输入 : 叙事收尾(turn_ended)
    生成中 --> 待掷 : roll_staged（明骰内联 stream · 区间分档 + 居中按钮）
    待掷 --> 生成中 : 点掷(roll_committed) · 结果内联
    生成中 --> 待选 : choices 浮在输入框上
    待选 --> 生成中 : toggle 选中 · send 提交（或输入框自定义）
    生成中 --> 错误 : error
    错误 --> 待输入 : 重试 / 跳过
  }
  续玩层 --> 战后复盘 : game_end → harness 调 enter_debrief（不遮罩 · 续玩层继续）
  战后复盘 --> 续玩层 : 玩家 branch 回档（开新分支 · GM 不再推进剧情·回答提问）
  note right of 续玩层 : **桌面沙盘**：中央舞台 + **右 dock**（dock-card = markdown 模板渲染器 · `dc-meta` 数据选择器默认隐/编辑显 + `dc-body` 渲染 markdown · 三按钮 edit/archive/fold · 去钉选）；底部 `bay` 放 Session/人物卡/剧情线/世界书/其他表单/配置/归档 入口，点开浮窗、点外关闭（团数据四类 = 数据浏览，非卡模板+钉选）。玩家气泡 = 轮锚点；edit → inline 确认 → rewind。断线重连走快照+events 回填。
```

### B5. 团本制作页（第 4 页 · bay session + 投影 loregm 域机 A3）

```mermaid
stateDiagram-v2
  [*] --> 无活动会话
  无活动会话 --> 选内容类型 : 新建构建会话 / bay 里点构建会话
  选内容类型 --> 查看编辑 : 选中（世界设定/NPC/卡池/规则·分档/state/Front/剧情线/伏笔/锚点/关系/prologue/Manifest）
  查看编辑 --> 选内容类型 : 切类型
  查看编辑 --> 助手编排中 : 对构建助手发指令（drive-turn）
  助手编排中 --> 查看编辑 : 回合结束（即写即读刷新）
  查看编辑 --> 校验报告 : 校验整包
  校验报告 --> 查看编辑 : 按报告(error/warn)定位改
  校验报告 --> 已导出 : 零 error → 提交 / 导出团本包
  note right of 查看编辑 : **bay session 入口**（`build-bay-btn-session`→`build-bay-popover-session` 浮窗列构建会话：活动日期/团本/最新动作 · 对齐 play 的 bay session · **无顶栏 sessionbar**）。投影 loregm 域机(A3)。右栏=构建助手对话(显示调了哪些工具)+整包校验报告(error/warn 计数+定位)；上下文条 `build-ctxbar`=团本名+草稿版本+校验/导入/导出
```

### B6. 配置页（第 5 页 · 最复杂也最简单 · 七子页）

> "最复杂"=子页多、覆盖面广；"最简单"=机制统一（表单 + 持久化 + 可选连接测试），无域状态机。

```mermaid
stateDiagram-v2
  [*] --> 选子页
  选子页 --> 子页视图 : 选七子页之一
  子页视图 --> 选子页 : 切子页
  子页视图 --> 测试中 : 连接测试（模型 / 自定义 MCP）
  测试中 --> 测试成功 : 可达 / 探活 OK
  测试中 --> 测试失败 : 401/403 · 命令不存在
  测试成功 --> 子页视图 : 保存（持久化）
  测试失败 --> 子页视图 : 改配置重试
  note right of 子页视图 : 真值源 = health；表单皆持久化。七子页明细见下表
```

**七子页明细**（来源：视觉§6 + §9.1）：

| 子页 | 内容 | 数据源 / 端点 |
|---|---|---|
| 通用 | 语言(zh/en) + 通用偏好 | localStorage |
| 服务与网络 | 主页端口 / 域名 / notify webhook(`DICELORE_NOTIFY_URL`) | health(port/notify) |
| MCP 服务器 | 核心 `dicelore`（stdio·运行时·**工具数**·notify·标「必需」锁定）+ 自定义 out-of-canon MCP（增删改 / 开关 / 权限闸 / out-of-canon 徽 / 联网警示 / 连接测试） | health(工具数) + mcp-test；**自定义 v1 未接运行时（RT8）** |
| 模型连接 | GM 模型下拉 + **Agent 底座**(Harness 默认 / Claude Agent SDK) + key 掩码 / baseURL / OAuth + 连接测试 | model-test + keys(H3) |
| 主题外观 | 主题(墨金/…) / 明暗(含跟随系统) / 强调色 / 字体档 | localStorage |
| 数据与存储 | `DICELORE_DATA_DIR`(每局一文件) / `DICELORE_FTS_MODE` 等（展示后端真值） | health(sessionsDir/ftsMode) |
| 关于 | 版本 / 许可 / 项目信息 | — |

### B↔A 映射速查

| 页状态机 | 投影的实体状态 | 页自身 UI 状态（正交） |
|---|---|---|
| B2 主页 | A1 **最近一个会话**(摘要) + health 运行态 | 指南为主·加载 |
| B3 团本目录 | A4 catalog(团本+版本) | 加载/列表/空态·选版本·导入中 |
| B4 跑团页 | A2 dicegm 域机 + A1 **全量会话**(bay session) | 无会话提示·未开场/续玩层·面板三态·重连 |
| B5 制作页 | A3 loregm 域机 + A1 **全量构建会话**(bay session) | 内容类型选择·助手·校验 |
| B6 配置页 | health / keys 真值（无会话） | 七子页·表单·测试三态 |
| B1 导航页 | A1(是否有活动会话→跑团置灰) + health(运行态) | 在哪页·工具区 |

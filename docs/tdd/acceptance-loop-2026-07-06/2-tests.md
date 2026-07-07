# 第二步 · 测试（大型 curl 脚本 + playwright）

> 属 `acceptance-loop` 第二步。据 [1-backend-interface.md](1-backend-interface.md)（curl）与 [1-frontend-overview.md](1-frontend-overview.md)（playwright）。**首跑都应见红**（铁律 2）；断言引 wiki 形状、不看代码输出（铁律 1）；假 GM 确定性、全程落盘、可复现（铁律 5）。
> **状态：脚手架**——下面是要覆盖的转移清单 + 脚本骨架约定；`tests/curl-*.sh` 与 `tests/*.spec.ts` 待写。

## curl 脚本（bash · 遍历实体状态机每条转移）

起后端：`eval-backend-setup`（`DICELORE_FAKE_GM=1`，隔离数据根）。假 GM 走教练档（`FakeDiceGm` CanonScript）确定性驱动；loregm 侧确定性驱动若缺 = 本 skill 新造件（见 findings）。

**格式**（每条转移一段）：
```bash
# <转移ID> <人话>（据 1-backend-interface §<n>）
resp=$(curl -s -w '\n%{http_code}' <method> <url> <body>)
assert_status <期望码>            # 引 wiki
assert_shape '<期望 body 形状>'   # 引 wiki，不看代码现输出
# 红点: <该转移已知存疑处>
```

**A 实体机转移覆盖清单**（勾 = 已写脚本）：

- 会话生命周期（A1 · 两 kind）
  - [ ] 无→活跃 `POST /sessions/{kind}` → `201`（**首红：RT1 现无此端点**）
  - [ ] 列表 `GET /sessions/{kind}` → `{sessions[]}`（loregm **首红：RT6**）
  - [ ] 元信息 `GET /sessions/{kind}/{id}`（loregm **首红：RT7**；dicegm 验"桩"真伪）
  - [ ] 删除 `DELETE /sessions/{kind}/{id}`
  - [ ] 开场 `POST …/start`（幂等）
  - [ ] drive-turn `POST …/messages` → `202 {turnId, error?}`（loregm error-in-body）
  - [ ] rewind 到非起点 `POST …/rewind`（**RT3 无契约**）
  - [ ] rewind 到开头 ⇒ 状态转「空」（断言 `GET …/{id}` status=空）
- dicegm 域（A2）
  - [ ] choices `POST …/choices` → `202`（**RT2 语义必真跑定论**）
  - [ ] roll `POST …/roll` → `202`；无待掷 → `409`
  - [ ] presentation / events?since / browse
  - [ ] WS：连后先 snapshot，再逐条验 10 类消息（game_end **必验 RT-B3**）
- loregm 域（A3）
  - [ ] materials 上传（可选路径）→ 落盘；超限 `413`
  - [ ] draft 检视
- catalog（A4）
  - [ ] catalog / commit / files?ref=head / validate / tag
  - [ ] import（选版本·默认最新 → validatePack）
- 配置/诊断（§6）
  - [ ] health 真值形状 / model-test / mcp-test / keys / 限流 429

> 断言用可复用脚本判（`assert_status`/`assert_shape` helper），别肉眼看——快、稳、可跨轮重跑。

## playwright（据 1-frontend-overview 的 data-testid · 驱动页状态机每条转移）

**页机转移覆盖清单**：
- [ ] B1 导航：五页签切换；无活动会话时 `nav-tab-play` 置灰
- [ ] B2 主页：指南 + `home-manual-link` 存在；仅显示最近一个会话摘要（非全量）
- [ ] B3 目录：列表/空态；`catalog-start-btn`→选版本→跳跑团；`catalog-import-btn`
- [ ] B4 跑团：`play-noSession-hint`；kickoff→续玩层；掷骰卡/选项/错误/终局；顶栏 session bar 列所有会话（date/pack/lastreply — **RT9 最新回复字段待验**）
- [ ] B5 制作：顶栏 bar；内容类型切换；助手编排→即写即读刷新；校验报告
- [ ] B6 配置：七子页切换；连接测试三态

> playwright 待 `1-frontend-overview.md` 的 html+css 落地后才能跑（前端 track 依赖）。后端 track（curl）可先独立跑起来见红。

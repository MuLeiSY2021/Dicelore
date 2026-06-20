# 调研：标杆竞品——Latitude / Voyage

> **本页职责**：用**有出处的证据**深挖当前最强、最值得对标的竞品 **Voyage（Latitude 出品）**——它在做什么、做到哪一步、拿了多少钱，以及它**结构上不会碰**的方向在哪。为 [问题域](问题域.md) 的"市场空白"立场与 [成功标准](成功标准.md) 的差异化定位提供事实地基。
> **上游依赖**：无（这是为问题域 / 成功标准服务的一手调研）。
> **状态**：🟢 已归档（2026-06-02 Web 调研，Tavily 英文源为主，融资数据多源交叉核实）。
> **性质**：调研快照，非结论页。结论收敛在 [问题域](问题域.md) / [成功标准](成功标准.md)。
> **与 [调研-市面现状](调研-市面现状.md) 的关系**：市面现状是**横向扫描**（有无趁手框架），本页是对其中最强玩家的**纵向深挖**。

---

## 一句话结论

**Voyage 用 $43M+ 融资、5 年 6 代原型，把"LLM 叙事 + 确定性世界引擎"做成了一个有护城河的闭源 SaaS——它验证了 Dicelore 的分层方向是对的，但也证明这条路又慢又重（至今仍停在 beta）。它结构上不做的四件事——中文、多人论坛共创、安价投票、开源自托管——正是 Dicelore 的立足缝隙。比它造一个更强的引擎不是出路；占住它不会碰的形态才是。**

---

## Q1. 这是谁——公司基本盘

- **公司**：Latitude（latitude.io），2019 年由 **Alan Walton & Nick Walton** 兄弟创立，起家于一个大学 hackathon 项目；总部 Provo, UT。
- **两条产品线**：
  - **AI Dungeon**（2019）——最早的 LLM 文字冒险，纯自由叙事，曾达 100 万+ 注册、早期约 150 万 MAU。如今是闭源订阅制 SaaS。
  - **Voyage**（2026-04-21 发布）——下一代押注，**"AI-native RPG 平台"**，与 AI Dungeon 共用团队和底层。
- **规模**：截至 2026-03，员工约 28 人（Tracxn）。

出处：
- https://forgeglobal.com/latitude_stock
- https://tracxn.com/d/companies/latitude/__XpkklF70AIh_gDapoq4Q6bkCg6IEtk36tXq1vDQxpW8
- https://gameworldobserver.com/2021/02/05/studio-behind-ai-generated-text-sandbox-game-ai-dungeon-raises-3-3-million

---

## Q2. 融资到底多少——$43M+，且 2026 新轮金额未披露

| 时间 | 轮次 | 金额 | 备注 |
|---|---|---|---|
| 2020-04 | Seed | $0.75M | |
| 2021-02 | Seed | $3.3M | NFX 领投，Album VC / Griffin Gaming 跟投 |
| 2022-06 | （未命名） | $11M | |
| 2024-01 | **Series B** | **$29M** | 做 Voyage World Engine 的主要弹药 |
| **累计** | **5 轮** | **≈ $43.3M** | Seedtable 另一处计为 $44.1m |
| 2026-04 | 随 Voyage 发布 | **未披露** | 见下 |

- **2026-04 这一轮金额官方没公开**。通稿只列新增投资方：**Google's AI Futures Fund**、**前 Roblox CBO Craig Donato**（同时进董事会），与既有的 **NFX、Album VC、Griffin Gaming Partners、Midjourney** 一起。
- **数据陷阱（写竞品分析务必避开）**：**Tracxn 和 Forge 至今仍只显示 $3.3M（2021 seed）**，漏记了 2022 与 2024 两轮——低估一个数量级。融资额请以 **Seedtable** 为准。
- **同名干扰**：`latitudemedia.com`（地热播客）、Bloomberg 的 "Latitude" 节目都**不是**它。

出处：
- https://www.seedtable.com/startups/Latitude-GE9BMX8 （$43.3M / 5 轮明细，权威）
- https://www.businesswire.com/news/home/20260421658665/en/Voyage-Launches-the-First-AI-Native-RPG-Platform-Signaling-the-Future-of-Gaming （2026 轮投资方，金额未披露）
- https://tracxn.com/d/companies/latitude/__XpkklF70AIh_gDapoq4Q6bkCg6IEtk36tXq1vDQxpW8 （滞后例证：只显示 $3.3M）

---

## Q3. Voyage 做到哪一步——仍在 beta

- **2026-04-21 进入 "expanded beta"（扩展 beta）**，open beta 计划当年晚些时候放出。**尚非正式版。**
- 已在 **Google Play 上架**（`io.voyage`，"Voyage: AI RPG Platform"），独立域名 voyage.io——移动端 + Web 双线铺开。
- **定价（即将上线）**：免费可玩，付费档 **$15 / $30 / $50**，解锁高级 AI 与解除行动次数限制。
- 早期数据：beta 测试者已与 **16 万+ 独立 AI 角色**互动，玩家平均做近 **3,000 次选择**。
- **与 AI Dungeon 互相牵制**：Latitude 曾把 Voyage beta **延期**，先去修 AI Dungeon 的 Memory / Auto-Summarization bug——两产品共用底层、彼此抢资源。

出处：
- https://techcrunch.com/2026/04/21/voyage-is-an-ai-rpg-platform-for-creating-custom-gaming-worlds-with-ai-generated-npc-interactions
- https://isharifi.ir/2026/04/21/ai-dungeon-maker-latitude-unveils-voyage-a-platform-for-creating-ai-powered-rpgs （定价 $15/$30/$50）
- https://latitude.io/news/voyage-beta-delayed-to-address-ai-dungeon-bugs

---

## Q4. 核心是 World Engine——它和 Dicelore 同台竞技的地方

Latitude 反复强调 **"Voyage isn't AI Dungeon 2.0"**，差别就在这个引擎（号称 **5 年 / 6 代原型**）：

| 维度 | Voyage 的做法 | 与 Dicelore 的关系 |
|---|---|---|
| **确定性状态层** | 严格追踪 health / 货币 / 库存 / 关系值，**跨数千回合**持久 | 对应 Dicelore 的[数据层](../03-架构/总体架构.md)职责；它做成**硬约束**而非 LLM 自由发挥 |
| **角色独立性** | NPC 有独立动机、会记仇；背叛某人，他日后可能躲你或成宿敌 | 对应"AI 当 GM 的长程一致性"痛点（[调研-市面现状](调研-市面现状.md)） |
| **进度 + 骰子** | 技能成长 + TRPG 式骰子判定，打 boss 解锁 D&D 式技能（如 Counterspell） | 同一设计直觉：把"骰子"做进核心，对抗"软着陆/不尊重骰子" |
| **无脚本自由** | 不强制 run/fight/hide，可做任意奇葩动作（"给哥布林做心理治疗"） | 保留 AI Dungeon 的自由度卖点 |
| **防卡死** | 卡住时由 chatbot 提示动作或跳段 | GM 兜底机制 |
| **多模型编排** | 自研叙事模型 + Gemini Flash（图）+ Gemma（文/音/视频） | 多模型路由，不押单一模型 |

> 旁证：AI Dungeon 自己的 Q3 2025 "Rise" 更新，把 Muse 的角色训练手法迁移到 Llama 70B（模型 Nova），主攻复杂叙事一致性与角色情感深度——说明 Latitude 的投入重心一直在"长程一致 + 角色"。出处：https://aidungeon.com/rise

---

## Q5. 它结构上不会碰的方向——Dicelore 的缝隙

Voyage 是**单人、英文、面向通用 RPG 的闭源 SaaS**。它**没有**、且因定位短期内也不会做：

1. **多人论坛共创**——Voyage 是单人沉浸；安科/安价是**多人接龙 + 楼层**形态。
2. **安价投票机制**——"读者投票决定下一步"是安价的灵魂，Voyage 无此一等公民。
3. **中文社区与语料**——它是英文产品，没有中文论坛语料地基（见 [调研-论坛语料痛点](调研-论坛语料痛点.md)）。
4. **开源 / 自托管 / 可嫁接**——它是闭源焊死的 SaaS；Dicelore 押"嫁接到任意 agent 的行为塑形层"（见 [问题域](问题域.md)）。

---

## 判断（收敛回上游）

- **方向被验证**：Voyage "LLM 叙事 + 确定性状态引擎"与 Dicelore 的分层是同一答案——思路对。
- **别比引擎**：它用 $43M / 5 年 / 6 代原型把确定性引擎做成护城河，纯 prompt 方案补不上；且它钱多时间足却仍停在 beta，说明这条路又慢又重。**护城河不在再造一个 World Engine。**
- **占形态，但分主次**：Dicelore 相对 Voyage 的不同确实落在 **中文 + 多人论坛 + 安价投票 + 开源可嫁接**，但这四点**不是平级的护城河**——中文 / 多人 / 安价是**场景形态**、开源可嫁接是**分发方式**（且开源可嫁接 SillyTavern 已做到、安价机制可被快速复刻，都不构成壁垒）。真正的差异化卡位只有一条：**把"对抗讨好本能"的 GM 行为塑形框架化**——这才是 Voyage 与现有开源前端都没做的事。前三点占住 Voyage 不碰的形态，后一条才是立身之本（详见 [问题域 §2](问题域.md)）。
- **不追护城河，追先发卡位**：上述差异化里没有传统护城河——开源 + prompt/skill 塑形天然可被 fork。Dicelore 要的不是护城河，而是**先把这件事框架化、靠开源采纳占住身位、成为事实标准**。这与 Voyage 用 $43M 砌引擎护城河是两种打法：它守闭源壁垒，我们抢开源卡位（战略表态见 [问题域 §1](问题域.md)）。

→ 该判断支撑 [问题域](问题域.md) 的"市场空白"立场与 [成功标准](成功标准.md) 的非目标边界。

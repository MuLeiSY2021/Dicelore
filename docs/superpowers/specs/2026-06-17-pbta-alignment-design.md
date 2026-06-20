# PbtA 术语对齐 + Agenda 层 + fail-forward + Front/Clock 设计蓝图

> 本 spec 是一次性重构蓝图。最终成果落 wiki(新立 ADR-0016 + 各页改动)。
> 决策来源:2026-06-17 brainstorming(英文 TRPG 设计正典调研 → 与现架构比对 → 全盘对齐)。
> 调研产物见对话;锚点见文末 Sources。

## 0. 背景与一句话结论

Dicelore 在 wiki 里独立重建出的 GM 行为塑形架构,本质就是 PbtA(Powered by the Apocalypse)那套 GM 架构的最硬核分支。区别只有一个但关键:

> **PbtA 靠社会约定 + 规则书文字,让人类 GM 自愿遵守纪律;Dicelore 面对的「GM」是一个有讨好本能、没有社交羞耻心的 LLM,所以凡是 PbtA 信任 GM 自律之处,Dicelore 都必须机械化强制。** 这正是三层模型(L1 工具强制 / L2 教条 / L3 审计)存在的根本理由。

本次把英文圈正典的「四块核心模式」沉淀进框架,并全盘对齐术语。

## 1. 对齐边界(已与用户拍定)

- **术语对齐深度 = 全盘对齐**:有 PbtA 对应物的术语升为框架一等术语,接受单向推导链回头路重扫。
- **边界 = 保留独有抽象**:Dicelore 独有的更强/正交抽象(`resolver 二轴` / `四业务域 sheet·event·world·rule` / `三层 L1·L2·L3` / `F1·F2·F3 失败模式诊断`)**保留原名不动**,不为对齐而硬套 PbtA 壳。
- **诚实仲裁者 = 立为 Agenda 第 0 条**,凌驾三条之上,作 Dicelore 与 PbtA 的分水岭。

## 2. 术语映射总表

### 2.1 改名对齐(有 PbtA 强对应物)

| 现术语 | 对齐后 | PbtA 出处 |
|---|---|---|
| `guideline`(L2 教条本体) | **GM 原则 / Principles** | DW GM's Principles |
| `dispatcher`(两道闸 + 形状表) | **GM 动作 / Moves**(形状表)+ **判定时机 / When to make a move**(两道闸) | DW GM Moves + When to make a move |
| `resolve_outcome` 档位表 | 概念对齐 **三档结果(完全 / 部分 / 失败)** —— 工具名 **不改**,只在文档说明它实现三档 | PbtA 10+ / 7–9 / 6- |

### 2.2 新增(PbtA 有、Dicelore 缺)

- **GM 议程 / Agenda**(顶层北极星):
  - **第 0 条(Dicelore 特有,凌驾)**:你是世界的诚实仲裁者,不是玩家的取悦者。
  - 1. **描绘一个会自己呼吸的世界(Portray a living world)** —— 世界有自己的因果、数值与进程(world / sheet / watcher 驱动),独立于玩家期望而存在,不是为取悦玩家布置的背景板。
  - 2. **让玩家的选择带来真实的后果(Make choices matter)** —— 把玩家当真:后果声明在先、骰子说了算;冒险感来自选择有重量,不是来自你安排的精彩桥段。
  - 3. **玩出来看会发生什么(Play to find out)** —— 你不预先知道结局,也不该朝某个满意的结局叙事;结局由骰子、watcher 和玩家的选择共同决定。
  - **价值**:给 F1/F2/F3 提供「为什么」的根。F2 软着陆同时违背第 2 条(后果不真)与第 3 条(朝预定结局叙事);F1 跳骰违背第 3 条。把 F 轴从「禁令」升级为「违背了你来这里的根本目的」——LLM 更吃这种约束。
  - **落点**:02 核心概念(L2 塑形层三段式 Agenda→Principles→Moves)+ 组件3 `dicelore-gm-core` 顶部恒驻 + adapter SessionStart 注入。

- **Front / 阵线 + Clock / 倒计时钟**(作者侧团本内容类型,建在已有 `watcher` + `sheet 钟`之上,非新底层机制)。详见 §4。

### 2.3 保留原名(Dicelore 独有抽象,一字不动)

`resolver 二轴模型` · `四业务域` · `三层 L1/L2/L3` · `F1/F2/F3 失败模式诊断` · **`watcher`(底层 sheet 数据触发器)**

**watcher / Front / Clock 厘清**:`watcher` 是比 Front/Clock 更通用的底层原语(任意 sheet 谓词触发),归独有抽象保留。`Clock`(倒计时钟)= `sheet 钟 attr + 监视它的 watcher` 的典型组合;`Front`(阵线)= 一组关联 Clock/watcher + 阶梯 payload。两者都是搭在 watcher 之上的高层团本内容单元。

## 3. C1 —— F2 双边护栏 + fail-forward craft

现有 F2(anti-软着陆)只防一边(别把坏结果洗成好结果 = anti-讨好)。补成双边:

> **坏结果既不能被洗成好结果(上边界:anti-讨好,原 F2),也不能退化成「什么都没发生」(下边界:anti-死胡同,新增)——要让它咬下去,并打开新局面。**

引入英文圈可教 craft(进 Principles 层 + 一张 `references/consequences.md`):

| 引入物 | 内容 | 落点 |
|---|---|---|
| **三档结果** | 完全成功 / 部分成功(成功但有代价)/ 失败有后果;零代价完全得手是例外 | 对齐 `resolve_outcome` 的 bands:团本作者写 band 的 `consequence` 时编码三档;教 AI 即兴设 bands 同此 |
| **软招 / 硬招(soft / hard move)** | 后果烈度调节:玩家只是看着你→软招(预告威胁、推进 Clock);玩家送黄金机会或骰出失败→硬招(扣血、触发 Front)。被无视的软招升级为硬招的黄金机会 | Principles,与「判定时机」配套 |
| **后果手法菜单** | Gnome Stew 12 条改编(切断退路 / 惩罚某类检定 / 失而复得要付代价 / 成功过头 / 施加 condition / 消耗资源 / 驱动末日钟……) | `references/consequences.md`(渐进披露按需载) |
| **末日钟(= Clock)** | 失败推进钟、钟满触发 Front——直接复用 §4 的 Clock,术语自洽 | 呼应 §4 |
| **「有时失败就是失败」** | 不推进剧情的检定允许直接失败,别硬给每次失败造后果 | Principles 平衡条 |

## 4. C3 —— Front / Clock 团本内容类型(落组件6)

现有团本包:`manifest.yaml + world/ + pools/ + params/ + rules/ + sheets/`。新增「会自己推进的世界压力源」:

```
fronts/
  魔族入侵.md      # frontmatter 声明 Clock;body 散文写阵线+利害;表格写凶兆阶梯
```

- **Clock** = front frontmatter 声明的 sheet 钟 attr(min/max/mode),即「sheet 钟 + watcher」组合,非新底层。
- **Front** = 名字 + 利害问题 + 一个 Clock + 阶梯式凶兆表(钟值 → payload),建在一组关联 watcher 上。

**import 映射(组件6 §7 「包→四域」加三行)**:

| front 部件 | 进哪个域 |
|---|---|
| frontmatter 钟定义 | `sheet`(钟 attr 初值 + visible) |
| 凶兆阶梯每行 | `watcher`(**预声明**,`condition={钟}>=N`、`payload=凶兆文本`、`armed=1`) |
| body 阵线散文 | `world_doc`(GM 运行期 `world_search` 取) |

**推进 ADR-0013**:0013 原裁「v1 由 AI 用工具创建 watcher;团本预声明 watcher 留未来」。PbtA 正典表明 Front(预置威胁 + 倒计时)是作者备团的核心单元;Dicelore watcher 底层早已就绪,只差「团本预声明」入口。故把「团本预声明 watcher(以 Front 形式)」从「留未来」**提前纳入 v1 设计蓝图**。追加式新 ADR 推进,不回改 0013 正文。

## 5. C4 —— 定位陈述 + 洋葱层旁证(纯阐释段)

1. **定位陈述**(放 02 核心概念 / L2 塑形层开头):见 §0 那句。
2. **洋葱层旁证**(放 03 三层模型那节):AW 的「洋葱层优雅坍缩」(漏外层退内层仍能玩)与 Dicelore 的「L2 漏 → L1 工具地板兜底 → L3 审计网」同性质——Dicelore 的轴是**强制力冗余**,AW 的轴是**规则复杂度回退**。佐证三层模型的韧性与正典同构。

## 6. 落地编排

### 6.1 受影响页(全盘改名一次扫全)

按单向推导 02 → 03 → 04 → 05:

- **02** 术语表 / 核心概念:术语对齐 + Agenda 三段式 + 定位陈述
- **03** 总体架构:guideline→Principles、dispatcher→Moves 改名;§5 加洋葱层旁证;resolve 三档(若提及)
- **03** TODO:同步改名
- **04** Skills包(组件3):本体大改 —— Agenda 层 + Principles + Moves + F2 双边 + fail-forward craft + `references/consequences.md`
- **04** 团本与manifest(组件6):新增 Front/Clock 节 + §7 import 映射加三行
- **04** MCP工具面:`resolve_outcome` 文档对齐三档;§2.2 互指改名
- **04** adapter:SessionStart 注入加 Agenda;guideline→Principles 改名
- **04** 内层能力库:`resolve_outcome` bands 三档语义注;watcher 处加 Front/Clock 上层封装互链
- **04** 04 TODO + README:账本段 + 状态
- **05** ADR README:新立 ADR-0016;旧 ADR(0012/0014 含 guideline 字样)不回改正文、加改名注解(沿用 0010 风格)

### 6.2 ADR 处理

- **新立 ADR-0016**:全盘对齐 PbtA 术语 + Agenda 层 + F2 双边护栏(fail-forward)+ Front/Clock 团本内容类型(推进 0013)。含被否方案:只锚注不改名 / 最大化套壳(连独有抽象也套)/ Front 仍留未来。
- 旧 ADR 0012:正文不回改,顶部加 `guideline 已统一更名为 Principles` 注解,与 0010 处理 `shot→reveal_once` 一致。

### 6.3 commit 切分(上游 → 下游)

- **commit A**:ADR-0016 + 02 全部(术语 / Agenda / 定位)—— 源头层
- **commit B**:03 + 04 + 05 改名注解(全盘改名回头路 + 各下游增项)

## Sources(英文 TRPG 设计正典锚点)

- Dungeon World SRD — Gamemastering(Agenda / Principles / Moves / soft·hard move):https://www.dungeonworldsrd.com/gamemastering/
- lumpley games — Powered by the Apocalypse, part 1(洋葱层优雅坍缩 / 虚构↔真实因果):https://lumpley.games/2019/12/30/powered-by-the-apocalypse-part-1/
- The Alexandrian — Ask #22: Why PbtA?(三档结果 / GM Moves 是唯一允许 / Fronts·Threats·Countdown Clocks):https://thealexandrian.net/wordpress/53218/roleplaying-games/ask-the-alexandrian-22-why-powered-by-the-apocalypse
- The Alexandrian — Node-Based Scenario Design / Three Clue Rule:https://thealexandrian.net/wordpress/8122/roleplaying-games/node-based-scenario-design-collectors-edition
- Gnome Stew — Failing Forward(后果手法菜单 / 末日钟):https://gnomestew.com/failing-forward-how-to-make-failure-interesting-in-rpgs
- Dyson's Dodecahedron — On the Five Room Dungeon:https://dysonlogos.blog/2022/07/04/on-the-five-room-dungeon

# 团本 manifest `flows` 字段断链排查

> 给开发的自包含排查工单。来源：silly_tavern 团本对比研究（`docs/research/silly_tavern/与dicelore架构对比.md`）引出的现状核查。
> 行号供参考,以当前 main 代码为准。

## 背景

dicelore 团本（Adventure）设计上能在 manifest 声明 `flows`——选用哪些流程 skill（`dicelore-flow-gacha`/`contest`/`anka`/`explore`）。运行时 dicegm 在 Moves 派发时据 flows 让位给对应 flow skill（`harness/src/dicegm/skills/dicelore-gm-core/SKILL.md:57-58`）。

但当前 build→pack→import 全链路断链:**作者声明不了、包里落不下、运行时读不到**。manifest 实际退化为只有 name+id。

## 期望链路

```
作者 build 时 set_manifest 声明 flows
  → Draft 存储 flows
  → toPackFiles 落进包文件
  → import 消费 flows
  → 灌进运行时 session/adventure 配置
  → dicegm 据此派发对应 flow skill
```

## 现状断点(4 处)

### 断点 1:build MCP 入口不收 flows
- `set_manifest` 只接受 `{name?, id?}`(`backend/src/build/buildMcp.ts:66`)
- 作者无法声明 flows/clock/entry/version/description

### 断点 2:Draft 不存 flows
- `Draft.setManifest` 只存 name/id(`backend/src/build/draft.ts:86-90`)
- 即使入口给了 flows 也没字段存

### 断点 3:pack 序列化不产 flows
- `toPackFiles` 只产 `manifest.md`(H1 name + `- id:` 一行,`draft.ts:145`)
- 不产设计态的 `manifest.yaml`,flows 落不到包文件

### 断点 4:import 不消费 flows
- `manifest.yaml` 不被 import 消费(`backend/src/catalog/import.ts:30`)
- import 只读 `manifest.md` 的 H1→adventureName(`import.ts:202-204`)
- 即使包里有 flows 也读不进运行时

## 设计↔实现形态漂移(疑似根因)

设计态是 `manifest.yaml`(结构化 YAML,含 flows/clock/entry/version/description,见 `docs/wiki/设计/04-子系统设计/团本与manifest.md:62-73`);实现态是 `manifest.md`(H1+id 两行)。

`validate.ts` 还在校验 `manifest.yaml` 的 flows 规则(`validate.ts:349-361`),但 build 产的是 `manifest.md`、import 读的是 `manifest.md`——**校验的对象和实际流转的对象不是同一个文件**。

## 需排查的问题

1. **运行时 genre 判定靠什么?** dicegm "判明 genre 后让位 flow skill"(`gm-core/SKILL.md:57-58`)当前靠 LLM 从 prologue/lore 推断,还是靠 flows 声明?若靠前者,flows 断链是否导致 flow skill 派发不可靠?
2. **import 灌进运行时的字段?** import 把 manifest 灌进 session_meta/adventure 配置的具体字段有哪些?flows 有没有落点?(参考 prologue 回传 session_meta 的做法 `import.ts:205-206`)
3. **validate 是否 dead code?** `validate.ts` 校验的 `manifest.yaml` 从哪来?build 产不出它,那这些 flows/clock/entry 校验规则(`validate.ts:349-391`)是不是在校验一个永远不存在的文件?
4. **clock/entry 同病?** `clock`(团本钟 attr)和 `entry`(开局锚点)与 flows 同属 manifest 富字段,是否同样断链?(`validate.ts:363-391` 也校验它们)
5. **修复路线选哪条:**
   - A. 走 `manifest.yaml`:build 产 yaml + import 消费 yaml(对齐设计文档,改动大)
   - B. 走 `manifest.md`:扩展 manifest.md 格式承载 flows(改动小,与设计文档形态不符)
   - C. 给 `manifest.md` 加 YAML frontmatter 承载 flows(折中:形态贴设计、改动可控)

## 关键文件

| 角色 | 路径 | 关键行 |
|------|------|--------|
| 设计 | `docs/wiki/设计/04-子系统设计/团本与manifest.md` | :62-73 flows 设计, :190-199 import 映射 |
| build MCP | `backend/src/build/buildMcp.ts` | :66 set_manifest 只收 name/id |
| Draft | `backend/src/build/draft.ts` | :86-90 setManifest, :142-171 toPackFiles, :145 manifest.md |
| import | `backend/src/catalog/import.ts` | :30 不消费 yaml, :202-204 读 manifest.md, :205-206 prologue→session_meta |
| validate | `backend/src/build/pack/validate.ts` | :32-36, :349-361 flows, :363-370 clock, :372-391 entry |
| 运行时 | `harness/src/dicegm/skills/dicelore-gm-core/SKILL.md` | :57-58 让位 flow skill |

## 影响范围

flows 断链不只是"流程 skill 选不了"——它是 manifest 富字段断链的表征。同一套富字段(flows/clock/entry/version/description)都可能是同病。修 flows 时建议一并核查 clock/entry,避免修一条漏两条。

更上游的影响:对比研究指出 dicelore 当前**团本不能声明难度/门禁/驱动模式**——这些若未来要加,出口也是 manifest 富字段。所以 flows 断链的修复方案选择(A/B/C)要考虑到后续还会往 manifest 加字段,选一个能扩展的形态。

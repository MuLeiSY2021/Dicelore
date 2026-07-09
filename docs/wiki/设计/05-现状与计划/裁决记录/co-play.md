# 裁决：co-play —— 跑团页每轮内联 per-turn token

- [X]  用户已批准本裁决（勾上前视为未裁决，不可进交付波）

> 路线图项：里程碑二 · CO 前端可视化（跑团页部分）。依赖 [usage-stream](usage-stream.md)（turn_ended.usage 契约）先合。
> 来源：用户 2026-06-30——「per-turn 放在跑团页每一轮里，随 session 走，不单独查询」。

## 设计（零不确定，仅剩代码实现）

### 1. useSession：扁平 narration → 按回合分组

现状 `narration: string[]`（`narration_commit` 追加文本、无回合边界），无法「按轮」内联。改为按回合分组：

```ts
interface Round { texts: string[]; usage?: UsageTotals }  // UsageTotals 从 shared 引
const [rounds, setRounds] = useState<Round[]>([]);
```

- `turn_started`：`setRounds(r => [...r, { texts: [] }])`（开新回合）。
- `narration_commit`：把 `msg.text` 追加进**当前（末尾）回合**的 `texts`。
- `turn_ended`：把 `msg.usage`（usage-stream 提供，可能 undefined）写进当前回合的 `usage`；`setGenerating(false)`。
- 会话切换 reset 时 `setRounds([])`（与现 `setNarration([])` 同处）。
- **兼容**：保留导出一个 `narration` 扁平 getter（`rounds.flatMap(r=>r.texts)`）供暂未迁的消费者；新增导出 `rounds`。

### 2. 单价表 + 估价（新文件 frontend/src/features/cost/pricing.ts）

```ts
// 每百万 token 单价(USD)。default 兜底未知 model。值可后续按真实计价改——这是数据不是逻辑。
export const PRICING: Record<string, { in:number; out:number; cacheRead:number; cacheWrite:number }> = {
  default: { in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};
export function estimateCostUsd(u: UsageTotals, model = "default"): number {
  const p = PRICING[model] ?? PRICING.default;
  return (u.inputTokens*p.in + u.outputTokens*p.out + u.cacheReadTokens*p.cacheRead + u.cacheCreationTokens*p.cacheWrite) / 1e6;
}
```

（单价默认值是占位，用户/部署可改；估价逻辑零不确定。）

### 3. PlayPage：每回合块尾内联一行

每个 `Round` 渲染时，在该回合 narration 块**末尾**加一行小字脚注（不打断叙事、墨金弱化色）：

- 有 usage：`⟨{in+out} tok · ≈${estimateCostUsd}⟩`，hover/title 展开四类明细（in/out/cacheRead/cacheWrite）。
- 无 usage（旧消息/FAKE）：不渲染该行。
- 文案走 i18n（`play.usage.perTurn` 等键，中/英）。

## 验收

- useSession 单测：turn_started/commit/turn_ended 序列 → `rounds` 正确分组 + usage 落到对应回合；切会话 reset 清空。
- estimateCostUsd 单测：四类 token × 单价求和 / 1e6；未知 model 走 default。
- PlayPage 渲染单测：有 usage 的回合显示 token+估价行、无 usage 不显示。
- `typecheck` + frontend `test` 绿；web 改动走 `/webapp-testing`（chromium 未装则退单测层，记 follow-up）。

## owns（预期触及，非独占）

`frontend/src/features/play/useSession.ts`、`frontend/src/features/play/PlayPage.tsx`、`frontend/src/features/cost/pricing.ts`（新）+ i18n 键。**可能与 sec2-fe 在别处重叠**——本需求不碰 client.ts（co-play 数据走 WS 流、非 HTTP）。

## 完成后

沉淀进 [04-子系统设计/玩家客户端-视觉](../../04-子系统设计/玩家客户端-视觉.md)（每轮成本内联）+ 关 backlog CO-前端条目 + 勾路线图；删本裁决文件。

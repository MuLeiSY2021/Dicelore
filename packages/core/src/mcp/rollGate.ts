// packages/core/src/mcp/rollGate.ts
// 明骰阻塞接缝:组件7(orchestrator)注入 gate=「通知前端待掷 + await 玩家点击」;
// 裸 CC 不注入 → 明骰 handler 降级为立即 commit。core 只定接缝,不实现阻塞/WS。
export type RollGate = (eventId: number) => Promise<void>;

let _gate: RollGate | undefined;
export function setRollGate(g: RollGate | undefined): void { _gate = g; }
export function getRollGate(): RollGate | undefined { return _gate; }

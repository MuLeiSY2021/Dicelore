import type { DB } from "@dicelore/core";
import { buildPresentationModel } from "@dicelore/core";
import { CLIENT_PROTOCOL, type PresentationSnapshot, type SheetGroup } from "@dicelore/shared";

// core PresentationModel → 接口页 §1 线上快照。core 纯函数已按 visible 过滤(全为 visible=1)。
export function buildSnapshot(db: DB, sessionId: string): PresentationSnapshot {
  const model = buildPresentationModel(db, { turnStartSeq: 0 }); // 全量快照：取所有可见机械事实

  // statusMenu(VisibleCell[]) → 按 entity 分组、保序
  const groups: SheetGroup[] = [];
  const byEntity = new Map<string, SheetGroup>();
  for (const c of model.statusMenu) {
    let g = byEntity.get(c.entity);
    if (!g) { g = { entity: c.entity, cells: [] }; byEntity.set(c.entity, g); groups.push(g); }
    g.cells.push({ attr: c.attr, value: c.value, visible: 1 });
  }

  const choices = model.pendingChoice
    ? {
        eventId: model.pendingChoice.seq,
        options: model.pendingChoice.options.map((o, index) => ({
          index, label: o.label, consequence: o.consequence,
        })),
      }
    : null;

  return {
    protocol: CLIENT_PROTOCOL,
    sessionId,
    seq: maxSeq(db),
    sheets: groups,
    mechanics: model.mechanicalEcho.map((e) => ({ seq: e.seq, kind: e.kind, text: e.text })),
    choices,
    narrativeCursor: narrativeCursor(db),
  };
}

function maxSeq(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM event").get() as { s: number | null };
  return r.s ?? 0;
}
function narrativeCursor(db: DB): number {
  const r = db.prepare("SELECT MAX(seq) s FROM event WHERE kind='narrate'").get() as { s: number | null };
  return r.s ?? 0;
}

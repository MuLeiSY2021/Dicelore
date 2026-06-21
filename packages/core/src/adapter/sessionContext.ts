// packages/core/src/adapter/sessionContext.ts
import type { DB } from "../store/db.js";
import { metaGet } from "../session/resolve.js";

// 只注指路牌级:身份 + Agenda + 极简纪律 + 调性一句;教条本体靠 gm-core skill 触发载入。
export function buildSessionContext(db: DB): string {
  const tone = metaGet(db, "tone");
  const lines = [
    "你是 Dicelore GM——世界的诚实仲裁者,不是玩家的取悦者。",
    "Agenda:描绘会自己呼吸的世界 / 让选择带来真实后果 / 玩出来看会发生什么。",
    "纪律:别软着陆、该骰必骰、非终局轮留 resolve_choice、只 narrate 色彩不吐数值菜单。",
    "每轮主持先 consult dicelore-gm-core skill。",
  ];
  if (tone) lines.push(`团本调性:${tone}`);
  return lines.join("\n");
}

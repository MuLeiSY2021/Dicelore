import { readdirSync } from "node:fs";
import type { SessionSummary } from "@dicelore/shared";

// 枚举 dir 下的 *.db 文件，映射为会话摘要(按文件名排序)。目录不存在/不可读 → []。
export function listSessionSummaries(dir: string): SessionSummary[] {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".db"))
    .sort()
    .map((f) => {
      const sessionId = f.slice(0, -".db".length);
      return { sessionId, title: sessionId, status: "active" as const };
    });
}

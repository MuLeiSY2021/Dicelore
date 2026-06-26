// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { Fragment, type ReactNode } from "react";

// 极简 markdown → React,零依赖。覆盖 GM 叙事常用:段落 / 标题(#) / 无序列表(-,*) /
// 行内 **粗** *斜* `码`。不支持嵌套/表格/链接——GM 散文用不到,刻意从简(YAGNI)。
//
// ⚠️ 安全铁律(防 XSS 回归):本组件**只**通过 React 子节点输出文本——React 默认转义,
// 任何 GM/玩家文本里的 <script>、<img onerror=...> 等都被当纯文本转义,不会变成真实 DOM。
// 严禁在此文件引入 `dangerouslySetInnerHTML` 或任何把原始字符串当 HTML 注入的写法
// (innerHTML / DOMParser→appendChild / 第三方 HTML→DOM)。GM 文本是不可信输入,必须保持
// 「文本进、文本出」。见 Markdown.test.tsx 的 XSS 防回归用例。

function inline(text: string, kb: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={`${kb}-${i}`}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={`${kb}-${i}`}>{m[2]}</em>);
    else if (m[3] !== undefined) out.push(<code key={`${kb}-${i}`}>{m[3]}</code>);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }): ReactNode {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((blk, bi) => {
        const lines = blk.split("\n");
        if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
          return (
            <ul key={bi}>
              {lines.map((l, li) => <li key={li}>{inline(l.trim().replace(/^[-*]\s+/, ""), `${bi}-${li}`)}</li>)}
            </ul>
          );
        }
        const h = /^(#{1,3})\s+(.+)$/.exec(blk);
        if (h) {
          const Tag = `h${h[1].length + 2}` as "h3" | "h4" | "h5";
          return <Tag key={bi}>{inline(h[2], String(bi))}</Tag>;
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { createHash } from "node:crypto";

// 固定 dicelore 命名空间(写死的常量 UUID)。
const NS = "6f1d8c2a-3b4e-5a6f-8c9d-0e1f2a3b4c5d";

function hexToBytes(hex: string): number[] {
  return hex.replace(/-/g, "").match(/.{2}/g)!.map((b) => parseInt(b, 16));
}

// RFC 4122 v5: SHA-1(namespace-bytes ++ name) → 前 16 字节,打 version/variant 位。
export function uuidv5(name: string, namespace: string = NS): string {
  const nsBytes = Buffer.from(hexToBytes(namespace));
  const hash = createHash("sha1").update(Buffer.concat([nsBytes, Buffer.from(name, "utf8")])).digest();
  const b = Array.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

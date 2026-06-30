// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import type { DB } from "./db.js";

// ═══════════════════════════════════════════════════════════════════════════
// SEC2 模型 API key 后端托管（ADR-0027 定稿：统一后端托管）
//
// 病根（2026-06-25 全量体检 CROSS-KEY/P1）：key 明文存前端 localStorage、明文随 body
// 发后端。裁决——key 一律存后端、加密落库、前端只存引用（key_id），调用时由后端代发。
//
// 加密：env 主密钥（DICELORE_KEY_MASTER，32 字节 hex/base64）+ AES-256-GCM 对称加密。
//   - 每条独立随机 12 字节 IV；GCM 16 字节认证标签防篡改/防错主密钥静默解出垃圾。
//   - 落库格式 ciphertext = ivHex:tagHex:cipherHex。**明文绝不落库**（单测断言原始行无明文）。
//   - 主密钥不落库、不进快照/FTS/usage——纯 env 注入，换机器重配。
//   - GET 元信息端点只回 key_id/label/provider/createdAt，永不解密回明文；解密只在
//     「后端代发模型请求」链路经 revealKey()，不经任何对外只读端点。
// ═══════════════════════════════════════════════════════════════════════════

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export class KeyMasterMissingError extends Error {
  constructor() {
    super("缺主密钥：未配置 DICELORE_KEY_MASTER，拒绝以明文落库/解密 key");
    this.name = "KeyMasterMissingError";
  }
}

// 主密钥规整为 32 字节 Buffer。空 → KeyMasterMissingError；长度不对 → 抛错（拒弱密钥）。
// 接受 64 位 hex 或 44 位 base64（标准 32 字节编码），否则视为无效。
function masterKeyBuf(master: string): Buffer {
  if (!master) throw new KeyMasterMissingError();
  let buf: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(master)) buf = Buffer.from(master, "hex");
  else {
    const b = Buffer.from(master, "base64");
    if (b.length === 32) buf = b;
  }
  if (!buf || buf.length !== 32) {
    throw new Error("主密钥无效：DICELORE_KEY_MASTER 须为 32 字节（64 位 hex 或 base64）");
  }
  return buf;
}

function encrypt(plain: string, master: string): string {
  const key = masterKeyBuf(master);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decrypt(blob: string, master: string): string {
  const key = masterKeyBuf(master);
  const parts = blob.split(":");
  // 须恰为 iv:tag:data 三段；iv/tag 必非空，data 可为空(空明文的合法密文，dataHex="")。
  if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error("密文格式损坏");
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  // GCM final() 在认证标签不匹配（错主密钥/被篡改）时抛错——不返回垃圾明文。
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

// 对外元信息（永不含明文/密文）。
export interface KeyMeta {
  keyId: string;
  label: string;
  provider: string;
  createdAt: string;
}

export interface StoreKeyInput {
  label: string;
  provider: string;
  secret: string;
}

function rowToMeta(r: { key_id: string; label: string; provider: string; created_at: string }): KeyMeta {
  return { keyId: r.key_id, label: r.label, provider: r.provider, createdAt: r.created_at };
}

// 存一条 key：加密明文 → 落库 → 回元信息（含新 key_id，不回明文）。
export function storeKey(db: DB, input: StoreKeyInput, master: string): KeyMeta {
  const keyId = randomUUID();
  const ciphertext = encrypt(input.secret, master);
  db.prepare(
    `INSERT INTO api_key (key_id, label, provider, ciphertext) VALUES (?, ?, ?, ?)`,
  ).run(keyId, input.label, input.provider, ciphertext);
  return getKeyMeta(db, keyId)!;
}

export function getKeyMeta(db: DB, keyId: string): KeyMeta | null {
  const r = db
    .prepare(`SELECT key_id, label, provider, created_at FROM api_key WHERE key_id=?`)
    .get(keyId) as Parameters<typeof rowToMeta>[0] | undefined;
  return r ? rowToMeta(r) : null;
}

export function listKeyMeta(db: DB): KeyMeta[] {
  const rows = db
    .prepare(`SELECT key_id, label, provider, created_at FROM api_key ORDER BY rowid`)
    .all() as Parameters<typeof rowToMeta>[0][];
  return rows.map(rowToMeta);
}

// 删除：删到了返回 true，本就不存在返回 false（幂等）。
export function deleteKey(db: DB, keyId: string): boolean {
  const info = db.prepare(`DELETE FROM api_key WHERE key_id=?`).run(keyId);
  return info.changes > 0;
}

// 解回明文——仅供「后端代发模型请求」链路，绝不经对外只读端点。不存在的 id 抛错。
export function revealKey(db: DB, keyId: string, master: string): string {
  const r = db.prepare(`SELECT ciphertext FROM api_key WHERE key_id=?`).get(keyId) as
    | { ciphertext: string }
    | undefined;
  if (!r) throw new Error(`key 不存在: ${keyId}`);
  return decrypt(r.ciphertext, master);
}

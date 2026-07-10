// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkSsrf, createDiagnosticsApp } from "./diagnostics.js";

// SSRF 白名单（SEC2）：model-test/mcp-test 发起探测前校验 baseUrl/endpoint。
// 裁决：挡私网/环回/元数据 IP 段 + 限 https；外部 host 走配置放行。

describe("checkSsrf — 协议限制", () => {
  it("拒绝 http（仅允许 https）", async () => {
    const r = await checkSsrf("http://api.anthropic.com/v1/models");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/https/);
  });
  it("拒绝 file:// 等非 http(s) 协议", async () => {
    expect((await checkSsrf("file:///etc/passwd")).ok).toBe(false);
    expect((await checkSsrf("ftp://10.0.0.1/")).ok).toBe(false);
  });
  it("拒绝非法 URL", async () => {
    expect((await checkSsrf("not a url")).ok).toBe(false);
  });
});

describe("checkSsrf — 字面量 IP 挡私网/环回/元数据段", () => {
  const blocked = [
    ["云元数据 169.254.169.254", "https://169.254.169.254/latest/meta-data/"],
    ["环回 127.0.0.1", "https://127.0.0.1:8443/"],
    ["环回 127.x.x.x 全段", "https://127.5.6.7/"],
    ["私网 A 10.x", "https://10.0.0.5/"],
    ["私网 B 172.16-31", "https://172.20.1.1/"],
    ["私网 B 边界 172.31", "https://172.31.255.255/"],
    ["私网 C 192.168", "https://192.168.1.1/"],
    ["链路本地 169.254", "https://169.254.1.1/"],
    ["CGNAT 100.64", "https://100.64.0.1/"],
    ["未指定 0.0.0.0", "https://0.0.0.0/"],
    ["IPv6 环回 ::1", "https://[::1]:9000/"],
    ["IPv6 ULA fc00::", "https://[fc00::1]/"],
    ["IPv6 链路本地 fe80::", "https://[fe80::1]/"],
    ["IPv4-mapped ::ffff:127.0.0.1（绕过尝试）", "https://[::ffff:127.0.0.1]/"],
    ["IPv4-mapped ::ffff:169.254.169.254", "https://[::ffff:169.254.169.254]/"],
  ] as const;

  for (const [name, url] of blocked) {
    it(`拒绝 ${name}`, async () => {
      const r = await checkSsrf(url);
      expect(r.ok).toBe(false);
      expect(r.reason).toBeTruthy();
    });
  }

  it("172.15 不在私网 B 段（边界外）→ 字面量公网 IP 放行", async () => {
    expect((await checkSsrf("https://172.15.0.1/")).ok).toBe(true);
  });
  it("172.32 不在私网 B 段（边界外）→ 放行", async () => {
    expect((await checkSsrf("https://172.32.0.1/")).ok).toBe(true);
  });
  it("正常公网字面量 IP 放行（8.8.8.8）", async () => {
    expect((await checkSsrf("https://8.8.8.8/")).ok).toBe(true);
  });
});

describe("checkSsrf — 域名走 DNS 解析后判段", () => {
  it("放行 allowHosts 集合内的 host（不做 DNS）", async () => {
    const r = await checkSsrf("https://api.anthropic.com/v1/models", new Set(["api.anthropic.com"]));
    expect(r.ok).toBe(true);
  });
  it("allowHost 大小写不敏感", async () => {
    const r = await checkSsrf("https://API.Anthropic.COM/v1/models", new Set(["api.anthropic.com"]));
    expect(r.ok).toBe(true);
  });
  it("解析到私网段的域名被拒（挡 DNS rebinding / 内网域名）", async () => {
    // localhost 通常解析到 127.0.0.1 / ::1，均在黑段。
    const r = await checkSsrf("https://localhost:8443/");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/私网|环回|元数据|解析/);
  });
});

describe("POST /diagnostics/model-test — SSRF 拦截", () => {
  let app: ReturnType<typeof createDiagnosticsApp>;
  const post = (body: unknown) =>
    app.request("/diagnostics/model-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
    app = createDiagnosticsApp({ port: 8080, fakeGm: false });
  });

  it("baseUrl 指向云元数据 169.254.169.254 → 400 拒绝，不发请求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await post({ baseUrl: "https://169.254.169.254" });
    expect(res.status).toBe(400);
    const j = (await res.json()) as { ok: boolean; message: string };
    expect(j.ok).toBe(false);
    expect(j.message).toMatch(/被拒/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("baseUrl 指向 127.0.0.1 → 拒绝", async () => {
    const res = await post({ baseUrl: "https://127.0.0.1:11434" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });

  it("baseUrl 指向 10.x 内网 → 拒绝", async () => {
    const res = await post({ baseUrl: "https://10.1.2.3" });
    expect(res.status).toBe(400);
  });

  it("http baseUrl → 拒绝（限 https）", async () => {
    const res = await post({ baseUrl: "http://example.com" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toMatch(/https/);
  });

  it("FAKE 模式短路，不校验也不发请求", async () => {
    const fakeApp = createDiagnosticsApp({ port: 8080, fakeGm: true });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await fakeApp.request("/diagnostics/model-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: "https://169.254.169.254" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { fake: boolean }).fake).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("正常外部 https host 放行 → 真发请求（mock fetch）", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await post({ baseUrl: "https://api.anthropic.com" });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.anthropic.com/v1/models");
    fetchSpy.mockRestore();
  });

  it("放行用户已配 ANTHROPIC_BASE_URL host（即便它是某外部域名）", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic";
    app = createDiagnosticsApp({ port: 8080, fakeGm: false });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await post({}); // 不传 baseUrl，落到 env
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });
});

describe("POST /diagnostics/mcp-test — SSRF 拦截", () => {
  let app: ReturnType<typeof createDiagnosticsApp>;
  const post = (body: unknown) =>
    app.request("/diagnostics/mcp-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  beforeEach(() => {
    app = createDiagnosticsApp({ port: 8080, fakeGm: false });
  });

  it("endpoint 指向云元数据 → 400 拒绝，不发请求", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await post({ transport: "sse", endpoint: "https://169.254.169.254/sse" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("endpoint 指向 192.168 内网 → 拒绝", async () => {
    const res = await post({ transport: "sse", endpoint: "https://192.168.0.1/sse" });
    expect(res.status).toBe(400);
  });

  it("http endpoint → 拒绝（限 https）", async () => {
    const res = await post({ transport: "sse", endpoint: "http://example.com/sse" });
    expect(res.status).toBe(400);
  });

  it("缺 endpoint → 400（既有行为保持）", async () => {
    const res = await post({ transport: "sse", endpoint: "" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toMatch(/缺少/);
  });

  it("stdio transport 不走 SSRF（本地命令真拉起探测；坏命令→502）", async () => {
    // stdio 是本地命令而非 URL，不经 SSRF 白名单；改为真按 stdio 拉起 + 握手(custom-mcp-install)。
    // 不存在的命令 → spawn 失败 → ok:false + 502（非 SSRF 400）。
    const res = await post({ transport: "stdio", command: "/definitely/not/a/real/cmd", args: [] });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });

  it("正常外部 https endpoint（解析到公网）放行 → 真发请求（mock fetch）", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }));
    // example.com 解析到公网 IP，放行后真打 fetch（已 mock）。
    // 离线环境 DNS 可能失败 → checkSsrf 拒绝；两种结局都不应是「未校验直接放行私网」。
    const res = await post({ transport: "sse", endpoint: "https://example.com/sse" });
    if (fetchSpy.mock.calls.length > 0) {
      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledOnce();
    } else {
      // DNS 解析失败被拒——可接受，但必须是 400 拒绝而非误放
      expect(res.status).toBe(400);
    }
    fetchSpy.mockRestore();
  });
});

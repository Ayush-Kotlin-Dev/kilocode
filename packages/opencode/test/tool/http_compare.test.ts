import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { HttpCompareTool } from "../../src/tool/http_compare"
import { AuthStateTool } from "../../src/tool/auth_state"
import { tmpdir } from "../fixture/fixture"

const projectRoot = path.join(import.meta.dir, "../..")

const ctx = {
  sessionID: "test",
  messageID: "message",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

async function withFetch(
  mockFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as unknown as typeof fetch
  try {
    await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

describe("tool.http_compare", () => {
  test("compares baseline and candidate responses", async () => {
    let count = 0
    await withFetch(
      async () => {
        count += 1
        const body =
          count === 1
            ? { role: "guest", quota: 1, canDelete: false }
            : { role: "admin", quota: 999, canDelete: true }
        return new Response(JSON.stringify(body), {
          status: count === 1 ? 200 : 403,
          statusText: count === 1 ? "OK" : "Forbidden",
          headers: { "content-type": "application/json" },
        })
      },
      async () => {
        await Instance.provide({
          directory: projectRoot,
          fn: async () => {
            const tool = await HttpCompareTool.init()
            const result = await tool.execute(
              {
                requests: [
                  { label: "anon", url: "https://api.example.com/v1/me", method: "GET" },
                  { label: "auth", url: "https://api.example.com/v1/me", method: "GET" },
                ],
              },
              ctx,
            )
            const parsed = JSON.parse(result.output)
            expect(parsed.requests).toHaveLength(2)
            expect(parsed.differences[0].changedStatus).toBe(true)
            expect(parsed.differences[0].changedBody).toBe(true)
            expect(parsed.differences[0].jsonPaths).toContain("$.role")
            expect(parsed.differences[0].jsonPaths).toContain("$.quota")
          },
        })
      },
    )
  })

  test("uses stored auth profiles for compared requests", async () => {
    const seen = [] as string[]
    await withFetch(
      async (_input, init) => {
        const headers = new Headers(init?.headers)
        seen.push(headers.get("Authorization") ?? "none")
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
      async () => {
        await using tmp = await tmpdir({})
        await Instance.provide({
          directory: tmp.path,
          fn: async () => {
            const auth = await AuthStateTool.init()
            await auth.execute(
              {
                action: "upsert",
                host: "api.example.com",
                headers: { Authorization: "Bearer stored-token" },
              },
              ctx,
            )
            const tool = await HttpCompareTool.init()
            await tool.execute(
              {
                requests: [
                  { label: "anon", url: "https://api.example.com/v1/resource", method: "GET" },
                  {
                    label: "auth",
                    url: "https://api.example.com/v1/resource",
                    method: "GET",
                    auth_profile: "api.example.com",
                  },
                ],
              },
              ctx,
            )
            expect(seen[0]).toBe("none")
            expect(seen[1]).toBe("Bearer stored-token")
          },
        })
      },
    )
  })
})

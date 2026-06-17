import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { HttpRequestTool } from "../../src/tool/http_request"
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

describe("tool.http_request", () => {
  test("returns non-2xx responses as evidence instead of throwing", async () => {
    await withFetch(
      async () =>
        new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          statusText: "Forbidden",
          headers: { "content-type": "application/json" },
        }),
      async () => {
        await Instance.provide({
          directory: projectRoot,
          fn: async () => {
            const tool = await HttpRequestTool.init()
            const result = await tool.execute(
              {
                url: "https://api.example.com/private",
                method: "GET",
              },
              ctx,
            )
            const parsed = JSON.parse(result.output)
            expect(parsed.status).toBe(403)
            expect(parsed.ok).toBe(false)
            expect(parsed.body.error).toBe("forbidden")
          },
        })
      },
    )
  })

  test("sends stored auth headers and request body for mutations", async () => {
    let seen: RequestInit | undefined
    await withFetch(
      async (_input, init) => {
        seen = init
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
                headers: {
                  Authorization: "Bearer stored-token",
                },
              },
              ctx,
            )
            const tool = await HttpRequestTool.init()
            await tool.execute(
              {
                url: "https://api.example.com/v1/billing",
                method: "POST",
                auth_profile: "api.example.com",
                body: JSON.stringify({ plan: "pro" }),
              },
              ctx,
            )
            const headers = new Headers(seen?.headers)
            expect(seen?.method).toBe("POST")
            expect(seen?.body).toBe(JSON.stringify({ plan: "pro" }))
            expect(headers.get("Authorization")).toBe("Bearer stored-token")
            expect(headers.get("Content-Type")).toBe("application/json")
          },
        })
      },
    )
  })
})

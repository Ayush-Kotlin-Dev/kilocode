import { describe, expect, test } from "bun:test"
import { AuthStateTool } from "../../src/tool/auth_state"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

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

describe("tool.auth_state", () => {
  test("imports auth headers from a curl command", async () => {
    await using tmp = await tmpdir({})
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await AuthStateTool.init()
        const result = await tool.execute(
          {
            action: "import_curl",
            command:
              "curl 'https://api.example.com/v1/me' -H 'Authorization: Bearer abc123' -H 'Cookie: sid=xyz' -H 'X-Test: one'",
          },
          ctx,
        )
        const parsed = JSON.parse(result.output)
        expect(parsed.host).toBe("api.example.com")
        expect(parsed.headers.Authorization).toBe("Bearer abc123")
        expect(parsed.headers.Cookie).toBe("sid=xyz")
        expect(parsed.headers["X-Test"]).toBe("one")
        expect(parsed.source).toBe("curl")
      },
    })
  })

  test("stores and returns manual auth headers", async () => {
    await using tmp = await tmpdir({})
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await AuthStateTool.init()
        await tool.execute(
          {
            action: "upsert",
            host: "api.example.com",
            headers: {
              Authorization: "Bearer token123",
            },
            note: "manual import",
          },
          ctx,
        )
        const result = await tool.execute({ action: "get", id: "api.example.com" }, ctx)
        const parsed = JSON.parse(result.output)
        expect(parsed.host).toBe("api.example.com")
        expect(parsed.headers.Authorization).toBe("Bearer token123")
        expect(parsed.note).toBe("manual import")
      },
    })
  })

  test("imports browser style curl with --header and --cookie flags", async () => {
    await using tmp = await tmpdir({})
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await AuthStateTool.init()
        const result = await tool.execute(
          {
            action: "import_curl",
            command: `curl 'https://api.example.com/v1/billing' \\
  --header 'Authorization: Bearer abc123' \\
  --header 'X-Org: red' \\
  --cookie 'sid=xyz; theme=dark'`,
          },
          ctx,
        )
        const parsed = JSON.parse(result.output)
        expect(parsed.host).toBe("api.example.com")
        expect(parsed.headers.Authorization).toBe("Bearer abc123")
        expect(parsed.headers["X-Org"]).toBe("red")
        expect(parsed.headers.Cookie).toBe("sid=xyz; theme=dark")
      },
    })
  })
})

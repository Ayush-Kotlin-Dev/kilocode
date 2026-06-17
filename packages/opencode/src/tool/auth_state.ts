import z from "zod"
import { AuthState } from "@/kilocode/auth-state"
import { Tool } from "./tool"
import DESCRIPTION from "./auth_state.txt"

const Params = z
  .object({
    action: z.enum(["get", "list", "summary", "reset", "upsert", "import_curl", "remove"]),
    id: z.string().optional(),
    host: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    note: z.string().optional(),
    command: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.action === "upsert" && (!input.host || !input.headers)) {
      if (!input.host) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "host is required for upsert", path: ["host"] })
      }
      if (!input.headers) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "headers is required for upsert",
          path: ["headers"],
        })
      }
    }
    if (input.action === "import_curl" && !input.command) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "command is required for import_curl",
        path: ["command"],
      })
    }
    if (input.action === "remove" && !input.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "id is required for remove", path: ["id"] })
    }
  })

export const AuthStateTool = Tool.define("auth_state", {
  description: DESCRIPTION,
  parameters: Params,
  async execute(input, ctx) {
    await ctx.ask({
      permission: "auth_state",
      patterns: ["*"],
      always: ["*"],
      metadata: {
        action: input.action,
        id: input.id,
        host: input.host,
        headerNames: Object.keys(input.headers ?? {}),
      },
    })

    const result = await (async () => {
      switch (input.action) {
        case "get":
          return AuthState.get(input.id)
        case "list":
          return AuthState.list()
        case "summary":
          return AuthState.summary()
        case "reset":
          await AuthState.reset()
          return { ok: true }
        case "upsert":
          return AuthState.upsert({
            id: input.id,
            host: input.host!,
            headers: input.headers!,
            note: input.note,
            source: "manual",
          })
        case "import_curl":
          return AuthState.importCurl(input.command!, input.id, input.note)
        case "remove":
          return AuthState.remove(input.id!)
      }
    })()

    return {
      title: `auth_state.${input.action}`,
      output: JSON.stringify(result, null, 2),
      metadata: {
        action: input.action,
      },
    }
  },
})

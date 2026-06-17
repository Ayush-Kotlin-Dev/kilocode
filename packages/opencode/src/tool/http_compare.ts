import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./http_compare.txt"
import { abortAfterAny } from "../util/abort"
import { AuthState } from "@/kilocode/auth-state"

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_TIMEOUT = 30 * 1000 // 30 seconds
const MAX_TIMEOUT = 120 * 1000 // 2 minutes

const Request = z.object({
  label: z.string().optional(),
  url: z.string(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).default("GET"),
  headers: z.record(z.string(), z.string()).optional(),
  auth_profile: z.string().optional(),
  body: z.string().optional(),
})

type Body = string | number | boolean | null | Body[] | { [key: string]: Body }

function maybeJSON(body: string): Body | string {
  const text = body.trim()
  if (!text) return body
  if (!text.startsWith("{") && !text.startsWith("[")) return body
  try {
    return JSON.parse(text) as Body
  } catch {
    return body
  }
}

function inferType(body?: string) {
  if (!body) return undefined
  const text = body.trim()
  if (!text) return undefined
  if (text.startsWith("{") || text.startsWith("[")) return "application/json"
  return undefined
}

function diffJSON(a: Body, b: Body, path = "$", out: string[] = []) {
  if (typeof a !== typeof b) {
    out.push(path)
    return out
  }
  if (a === null || b === null) {
    if (a !== b) out.push(path)
    return out
  }
  if (typeof a !== "object" || typeof b !== "object") {
    if (a !== b) out.push(path)
    return out
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      out.push(path)
      return out
    }
    for (let i = 0; i < a.length; i++) {
      diffJSON(a[i] as Body, b[i] as Body, `${path}[${i}]`, out)
    }
    return out
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const key of keys) {
    if (!(key in a) || !(key in b)) {
      out.push(`${path}.${key}`)
      continue
    }
    diffJSON((a as Record<string, Body>)[key], (b as Record<string, Body>)[key], `${path}.${key}`, out)
  }
  return out
}

async function executeRequest(params: z.infer<typeof Request>, abort: AbortSignal, timeout?: number) {
  if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
    throw new Error("URL must start with http:// or https://")
  }
  const profile = params.auth_profile ? await AuthState.resolve(params.url, params.auth_profile) : undefined
  const authHeaders = profile?.headers ?? {}
  const extraHeaders = params.headers ?? {}
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain;q=0.9, text/html;q=0.8, */*;q=0.1",
    "Accept-Language": "en-US,en;q=0.9",
    ...authHeaders,
    ...extraHeaders,
  }
  const inferred = inferType(params.body)
  if (params.body && inferred && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = inferred
  }
  const ms = Math.min((timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT)
  const { signal, clearTimeout } = abortAfterAny(ms, abort)
  const response = await fetch(params.url, {
    method: params.method,
    headers,
    body: params.body,
    signal,
  })
  clearTimeout()

  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
    throw new Error("Response too large (exceeds 5MB limit)")
  }
  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
    throw new Error("Response too large (exceeds 5MB limit)")
  }

  const contentType = response.headers.get("content-type") || ""
  const mime = contentType.split(";")[0]?.trim().toLowerCase() || ""
  const text = new TextDecoder().decode(arrayBuffer)
  const body = mime.includes("json") ? maybeJSON(text) : text

  return {
    label: params.label ?? `${params.method} ${params.url}`,
    method: params.method,
    url: params.url,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  }
}

export const HttpCompareTool = Tool.define("http_compare", {
  description: DESCRIPTION,
  parameters: z.object({
    requests: z.array(Request).min(2).describe("Requests to execute and compare"),
    timeout: z.number().optional().describe("Optional timeout in seconds (max 120)"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "http_compare",
      patterns: params.requests.map((item) => item.url),
      always: ["*"],
      metadata: {
        requests: params.requests.map((item) => ({
          label: item.label,
          url: item.url,
          method: item.method,
          bodyLength: item.body?.length ?? 0,
          headerNames: Object.keys(item.headers ?? {}),
          authProfile: item.auth_profile,
        })),
      },
    })

    const results = [] as Awaited<ReturnType<typeof executeRequest>>[]
    for (const item of params.requests) {
      results.push(await executeRequest(item, ctx.abort, params.timeout))
    }

    const base = results[0]
    const diffs = results.slice(1).map((item) => {
      const changedStatus = item.status !== base.status
      const changedBody = JSON.stringify(item.body) !== JSON.stringify(base.body)
      const jsonPaths =
        typeof base.body === "object" &&
        base.body !== null &&
        typeof item.body === "object" &&
        item.body !== null &&
        !Array.isArray(base.body) === !Array.isArray(item.body)
          ? diffJSON(base.body as Body, item.body as Body)
          : []
      return {
        base: base.label,
        candidate: item.label,
        changedStatus,
        changedBody,
        jsonPaths,
      }
    })

    return {
      title: `http_compare ${results.length} requests`,
      output: JSON.stringify(
        {
          baseline: base.label,
          requests: results,
          differences: diffs,
        },
        null,
        2,
      ),
      metadata: {
        count: results.length,
      },
    }
  },
})

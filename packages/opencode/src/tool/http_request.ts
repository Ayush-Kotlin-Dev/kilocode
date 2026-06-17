import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./http_request.txt"
import { abortAfterAny } from "../util/abort"
import { AuthState } from "@/kilocode/auth-state"

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_TIMEOUT = 30 * 1000 // 30 seconds
const MAX_TIMEOUT = 120 * 1000 // 2 minutes

function maybeJSON(body: string) {
  const text = body.trim()
  if (!text) return body
  if (!text.startsWith("{") && !text.startsWith("[")) return body
  try {
    return JSON.parse(text)
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

export const HttpRequestTool = Tool.define("http_request", {
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to request"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
      .default("GET")
      .describe("HTTP method to use"),
    headers: z.record(z.string(), z.string()).optional().describe("Optional request headers"),
    auth_profile: z.string().optional().describe("Optional stored auth profile ID or host to merge into the request"),
    body: z.string().optional().describe("Optional raw request body"),
    timeout: z.number().optional().describe("Optional timeout in seconds (max 120)"),
  }),
  async execute(params, ctx) {
    if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://")
    }

    const profile = params.auth_profile ? await AuthState.resolve(params.url, params.auth_profile) : undefined
    const authHeaders = profile?.headers ?? {}
    const extraHeaders = params.headers ?? {}
    const headerNames = [...new Set([...Object.keys(authHeaders), ...Object.keys(extraHeaders)])]

    await ctx.ask({
      permission: "http_request",
      patterns: [params.url],
      always: ["*"],
      metadata: {
        url: params.url,
        method: params.method,
        timeout: params.timeout,
        authProfile: profile?.id,
        headerNames,
        bodyLength: params.body?.length ?? 0,
      },
    })

    const timeout = Math.min((params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT)
    const { signal, clearTimeout } = abortAfterAny(timeout, ctx.abort)
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
      title: `${params.method} ${params.url} (${response.status})`,
      output: JSON.stringify(
        {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        },
        null,
        2,
      ),
      metadata: {
        ok: response.ok,
        status: response.status,
        mime,
      },
    }
  },
})

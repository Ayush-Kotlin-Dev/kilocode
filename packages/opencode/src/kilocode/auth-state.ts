import z from "zod"
import { Instance } from "../project/instance"
import { Storage } from "../storage/storage"

export namespace AuthState {
  export const Profile = z.object({
    id: z.string(),
    host: z.string(),
    headers: z.record(z.string(), z.string()).default({}),
    source: z.enum(["manual", "curl"]).default("manual"),
    note: z.string().optional(),
    created: z.number().default(() => Date.now()),
    updated: z.number().default(() => Date.now()),
  })
  export type Profile = z.infer<typeof Profile>

  export const State = z.object({
    profiles: z.array(Profile).default([]),
  })
  export type State = z.infer<typeof State>

  function key() {
    return ["auth", Instance.project.id]
  }

  async function read(): Promise<State> {
    const data = await Storage.read<State>(key()).catch((err) => {
      if (err instanceof Storage.NotFoundError) return null
      throw err
    })
    if (data) return data
    const initial: State = { profiles: [] }
    await Storage.write(key(), initial)
    return initial
  }

  async function write(state: State) {
    await Storage.write(key(), state)
  }

  function cleanHost(value: string) {
    return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  }

  function capture(command: string, expr: RegExp) {
    return Array.from(command.matchAll(expr)).map((match) => match[2]).filter(Boolean)
  }

  function pairs(lines: string[]) {
    return lines
      .map((line) => {
        const idx = line.indexOf(":")
        if (idx === -1) return undefined
        const key = line.slice(0, idx).trim()
        const value = line.slice(idx + 1).trim()
        if (!key || !value) return undefined
        return [key, value] as const
      })
      .filter((item): item is readonly [string, string] => !!item)
  }

  function parseCurl(command: string) {
    const url = command.match(/https?:\/\/[^\s"'\\]+/)?.[0]
    if (!url) throw new Error("Could not find a URL in the curl command")
    const host = new URL(url).hostname
    const lines = capture(command, /(?:^|\s)(?:-H|--header)\s+(['"])([\s\S]*?)\1/g)
    const cookies = capture(command, /(?:^|\s)(?:-b|--cookie)\s+(['"])([\s\S]*?)\1/g)
    const headers = Object.fromEntries(pairs(lines))
    if (!headers.Cookie && cookies.length > 0) headers.Cookie = cookies.join("; ")
    return { host, headers }
  }

  export async function get(id?: string) {
    const state = await read()
    if (!id) return state
    const key = cleanHost(id)
    return state.profiles.find((profile) => profile.id === key || profile.host === key)
  }

  export async function list() {
    return (await read()).profiles
  }

  export async function upsert(input: {
    id?: string
    host: string
    headers: Record<string, string>
    note?: string
    source?: "manual" | "curl"
  }) {
    const state = await read()
    const host = cleanHost(input.host)
    const id = cleanHost(input.id ?? host)
    const now = Date.now()
    const next: Profile = {
      id,
      host,
      headers: input.headers,
      note: input.note,
      source: input.source ?? "manual",
      created: now,
      updated: now,
    }
    const idx = state.profiles.findIndex((profile) => profile.id === id)
    if (idx === -1) {
      state.profiles.push(next)
      await write(state)
      return next
    }
    const prev = state.profiles[idx]
    const merged: Profile = {
      ...prev,
      ...next,
      created: prev.created,
      updated: now,
    }
    state.profiles[idx] = merged
    await write(state)
    return merged
  }

  export async function importCurl(command: string, id?: string, note?: string) {
    const parsed = parseCurl(command)
    return upsert({
      id,
      host: parsed.host,
      headers: parsed.headers,
      note,
      source: "curl",
    })
  }

  export async function remove(id: string) {
    const state = await read()
    const key = cleanHost(id)
    state.profiles = state.profiles.filter((profile) => profile.id !== key && profile.host !== key)
    await write(state)
    return state
  }

  export async function resolve(url: string, id?: string) {
    const state = await read()
    const key = cleanHost(id ?? new URL(url).hostname)
    return state.profiles.find((profile) => profile.id === key || profile.host === key)
  }

  export async function reset() {
    await write({ profiles: [] })
  }

  export async function summary() {
    const state = await read()
    return {
      profiles: state.profiles.length,
      hosts: state.profiles.map((profile) => profile.host),
    }
  }
}

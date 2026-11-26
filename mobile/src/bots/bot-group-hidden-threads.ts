import AsyncStorage from '@react-native-async-storage/async-storage'
import type { BotGroupMessage, BotGroupThread } from '../../../src/shared/bots/bot-group'

export const HIDDEN_GROUP_THREADS_STORAGE_KEY = 'orca.custom.botGroupHiddenThreads'

type HiddenThreadsMap = Record<string, string[]>

function roomStorageKey(hostId: string, groupId: string): string {
  return `${hostId}:${groupId}`
}

async function readHiddenThreadsMap(): Promise<HiddenThreadsMap> {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_GROUP_THREADS_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as HiddenThreadsMap
    }
  } catch {
    // Ignore storage parse/read errors and fall back to empty map.
  }
  return {}
}

export async function loadHiddenGroupThreads(
  hostId: string,
  groupId: string
): Promise<ReadonlySet<string>> {
  const map = await readHiddenThreadsMap()
  const ids = map[roomStorageKey(hostId, groupId)]
  return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
}

export async function hideGroupThread(
  hostId: string,
  groupId: string,
  threadId: string
): Promise<ReadonlySet<string>> {
  const map = await readHiddenThreadsMap()
  const key = roomStorageKey(hostId, groupId)
  const next = new Set(Array.isArray(map[key]) ? map[key] : [])
  next.add(threadId)
  map[key] = [...next]
  try {
    await AsyncStorage.setItem(HIDDEN_GROUP_THREADS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage write errors.
  }
  return next
}

export function filterVisibleBotGroupThreads(
  threads: readonly BotGroupThread[] | undefined,
  hiddenIds: ReadonlySet<string>
): BotGroupThread[] {
  if (!threads || threads.length === 0) {
    return []
  }
  return threads.filter((thread) => !hiddenIds.has(thread.id))
}

const URL_REGEX = /https?:\/\/[^\s`"'<>)\]}，。！？、；：]+/gi

function isLocalDevUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url)
}

/** Finds the newest http(s) URL mentioned in group messages (preferring local preview URLs). */
export function extractLatestGroupUrl(
  messages: readonly Pick<BotGroupMessage, 'text' | 'turns'>[] | undefined
): string | null {
  if (!messages || messages.length === 0) {
    return null
  }
  let fallbackUrl: string | null = null
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!
    const candidates: string[] = []
    for (let j = message.turns.length - 1; j >= 0; j -= 1) {
      const turn = message.turns[j]
      if (turn?.answer) {
        candidates.push(turn.answer)
      }
    }
    if (message.text) {
      candidates.push(message.text)
    }
    for (const chunk of candidates) {
      const matches = chunk.match(URL_REGEX)
      if (!matches) {
        continue
      }
      for (let k = matches.length - 1; k >= 0; k -= 1) {
        const cleaned = matches[k]!.replace(/[.,;:!?]+$/, '')
        if (!cleaned) {
          continue
        }
        if (isLocalDevUrl(cleaned)) {
          return cleaned
        }
        fallbackUrl ??= cleaned
      }
    }
  }
  return fallbackUrl
}

export type GroupWorkspaceTab = Readonly<{
  id: string
  type: 'browser' | 'terminal' | 'markdown'
  title: string
  url?: string
  browserPageId?: string
}>

/** Extracts browser, terminal, and markdown tabs from a `session.tabs.list` response payload. */
export function parseGroupWorkspaceTabs(raw: unknown): GroupWorkspaceTab[] {
  if (!raw || typeof raw !== 'object' || !('tabs' in raw)) {
    return []
  }
  const tabs = (raw as { tabs?: unknown }).tabs
  if (!Array.isArray(tabs)) {
    return []
  }
  const out: GroupWorkspaceTab[] = []
  for (const item of tabs) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const type = row.type
    if (!id || (type !== 'browser' && type !== 'terminal' && type !== 'markdown')) {
      continue
    }
    const url = typeof row.url === 'string' && row.url.trim().length > 0 ? row.url.trim() : undefined
    const title =
      (typeof row.title === 'string' && row.title.trim()) ||
      (typeof row.relativePath === 'string' && row.relativePath.trim()) ||
      url ||
      (type === 'browser' ? '浏览器' : type === 'markdown' ? 'Markdown 笔记' : '终端')
    const browserPageId = typeof row.browserPageId === 'string' ? row.browserPageId : undefined
    out.push({ id, type, title, ...(url ? { url } : {}), ...(browserPageId ? { browserPageId } : {}) })
  }
  return out
}

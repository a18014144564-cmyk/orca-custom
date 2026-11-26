import { describe, expect, it } from 'vitest'
import {
  extractLatestGroupUrl,
  filterVisibleBotGroupThreads,
  parseGroupWorkspaceTabs
} from './bot-group-hidden-threads'
import type { BotGroupMessage, BotGroupThread } from '../../../src/shared/bots/bot-group'

describe('bot-group-hidden-threads', () => {
  it('filters out hidden/deleted threads while keeping visible ones in order', () => {
    const threads = [
      { id: 't1', createdAt: 1, members: [], title: '话题 1' },
      { id: 't2', createdAt: 2, members: [] },
      { id: 't3', createdAt: 3, members: [], title: '话题 3' }
    ] as BotGroupThread[]

    const visible = filterVisibleBotGroupThreads(threads, new Set(['t2']))
    expect(visible.map((t) => t.id)).toEqual(['t1', 't3'])
  })

  it('extracts the newest local preview URL from bot group messages even inside backticks', () => {
    const messages = [
      {
        text: '请检查 https://github.com/a18014144564-cmyk/fengshen/pull/59',
        turns: []
      },
      {
        text: '复验一下',
        turns: [
          {
            answer:
              '已重启就绪，您现在直接刷新 `http://127.0.0.1:8899` 就可以验收界面啦，或者看 https://example.com。'
          }
        ]
      }
    ] as unknown as Pick<BotGroupMessage, 'text' | 'turns'>[]

    expect(extractLatestGroupUrl(messages)).toBe('http://127.0.0.1:8899')
  })

  it('parses browser, terminal, and markdown tabs from session.tabs.list payload', () => {
    const parsed = parseGroupWorkspaceTabs({
      tabs: [
        { id: 'ag-1', type: 'agent-session', title: 'Chat' },
        {
          id: 'br-1',
          type: 'browser',
          title: '采集方式 · 风神',
          url: 'http://127.0.0.1:8899/workbench',
          browserPageId: 'page-1'
        },
        { id: 'tm-1', type: 'terminal', title: 'PowerShell' },
        { id: 'md-1', type: 'markdown', title: '', relativePath: 'notes.md' }
      ]
    })

    expect(parsed).toEqual([
      {
        id: 'br-1',
        type: 'browser',
        title: '采集方式 · 风神',
        url: 'http://127.0.0.1:8899/workbench',
        browserPageId: 'page-1'
      },
      { id: 'tm-1', type: 'terminal', title: 'PowerShell' },
      { id: 'md-1', type: 'markdown', title: 'notes.md' }
    ])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

const STORE_KEY = '__nanobotsConversationThreadStore'

function seedStore(conversationId, record) {
  const store = (globalThis).__nanobotsConversationThreadStore || new Map()
  store.set(conversationId, record)
  ;(globalThis).__nanobotsConversationThreadStore = store
}

function clearStore() {
  delete (globalThis).__nanobotsConversationThreadStore
}

describe('conversation-thread-store branch coverage', () => {
  afterEach(() => {
    clearStore()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('buildConversationThreadMessages returns stored messages when present', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const { buildConversationThreadMessages } = await import(
      '@/lib/chat/conversation-thread-store'
    )

    seedStore('conv-msg', {
      messages: [{ id: 'm1', role: 'operator', text: 'hello' }],
      controlRoomState: null,
      controlRoomExecutionSource: null,
    })

    const messages = buildConversationThreadMessages('conv-msg')
    expect(messages.length).toBeGreaterThan(1)
    expect(messages[messages.length - 1].text).toBe('hello')
  })

  it('buildConversationThreadMessages returns only initial message for unknown id', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const { buildConversationThreadMessages } = await import(
      '@/lib/chat/conversation-thread-store'
    )

    const messages = buildConversationThreadMessages('conv-unknown')
    expect(messages.length).toBe(1)
  })

  it('buildConversationThreadState returns unavailable state when record has no execution source', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const { buildConversationThreadState } = await import(
      '@/lib/chat/conversation-thread-store'
    )

    // Pre-seed record with no execution source
    seedStore('conv-no-exec', {
      messages: [],
      controlRoomState: null,
      controlRoomExecutionSource: null,
    })

    const result = await buildConversationThreadState('conv-no-exec')
    expect(result.controlRoomState.nextRecommendedAction).toContain('Capture')
  })

  it('loads persisted sync panel state into the thread record when evidence sync state exists', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const {
      buildConversationThreadState,
    } = await import('@/lib/chat/conversation-thread-store')
    const {
      seedEvidenceSyncState,
    } = await import('@/lib/db/evidence-sync-state')

    seedEvidenceSyncState('conv-sync-panel', {
      conversationId: 'conv-sync-panel',
      updatedAt: '2026-03-29T12:15:00.000Z',
      sources: [
        {
          sourceId: 'github:acme/api',
          sourceType: 'github',
          repo: 'acme/api',
          connectedAt: '2026-03-29T12:00:00.000Z',
          lastSyncedAt: null,
          status: 'connected',
        },
      ],
      evidenceRecords: [],
    })

    const result = await buildConversationThreadState('conv-sync-panel')
    expect(result.syncPanelState?.connectedSources).toEqual([
      expect.objectContaining({
        sourceId: 'github:acme/api',
      }),
    ])
  })

  it('hydrates persisted sync panel state alongside a stored control-gap record', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const { buildConversationThreadState } = await import(
      '@/lib/chat/conversation-thread-store'
    )
    const { seedEvidenceSyncState } = await import('@/lib/db/evidence-sync-state')
    const { createDefaultControlGapState } = await import('@/lib/chat/control-gap-state')

    seedStore('conv-sync-gap', {
      messages: [],
      controlRoomState: null,
      controlRoomExecutionSource: undefined,
      controlGapState: createDefaultControlGapState('conv-sync-gap'),
    })
    seedEvidenceSyncState('conv-sync-gap', {
      conversationId: 'conv-sync-gap',
      updatedAt: '2026-03-29T12:15:00.000Z',
      sources: [
        {
          sourceId: 'github:acme/api',
          sourceType: 'github',
          repo: 'acme/api',
          connectedAt: '2026-03-29T12:00:00.000Z',
          lastSyncedAt: null,
          status: 'connected',
        },
      ],
      evidenceRecords: [],
    })

    const result = await buildConversationThreadState('conv-sync-gap')
    expect(result.controlRoomState.missingEvidence).toContain('Release approval screenshot')
    expect(result.syncPanelState?.syncHealth.value).toBe('Sync pending')
  })

  it('hydrates persisted sync panel state alongside stored execution and control room state fallbacks', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const { loadConversationSyncPanelState } = await import(
      '@/lib/chat/conversation-thread-store'
    )
    const { seedEvidenceSyncState } = await import('@/lib/db/evidence-sync-state')

    seedStore('conv-sync-exec', {
      messages: [],
      controlRoomState: null,
      controlRoomExecutionSource: {
        exceptionExportSource: {
          browserCapturePhase: 'standby',
          releaseVerificationPhase: 'at-risk',
        },
        monitoringExportStatusSource: {
          phase: 'preview',
          controlId: null,
        },
      },
      controlGapState: undefined,
    })
    seedEvidenceSyncState('conv-sync-exec', {
      conversationId: 'conv-sync-exec',
      updatedAt: '2026-03-29T12:15:00.000Z',
      sources: [],
      evidenceRecords: [],
    })
    expect((await loadConversationSyncPanelState('conv-sync-exec'))?.syncHealth.value).toBe(
      'No sources connected'
    )

    seedStore('conv-sync-control-room', {
      messages: [],
      controlRoomState: {
        nextRecommendedAction: 'fallback',
        missingEvidence: 'fallback evidence',
      },
      controlRoomExecutionSource: undefined,
      controlGapState: undefined,
    })
    seedEvidenceSyncState('conv-sync-control-room', {
      conversationId: 'conv-sync-control-room',
      updatedAt: '2026-03-29T12:15:00.000Z',
      sources: [],
      evidenceRecords: [],
    })
    expect(
      (await loadConversationSyncPanelState('conv-sync-control-room'))?.syncHealth.detail
    ).toContain('Connect a GitHub repository')
  })

  it('preserves existing thread messages when hydrating persisted sync panel state', async () => {
    vi.doMock('@/lib/chat/control-room-execution-source-seed', async () => ({
      QUEUED_CONTROL_ROOM_EXECUTION_SOURCE: { exceptionExportSource: {}, monitoringExportStatusSource: {} },
      loadPersistedControlRoomExecutionSource: async () => null,
      savePersistedControlRoomExecutionSource: async () => {},
    }))

    const { loadConversationSyncPanelState, buildConversationThreadMessages } = await import(
      '@/lib/chat/conversation-thread-store'
    )
    const { seedEvidenceSyncState } = await import('@/lib/db/evidence-sync-state')

    seedStore('conv-sync-messages', {
      messages: [{ id: 'm2', role: 'assistant', text: 'persist me' }],
      controlRoomState: {
        nextRecommendedAction: 'fallback',
        missingEvidence: 'fallback evidence',
      },
      controlRoomExecutionSource: undefined,
      controlGapState: undefined,
    })
    seedEvidenceSyncState('conv-sync-messages', {
      conversationId: 'conv-sync-messages',
      updatedAt: '2026-03-29T12:15:00.000Z',
      sources: [],
      evidenceRecords: [],
    })

    await loadConversationSyncPanelState('conv-sync-messages')
    const messages = buildConversationThreadMessages('conv-sync-messages')
    expect(messages[messages.length - 1].text).toBe('persist me')
  })
})

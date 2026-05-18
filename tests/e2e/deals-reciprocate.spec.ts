import { test, expect } from '@playwright/test'

// API base used by the app in dev. Mirrors src/lib/env.ts default.
const API = 'http://localhost:8000/api/v1'

const FOUNDER_USER = {
  id: 'user-1',
  email: 'founder@test.local',
  full_name: 'Test Founder',
  role: 'founder',
  onboarding_completed: true,
  email_verified: true,
}

const PENDING_INTEREST = {
  id: 'interest-1',
  startup: 'startup-1',
  startup_name: 'Acme Robotics',
  investor: 'investor-1',
  investor_name: 'Sequoia Capital',
  expressed_by_name: 'Jane Investor',
  // Investor reached out to the founder — so from the founder's POV this is "incoming".
  direction: 'investor_to_founder',
  message: 'Loved your demo at YC Demo Day. Would love to talk.',
  created_at: '2026-05-10T12:00:00Z',
}

const NEW_DEAL_ROOM_ID = 'room-7'
const NEW_CONVERSATION_ID = 'conv-7'

test.describe('DealsPage – reciprocate (Accept) flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth tokens BEFORE app boot so AuthProvider skips straight to
    // the authenticated state and ProtectedRoute lets us into /app/*.
    await page.addInitScript(() => {
      localStorage.setItem('ff_access_token', 'fake-access')
      localStorage.setItem('ff_refresh_token', 'fake-refresh')
    })

    // Register the catch-all FIRST so it sits at the bottom of Playwright's
    // LIFO route stack — every later, more-specific route() in beforeEach or
    // the test body gets a shot before this falls through. Empty payloads
    // for any unmocked GET keep the UI from throwing when the backend
    // doesn't exist; non-GETs and known deals/auth paths fall through to
    // the specific mocks below.
    await page.route(`${API}/**`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      const url = req.url()
      if (url.includes('/deals/') || url.includes('/users/me')) return route.fallback()
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    // Mock the auth bootstrap — AuthProvider hits /users/me/ on mount.
    // Registered AFTER the catch-all so LIFO matches this one first for
    // the literal /users/me/ URL.
    await page.route(`${API}/users/me/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FOUNDER_USER) })
    })
  })

  test('shows Accept button on an incoming pending interest and navigates to the new room after click', async ({
    page,
  }) => {
    // Initial DealsPage state: no rooms, one incoming interest waiting on us.
    await page.route(`${API}/deals/rooms/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/deals/my-interests/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([PENDING_INTEREST]),
      })
    })

    // Mock the POST that the Accept button fires. The backend returns
    // mutual=true with a deal_room_id, which should trigger navigation.
    let postBody: Record<string, unknown> | null = null
    await page.route(`${API}/deals/interest/`, async (route, req) => {
      if (req.method() !== 'POST') return route.continue()
      postBody = JSON.parse(req.postData() || '{}')
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Mutual interest! A deal room has been created.',
          mutual: true,
          deal_room_id: NEW_DEAL_ROOM_ID,
        }),
      })
    })

    // The deal-room detail page will fetch this once we navigate; return a
    // minimal-but-valid payload so the page doesn't crash on render.
    // conversation_id is the deal-room chat thread the Discussion button
    // deep-links into and the inline DealRoomChat embed binds to.
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: NEW_DEAL_ROOM_ID,
          startup: { id: PENDING_INTEREST.startup, name: PENDING_INTEREST.startup_name },
          investor: { id: PENDING_INTEREST.investor, display_name: PENDING_INTEREST.investor_name },
          status: 'pending_nda',
          nda_signed_by_founder: false,
          nda_signed_by_investor: false,
          nda_fully_signed: false,
          documents: [],
          conversation_id: NEW_CONVERSATION_ID,
          created_at: new Date().toISOString(),
        }),
      })
    })

    // Inline chat — initial message fetch. Backend returns most-recent
    // first; the component reverses for display. msg-3 carries an
    // attachment so the chip renderer is exercised without going through
    // the upload path.
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/messages/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'msg-3',
            conversation: NEW_CONVERSATION_ID,
            sender_id: 'user-99',
            sender_name: 'Jane Investor',
            content: 'Term sheet attached.',
            message_type: 'file',
            attachment_url: '/media/chat/term-sheet.pdf',
            attachment_name: 'term-sheet.pdf',
            attachment_size: 245_000,
            attachment_mime_type: 'application/pdf',
            created_at: '2026-05-18T12:02:00Z',
          },
          {
            id: 'msg-2',
            conversation: NEW_CONVERSATION_ID,
            sender_id: FOUNDER_USER.id,
            sender_name: FOUNDER_USER.full_name,
            content: 'Looking forward to it.',
            message_type: 'text',
            created_at: '2026-05-18T12:01:00Z',
          },
          {
            id: 'msg-1',
            conversation: NEW_CONVERSATION_ID,
            sender_id: 'user-99',
            sender_name: 'Jane Investor',
            content: 'Welcome to the deal room.',
            message_type: 'text',
            created_at: '2026-05-18T12:00:00Z',
          },
        ]),
      })
    })

    // Edit endpoint — echoes the new content + edited_at timestamp.
    await page.route(`${API}/chat/messages/msg-2/edit/`, async (route, req) => {
      if (req.method() !== 'PUT') return route.fallback()
      const body = JSON.parse(req.postData() || '{}') as { content?: string }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'edited',
          message_id: 'msg-2',
          content: body.content ?? '',
          edited_at: new Date().toISOString(),
        }),
      })
    })

    // Delete endpoint — 204 No Content. The component removes locally.
    await page.route(`${API}/chat/messages/**/delete/`, async (route, req) => {
      if (req.method() !== 'DELETE') return route.fallback()
      await route.fulfill({ status: 204, body: '' })
    })

    // Reaction toggle — return the updated summary.
    await page.route(`${API}/chat/messages/**/reactions/toggle/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      const body = JSON.parse(req.postData() || '{}') as { emoji?: string }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'added',
          summary: { [body.emoji ?? '👍']: 1 },
          user_reactions: [body.emoji ?? '👍'],
        }),
      })
    })

    // Mark-as-read is fire-and-forget — return 204 No Content so the
    // component's catch arm doesn't see an error.
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/read/`, async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    // REST fallback for sending a message — the e2e has no WebSocket so
    // DealRoomChat will fall through to this endpoint. Echo the body back
    // with a fresh id, mirroring the real backend's shape.
    await page.route(
      `${API}/chat/conversations/${NEW_CONVERSATION_ID}/messages/create/`,
      async (route, req) => {
        if (req.method() !== 'POST') return route.fallback()
        const body = JSON.parse(req.postData() || '{}') as { content?: string }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'msg-new',
            conversation: NEW_CONVERSATION_ID,
            sender_id: FOUNDER_USER.id,
            sender_name: FOUNDER_USER.full_name,
            content: body.content ?? '',
            message_type: 'text',
            created_at: new Date().toISOString(),
          }),
        })
      },
    )

    await page.goto('/app/deals')

    // The app-startup <Preloader> is a fixed overlay at z-99999999999 that
    // covers the viewport for ~1s before sliding up. toBeVisible() doesn't
    // check occlusion, so without this wait our screenshots capture the
    // splash instead of the page. The Preloader unmounts entirely after its
    // exit animation, so waitFor('detached') is the right gate.
    await page.locator('svg path.fill-background').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})

    // The pending section should render with one incoming card.
    const pendingSection = page.getByTestId('pending-interests-section')
    await expect(pendingSection).toBeVisible({ timeout: 10_000 })

    const incomingCard = page.getByTestId('pending-interest-incoming')
    await expect(incomingCard).toBeVisible()
    await expect(incomingCard).toContainText('Acme Robotics')
    await expect(incomingCard).toContainText('Sequoia Capital')
    await expect(incomingCard).toContainText('Jane Investor')

    // The Accept button is the headline change in this PR — verify it exists,
    // is enabled, and shows the right copy.
    const acceptBtn = page.getByTestId(`reciprocate-${PENDING_INTEREST.id}`)
    await expect(acceptBtn).toBeVisible()
    await expect(acceptBtn).toBeEnabled()
    await expect(acceptBtn).toContainText(/accept/i)

    // Capture the pending state. fullPage: true so reviewers see the whole
    // viewport including the sidebar, not just a cropped card.
    await page.screenshot({ path: 'tests/e2e/screenshots/deals-pending-incoming.png', fullPage: true })

    // Click Accept. Expect navigation to the new deal-room detail page.
    await Promise.all([
      page.waitForURL(`**/app/deals/${NEW_DEAL_ROOM_ID}`, { timeout: 10_000 }),
      acceptBtn.click(),
    ])

    // Verify the POST body matched what the backend expects.
    expect(postBody).toEqual({
      startup_id: PENDING_INTEREST.startup,
      investor_id: PENDING_INTEREST.investor,
    })

    // After waitForURL the route changed but DealRoomDetailPage is lazy-loaded
    // and still in Suspense. Wait for the deal-room header ("Acme Robotics ×
    // Sequoia Capital") which only that page renders, so the screenshot
    // captures the new room view rather than the previous page mid-transition.
    await expect(
      page.getByRole('heading', { name: /Acme Robotics × Sequoia Capital/i }),
    ).toBeVisible({ timeout: 10_000 })

    // The old top-header Discussion link has been removed — chat now
    // embeds inline next to the workflow column, so the deep-link button
    // would be redundant. Assert it's no longer in the DOM so we don't
    // silently regress to dual surfaces.
    await expect(page.getByTestId('deal-room-discussion-link')).toHaveCount(0)

    // Inline chat — the embedded thread should be visible alongside the
    // workflow/NDA/Documents sections. Assert messages render with the
    // sender names from the mocked payload, and the composer is enabled.
    const chat = page.getByTestId('deal-room-chat')
    await expect(chat).toBeVisible()
    await expect(chat.getByText('Welcome to the deal room.')).toBeVisible()
    await expect(chat.getByText('Looking forward to it.')).toBeVisible()
    // The "Jane Investor" sender label appears for the non-own message.
    // Scope to one specific message since msg-1 and msg-3 share a sender.
    await expect(
      page.getByTestId('deal-room-chat-message-msg-1').getByText('Jane Investor'),
    ).toBeVisible()

    const composer = page.getByTestId('deal-room-chat-composer')
    await expect(composer).toBeVisible()
    await expect(composer).toBeEnabled()

    // Type and send a message via the REST fallback (no WS server in this
    // e2e). The intercepted POST gets back an echo with a new id; the
    // component appends it locally.
    await composer.fill('Sounds great — when are you free this week?')
    await page.getByTestId('deal-room-chat-send').click()
    await expect(chat.getByText('Sounds great — when are you free this week?')).toBeVisible({
      timeout: 5_000,
    })

    // Attachment chip — msg-3 has an attachment_url/name in the mocked
    // payload, so the chip should render with the filename.
    const attachmentChip = chat.getByTestId('deal-room-chat-attachment-msg-3')
    await expect(attachmentChip).toBeVisible()
    await expect(attachmentChip).toContainText('term-sheet.pdf')

    // Edit own message (msg-2). Hover to reveal the action menu, click
    // Edit, change the text, save, then assert the new content is in
    // the bubble and the "edited" suffix is rendered.
    const ownMessage = page.getByTestId('deal-room-chat-message-msg-2')
    await ownMessage.hover()
    await page.getByTestId('deal-room-chat-edit-btn-msg-2').click()
    const editTextarea = page.getByTestId('deal-room-chat-edit-msg-2')
    await editTextarea.fill('Actually, looking forward to it!')
    await page.getByTestId('deal-room-chat-edit-save-msg-2').click()
    await expect(chat.getByText('Actually, looking forward to it!')).toBeVisible()
    await expect(ownMessage).toContainText('edited')

    // React to Jane's first message (msg-1) using the picker. The bubble
    // gets a reaction badge with count=1 after the optimistic update.
    const otherMessage = page.getByTestId('deal-room-chat-message-msg-1')
    await otherMessage.hover()
    await page.getByTestId('deal-room-chat-react-btn-msg-1').click()
    await page.getByTestId('deal-room-chat-reaction-pick-👍').click()
    await expect(page.getByTestId('deal-room-chat-reaction-msg-1-👍')).toBeVisible()

    // Capture the new room view with inline chat populated, edited
    // message, attachment, and reaction all visible.
    await page.screenshot({ path: 'tests/e2e/screenshots/deals-room-after-accept.png', fullPage: true })

    // Delete a message. The mock returns 204 and the component removes
    // the row locally — assert it's gone from the DOM.
    // Re-hover (the previous hover/click may have left the menu state
    // dangling) and click delete. Browser confirm() needs to be auto-
    // accepted.
    page.once('dialog', (dialog) => dialog.accept())
    // We just made the new send have a server-assigned id of 'msg-new'
    // (from the create endpoint mock). Delete that.
    const newOwnMessage = page.getByTestId('deal-room-chat-message-msg-new')
    await newOwnMessage.hover()
    await page.getByTestId('deal-room-chat-delete-btn-msg-new').click()
    await expect(newOwnMessage).toHaveCount(0, { timeout: 5_000 })
  })

  test('outgoing pending interest shows "Awaiting them" badge and no Accept button', async ({ page }) => {
    await page.route(`${API}/deals/rooms/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/deals/my-interests/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            ...PENDING_INTEREST,
            id: 'interest-2',
            // Founder sent this — so from the founder's POV it's "outgoing".
            direction: 'founder_to_investor',
            expressed_by_name: 'Test Founder',
          },
        ]),
      })
    })

    await page.goto('/app/deals')

    const outgoingCard = page.getByTestId('pending-interest-outgoing')
    await expect(outgoingCard).toBeVisible({ timeout: 10_000 })
    await expect(outgoingCard).toContainText('Awaiting them')
    // No Accept button on outgoing — the other side has the action.
    await expect(page.getByTestId('reciprocate-interest-2')).toHaveCount(0)
  })

  test('inline chat applies real-time message.edited / message.deleted / reaction.update WS events', async ({
    page,
  }) => {
    // Pre-existing messages to mutate via WS frames.
    const peerMessage = {
      id: 'peer-msg-1',
      conversation: NEW_CONVERSATION_ID,
      sender_id: 'user-99',
      sender_name: 'Jane Investor',
      content: 'Original content',
      message_type: 'text',
      created_at: '2026-05-18T12:00:00Z',
    }
    const ownMessage = {
      id: 'own-msg-1',
      conversation: NEW_CONVERSATION_ID,
      sender_id: FOUNDER_USER.id,
      sender_name: FOUNDER_USER.full_name,
      content: 'My side',
      message_type: 'text',
      created_at: '2026-05-18T12:00:30Z',
    }

    // Same room mock as the accept-flow test, but landing directly so we
    // don't have to drive the accept UI.
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: NEW_DEAL_ROOM_ID,
          startup: { id: 'startup-1', name: 'Acme Robotics' },
          investor: { id: 'investor-1', display_name: 'Sequoia Capital' },
          status: 'pending_nda',
          nda_signed_by_founder: false,
          nda_signed_by_investor: false,
          nda_fully_signed: false,
          documents: [],
          conversation_id: NEW_CONVERSATION_ID,
          created_at: new Date().toISOString(),
        }),
      })
    })
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/messages/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([ownMessage, peerMessage]),
      })
    })
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/read/`, async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    // Intercept the WebSocket. By default routeWebSocket does NOT connect
    // to the upstream server (no backend running in this e2e), so we own
    // the full session. We capture the route so we can push frames after
    // the UI has loaded and joined the conversation channel.
    let wsRoute: import('@playwright/test').WebSocketRoute | null = null
    let joined = false
    await page.routeWebSocket(/\/ws\/chat\//, (ws) => {
      wsRoute = ws
      ws.onMessage((message) => {
        const text = typeof message === 'string' ? message : message.toString()
        try {
          const parsed = JSON.parse(text) as { type?: string; data?: Record<string, unknown> }
          // The component joins the conversation channel once on socket
          // open — flip the flag so we know we can start pushing frames.
          if (parsed.type === 'conversation.join') {
            joined = true
          }
        } catch {
          // Ignore — heartbeat or other client frames.
        }
      })
    })

    // Navigate. ProtectedRoute will let us in because beforeEach already
    // pre-populated the JWT tokens and mocked /users/me/.
    await page.goto(`/app/deals/${NEW_DEAL_ROOM_ID}`)
    await expect(
      page.getByRole('heading', { name: /Acme Robotics × Sequoia Capital/i }),
    ).toBeVisible({ timeout: 10_000 })

    const chat = page.getByTestId('deal-room-chat')
    await expect(chat).toBeVisible()
    await expect(chat.getByText('Original content')).toBeVisible()

    // Wait for the client to have joined — guarantees the lastMessage
    // effect is mounted and ready to react to inbound frames.
    await expect.poll(() => joined, { timeout: 10_000 }).toBe(true)
    expect(wsRoute).not.toBeNull()

    // 1. message.edited — peer edits their message.
    wsRoute!.send(JSON.stringify({
      type: 'message.edited',
      data: {
        conversation_id: NEW_CONVERSATION_ID,
        message_id: peerMessage.id,
        content: 'Edited via WebSocket',
        edited_at: new Date().toISOString(),
        edited_by_id: 'user-99',
        edited_by_name: 'Jane Investor',
      },
    }))
    await expect(chat.getByText('Edited via WebSocket')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId(`deal-room-chat-message-${peerMessage.id}`)).toContainText('edited')

    // 2. reaction.update — peer adds a 🎉 to that same message.
    wsRoute!.send(JSON.stringify({
      type: 'reaction.update',
      data: {
        conversation_id: NEW_CONVERSATION_ID,
        message_id: peerMessage.id,
        action: 'added',
        emoji: '🎉',
        user_id: 'user-99',
        user_name: 'Jane Investor',
      },
    }))
    await expect(
      page.getByTestId(`deal-room-chat-reaction-${peerMessage.id}-🎉`),
    ).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId(`deal-room-chat-reaction-${peerMessage.id}-🎉`)).toHaveText('🎉1')

    // 3. message.new — peer sends a new message.
    wsRoute!.send(JSON.stringify({
      type: 'message.new',
      data: {
        id: 'peer-msg-2',
        conversation: NEW_CONVERSATION_ID,
        sender_id: 'user-99',
        sender_name: 'Jane Investor',
        content: 'Live message via WebSocket',
        message_type: 'text',
        created_at: new Date().toISOString(),
      },
    }))
    await expect(chat.getByText('Live message via WebSocket')).toBeVisible({ timeout: 5_000 })

    // 4. message.deleted — peer deletes their first message.
    wsRoute!.send(JSON.stringify({
      type: 'message.deleted',
      data: {
        conversation_id: NEW_CONVERSATION_ID,
        message_id: peerMessage.id,
        deleted_by_id: 'user-99',
        deleted_by_name: 'Jane Investor',
      },
    }))
    await expect(
      page.getByTestId(`deal-room-chat-message-${peerMessage.id}`),
    ).toHaveCount(0, { timeout: 5_000 })
  })

  test('workflow renders as a left-column mini card and opens in a floating window on click', async ({ page }) => {
    // Mock the deal-room detail with workflow attached. The workflow
    // endpoint is separate from the room endpoint — DealRoomDetailPage
    // fetches both in parallel.
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: NEW_DEAL_ROOM_ID,
          startup: { id: 'startup-1', name: 'Acme Robotics' },
          investor: { id: 'investor-1', display_name: 'Sequoia Capital' },
          status: 'active',
          nda_signed_by_founder: true,
          nda_signed_by_investor: true,
          nda_fully_signed: true,
          documents: [],
          conversation_id: NEW_CONVERSATION_ID,
          created_at: '2026-05-18T12:00:00Z',
        }),
      })
    })
    // Minimal but valid workflow shape — one start node + one terminal,
    // with the start node as currentNode so the minimized summary has
    // something to display.
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/workflow/`, async (route) => {
      const startNode = {
        id: 'node-start',
        name: 'Term Sheet Review',
        description: '',
        node_type: 'system_start',
        status: 'active',
        position_x: 0,
        position_y: 0,
        terminal_outcome: '',
        required_document_type: '',
        investor_approved: false,
        founder_approved: false,
        investor_approved_at: null,
        founder_approved_at: null,
        investor_approval_note: '',
        founder_approval_note: '',
        investor_chosen_next_node_id: null,
        founder_chosen_next_node_id: null,
        completed_at: null,
      }
      const endNode = {
        ...startNode,
        id: 'node-end',
        name: 'Room Closed',
        node_type: 'system_end',
        status: 'pending',
        terminal_outcome: 'other',
        position_x: 220,
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          nodes: [startNode, endNode],
          edges: [{ id: 'edge-1', from_node_id: 'node-start', to_node_id: 'node-end', label: '', order_hint: 0 }],
          current_node: startNode,
          is_complete: false,
          created_at: '2026-05-18T12:00:00Z',
        }),
      })
    })
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/messages/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/read/`, async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    await page.goto(`/app/deals/${NEW_DEAL_ROOM_ID}`)

    // Mini card visible in the left column by default — never expanded
    // inline, no toggle. The card shows the current step.
    const miniCard = page.getByTestId('workflow-mini-card')
    await expect(miniCard).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('workflow-mini-summary')).toContainText('Term Sheet Review')

    // The approval panel renders inline below the mini card so users can
    // approve the next stage without opening the popup. Verify the
    // wrapper renders — the panel's internal content is covered by the
    // workflow component's own unit tests.
    await expect(page.getByTestId('workflow-approval-panel-inline')).toBeVisible()

    // No floating window yet.
    await expect(page.getByTestId('workflow-window')).toHaveCount(0)

    // Click the mini card → floating window opens with the canvas.
    await miniCard.click()
    const win = page.getByTestId('workflow-window')
    await expect(win).toBeVisible()
    // The window is a dialog with the proper a11y role.
    await expect(win).toHaveAttribute('role', 'dialog')
    await expect(win).toHaveAttribute('aria-modal', 'true')

    // Close via the X button.
    await page.getByTestId('workflow-window-close').click()
    await expect(page.getByTestId('workflow-window')).toHaveCount(0)

    // Re-open and close by clicking the backdrop instead.
    await miniCard.click()
    await expect(page.getByTestId('workflow-window')).toBeVisible()
    // Click the backdrop region (top-left corner is safely outside the
    // centered card).
    await page.getByTestId('workflow-window-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('workflow-window')).toHaveCount(0)

    // Re-open and close with ESC.
    await miniCard.click()
    await expect(page.getByTestId('workflow-window')).toBeVisible()
    // Screenshot the open-window state for visual verification of the
    // new side-by-side + popover layout.
    await page.screenshot({
      path: 'tests/e2e/screenshots/deals-room-workflow-window.png',
      fullPage: false,
    })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('workflow-window')).toHaveCount(0)
    // Screenshot the closed/default state showing mini card on the left,
    // chat on the right.
    await page.screenshot({
      path: 'tests/e2e/screenshots/deals-room-mini-layout.png',
      fullPage: false,
    })
  })

  test('NDA modal renders template, gates Sign until scroll+agree+name, and POSTs version+sha256', async ({
    page,
  }) => {
    const NDA_VERSION = 'v1.0-2026-05'
    const NDA_SHA256 = '0123456789abcdef'.repeat(4) // 64 hex chars, mock
    // Padding text to force scrolling — the modal gates the Sign flow on
    // scroll-to-bottom, so a one-line NDA would auto-trip the gate and
    // we'd miss that branch. Filler is long enough to overflow the 720px
    // tall modal text area.
    const NDA_TEXT =
      'MUTUAL CONFIDENTIALITY AGREEMENT\nTemplate version: ' + NDA_VERSION + '\n\n' +
      Array.from({ length: 60 }, (_, i) => `Section ${i + 1}. Body line for the NDA template body.`).join('\n')

    // Room mock — minimal, with NDA still un-signed so the Sign button shows.
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: NEW_DEAL_ROOM_ID,
          startup: { id: 'startup-1', name: 'Acme Robotics' },
          investor: { id: 'investor-1', display_name: 'Sequoia Capital' },
          status: 'pending_nda',
          nda_signed_by_founder: false,
          nda_signed_by_investor: false,
          nda_fully_signed: false,
          documents: [],
          conversation_id: NEW_CONVERSATION_ID,
          created_at: '2026-05-18T12:00:00Z',
        }),
      })
    })
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/messages/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.route(`${API}/chat/conversations/${NEW_CONVERSATION_ID}/read/`, async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })

    // GET nda — returns the template the modal will render.
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/nda/`, async (route, req) => {
      if (req.method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: NDA_VERSION,
          sha256: NDA_SHA256,
          text: NDA_TEXT,
          founder_signed: false,
          investor_signed: false,
          signatures: [],
        }),
      })
    })

    // POST sign-nda — capture the body so we can assert the modal sent
    // the right version + sha256 + typed name.
    let signBody: Record<string, unknown> | null = null
    await page.route(`${API}/deals/rooms/${NEW_DEAL_ROOM_ID}/sign-nda/`, async (route, req) => {
      if (req.method() !== 'POST') return route.fallback()
      signBody = JSON.parse(req.postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'NDA signed. Waiting for the other party.',
          nda_fully_signed: false,
          status: 'pending_nda',
        }),
      })
    })

    await page.goto(`/app/deals/${NEW_DEAL_ROOM_ID}`)
    await expect(
      page.getByRole('heading', { name: /Acme Robotics × Sequoia Capital/i }),
    ).toBeVisible({ timeout: 10_000 })

    // --- Open the NDA modal ---
    await page.getByTestId('sign-nda-btn').click()
    const modal = page.getByTestId('nda-modal')
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(modal).toHaveAttribute('role', 'dialog')
    // The header chip and the body both contain "Mutual Confidentiality
    // Agreement" — scope to the text region by testid to avoid the
    // strict-mode collision.
    await expect(page.getByTestId('nda-modal-text')).toContainText('MUTUAL CONFIDENTIALITY AGREEMENT')
    await expect(modal.getByText(NDA_VERSION).first()).toBeVisible()

    // Sign button is disabled because: scrolledToBottom=false, agreed=false, typedName empty.
    const submit = page.getByTestId('nda-modal-submit')
    await expect(submit).toBeDisabled()
    // The scroll hint is shown until the user reaches the bottom.
    await expect(page.getByTestId('nda-modal-scroll-hint')).toBeVisible()

    // Scroll the NDA text region to the bottom.
    await page.getByTestId('nda-modal-text').evaluate((el: HTMLElement) => {
      el.scrollTop = el.scrollHeight
    })
    // After scroll, the hint disappears and the checkbox becomes enabled.
    await expect(page.getByTestId('nda-modal-scroll-hint')).toHaveCount(0)
    const checkbox = page.getByTestId('nda-modal-agree-checkbox')
    await expect(checkbox).toBeEnabled()
    // Sign still disabled — checkbox + typed name still required.
    await expect(submit).toBeDisabled()

    // Tick the checkbox.
    await checkbox.check()
    await expect(submit).toBeDisabled() // still need a typed name.

    // Type a name — Sign becomes enabled.
    const nameInput = page.getByTestId('nda-modal-typed-name')
    await nameInput.fill('Test Founder')
    await expect(submit).toBeEnabled()
    await expect(submit).toContainText('Sign as Test Founder')

    // Screenshot the ready-to-sign state for the PR review.
    await page.screenshot({
      path: 'tests/e2e/screenshots/deals-room-nda-modal.png',
      fullPage: false,
    })

    // Submit.
    await submit.click()

    // Assert the POST body has all three required fields with the
    // values that came from the GET nda response — exactly what the
    // backend will validate against.
    await expect.poll(() => signBody !== null, { timeout: 5_000 }).toBe(true)
    expect(signBody!).toEqual({
      typed_name: 'Test Founder',
      agreed_version: NDA_VERSION,
      agreed_sha256: NDA_SHA256,
    })

    // Modal closes after a successful sign.
    await expect(page.getByTestId('nda-modal')).toHaveCount(0, { timeout: 5_000 })
  })

  test('deal-room list card shows unread badge when unread_count > 0', async ({ page }) => {
    // Return one active deal room with unread_count=3.
    await page.route(`${API}/deals/rooms/`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'room-99',
            startup_name: 'Acme Robotics',
            investor_name: 'Sequoia Capital',
            status: 'active',
            nda_signed_by_founder: true,
            nda_signed_by_investor: true,
            nda_fully_signed: true,
            document_count: 2,
            unread_count: 3,
            created_at: '2026-05-10T12:00:00Z',
          },
        ]),
      })
    })
    await page.route(`${API}/deals/my-interests/`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto('/app/deals')

    // The room card renders the unread badge with the count.
    const badge = page.getByTestId('deal-room-unread-room-99')
    await expect(badge).toBeVisible({ timeout: 10_000 })
    await expect(badge).toHaveText('3')
  })
})

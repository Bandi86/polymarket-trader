# Import Plan: polymarket-demo → polymarket-trader

## Priority Components to Import

### 1. NotificationCenter (HIGH PRIORITY)
**Why**: The #1 missing feature — no way to see what's happening with bots globally.

**Files needed**:
- `frontend/src/components/ui/notification-center.tsx` — Create new
- `frontend/src/lib/notifications.ts` — Create notification store (Zustand)
- `frontend/src/hooks/use-notifications.ts` — Hook to consume notification store

**Key features to port**:
- Bell icon with unread count badge (red dot)
- Notification panel with filter chips (All/Trades/Settlements/Errors)
- Group by bot toggle
- Stats bar (Trades/Wins/Losses/Win Rate)
- Mark all read / Clear all
- Settings for notification preferences

**Integration points**:
- Header component — add bell icon
- SSE event handler — emit notifications on bot events
- useSSE hook — capture bot events and dispatch to notification store

---

### 2. ActivityLog (MEDIUM PRIORITY)
**Why**: Gives a global event feed separate from per-bot activity card.

**Files needed**:
- `frontend/src/components/dashboard/activity-log.tsx` — Create new

**Key features to port**:
- Unified feed of trade events + bot logs
- Icon-by-type (BUY/SELL with green/red, log types with colored icons)
- Collapsible entries with signal/reason details
- Empty state when no activity

---

### 3. BotStatusCard (LOW PRIORITY — future)
**Why**: Nice to have but `bot-detail-card.tsx` already covers most functionality.

**Would add**:
- Equity curve visualization
- Open positions summary
- Win/loss streak indicator

---

## Implementation Order

```
Step 1: Create notification store (lib/notifications.ts)
  - Zustand store with notifications array
  - unreadCount, preferences state
  - markAsRead, clearAll, setPreferences actions
  - getBotStreak helper for win/loss streaks

Step 2: Create NotificationCenter component
  - Bell button with badge
  - Slide-out panel with AnimatePresence
  - Filter chips, group by bot, stats bar

Step 3: Wire SSE events → notification store
  - In useSSE hook, dispatch notification on:
    - trade_decision → 'trade'
    - trade_result (won=true) → 'settlement'
    - trade_result (won=false) → 'settlement'
    - error → 'error'

Step 4: Add NotificationCenter to Header

Step 5: Create ActivityLog component (optional, can reuse existing activity card)
```

---

## File Mapping

| Source (polymarket-demo) | Target (polymarket-trader) | Action |
|-------------------------|---------------------------|--------|
| `src/lib/notifications.ts` | `frontend/src/lib/notifications.ts` | Create new |
| `src/hooks/useNotifications.ts` | `frontend/src/hooks/use-notifications.ts` | Create new |
| `src/components/NotificationCenter.tsx` | `frontend/src/components/ui/notification-center.tsx` | Create new |
| `src/components/ActivityLog.tsx` | `frontend/src/components/dashboard/activity-log.tsx` | Create new |

---

## SSE → Notification Mapping

```typescript
// Map SSE bot events to notification types
const EVENT_TYPE_MAP = {
  'trade_decision': 'trade',
  'order_executed': 'trade',
  'trade_result': 'settlement',
  'error': 'error',
  'session_started': 'info',
  'session_ended': 'session_complete',
};

// Notification title format: "{botName} {action}"
const TITLE_MAP = {
  'trade_decision': 'Trade Decision',
  'order_executed': 'Order Filled',
  'trade_result': (data) => data.won ? 'Won Trade' : 'Lost Trade',
  'error': 'Bot Error',
  'session_started': 'Session Started',
  'session_ended': 'Session Ended',
};
```

---

## Verification

After implementing:
1. Start 1+ bots
2. Open notification panel (bell icon)
3. Verify: trade decisions appear, results show win/loss, errors are logged
4. Check grouping by bot works
5. Test filter chips (All/Trades/Settlements/Errors)
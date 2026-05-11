# Polymarket Trader - Demo UI Overhaul Plan

## Current State
- `/bots/page.tsx` - 918 lines, too big, handles everything
- `CommandCenter` has a "Bot Fleet & Positions" panel but it's limited
- Bot creation is in a separate modal
- No unified "demo session" experience
- `polymarket-demo` has excellent working demo UI to reference

## Target Experience

### Demo Login Flow
1. Click "Demo mód" on login page
2. Land on dashboard where:
   - Bots auto-populate (pre-configured demo bots)
   - Clear "Demo Mode" indicator
   - Real-time market data streaming
   - Bot fleet visible with status
3. Can start/stop bots individually or all at once
4. See real-time P&L, trades, equity curves
5. Create new bots with strategy selection

## Proposed Structure

### Pages
```
/ (Dashboard/CommandCenter)
  └── Bot Fleet & Positions panel (enhanced)
      - Bot cards with start/stop/config
      - Aggregate stats
      - Bot creation
      
/bots (BotLab - new, replaces 918-line monster)
  - Full bot management
  - Strategy comparison
  - Performance analytics
```

### Key Components to Create/Update

1. **`BotFleetPanel`** (replaces BotSelector in CommandCenter)
   - Compact bot cards
   - Start/Stop controls
   - Quick stats
   - Multi-select for bulk actions
   
2. **`BotCard`** (enhance existing `bot-card/`)
   - Start/Stop button
   - Balance, P&L, win rate
   - Recent trades visualization
   - Strategy indicator
   
3. **`NewBotsPage`** (new `/bots` page)
   - Clean list of all bots
   - Sort/filter by strategy, status, performance
   - Bulk actions
   - Bot creation modal
   - Detailed performance view

4. **Demo Session Manager**
   - Auto-create demo bots on first login
   - Reset functionality
   - Session duration tracking

## Implementation Phases

### Phase 1: BotFleetPanel (CommandCenter integration)
- Extract bot card rendering to reusable component
- Add start/stop buttons directly on cards
- Show aggregate portfolio
- Bot creation quick-access

### Phase 2: New Bots Page (clean separation)
- Create new `/bots/page.tsx` that's focused (~300 lines)
- Move complex filtering/sorting logic there
- Keep CommandCenter for real-time monitoring

### Phase 3: Demo Experience
- Auto-populate demo bots on demo login
- Clear demo/live mode separation in UI
- Demo reset functionality

## Reference from polymarket-demo
- `LiveMonitorTab.tsx` - excellent bot fleet UI
- `BotStatusCard.tsx` - comprehensive bot card
- `BotConfigPanel.tsx` - clean config modal
- `useTradingData.ts` - unified state management

## Technical Notes
- Use existing `useBots()`, `useStartBot()`, `useStopBot()` hooks
- Keep `useBotStatusState` hook from `bot-card/`
- SSE already handles real-time updates
- Backend already has demo mode support
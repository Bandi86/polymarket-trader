'use client'

import { useState, useMemo } from 'react'

// ---- Types ----
type BotStatus = 'active' | 'stopped' | 'error'

type SortKey = 'pnl' | 'winRate' | 'trades' | 'name' | 'wins' | 'losses'
type SortDir = 'asc' | 'desc'

interface Bot {
  id: string
  name: string
  strategy: string
  status: BotStatus
  pnl: number
  trades: number
  wins: number
  losses: number
  winRate: number
  market: string
  createdAt: string
}

// ---- Mock data (remove when backend is connected) ----
const MOCK_BOTS: Bot[] = [
  {
    id: '1',
    name: 'Alpha Momentum',
    strategy: 'Momentum',
    status: 'active',
    pnl: 142.5,
    trades: 38,
    wins: 26,
    losses: 12,
    winRate: 68.4,
    market: 'BTC/USD',
    createdAt: '2025-04-01',
  },
  {
    id: '2',
    name: 'Mean Rev Bot',
    strategy: 'Mean Reversion',
    status: 'stopped',
    pnl: -23.1,
    trades: 15,
    wins: 6,
    losses: 9,
    winRate: 40.0,
    market: 'ETH/USD',
    createdAt: '2025-04-10',
  },
  {
    id: '3',
    name: 'Sniper v2',
    strategy: 'Sniper',
    status: 'active',
    pnl: 310.8,
    trades: 72,
    wins: 51,
    losses: 21,
    winRate: 70.8,
    market: 'BTC/USD',
    createdAt: '2025-03-22',
  },
  {
    id: '4',
    name: 'Trend Chaser',
    strategy: 'Trend Following',
    status: 'error',
    pnl: 55.2,
    trades: 20,
    wins: 13,
    losses: 7,
    winRate: 65.0,
    market: 'SOL/USD',
    createdAt: '2025-04-15',
  },
  {
    id: '5',
    name: 'Oracle Hawk',
    strategy: 'Oracle Lag',
    status: 'active',
    pnl: 88.0,
    trades: 44,
    wins: 30,
    losses: 14,
    winRate: 68.2,
    market: 'BTC/USD',
    createdAt: '2025-04-18',
  },
  {
    id: '6',
    name: 'Contra Beast',
    strategy: 'Contrarian',
    status: 'stopped',
    pnl: -5.6,
    trades: 11,
    wins: 5,
    losses: 6,
    winRate: 45.5,
    market: 'ETH/USD',
    createdAt: '2025-04-20',
  },
  {
    id: '7',
    name: 'Velocity X',
    strategy: 'Binance Velocity',
    status: 'active',
    pnl: 201.3,
    trades: 55,
    wins: 40,
    losses: 15,
    winRate: 72.7,
    market: 'BTC/USD',
    createdAt: '2025-04-22',
  },
  {
    id: '8',
    name: 'Window Watcher',
    strategy: 'Window Delta',
    status: 'stopped',
    pnl: 12.4,
    trades: 9,
    wins: 5,
    losses: 4,
    winRate: 55.6,
    market: 'SOL/USD',
    createdAt: '2025-04-23',
  },
  {
    id: '9',
    name: 'Fair Hunter',
    strategy: 'Fair Value',
    status: 'active',
    pnl: 67.9,
    trades: 31,
    wins: 20,
    losses: 11,
    winRate: 64.5,
    market: 'ETH/USD',
    createdAt: '2025-04-25',
  },
  {
    id: '10',
    name: 'Vola Storm',
    strategy: 'Volatility',
    status: 'error',
    pnl: -44.2,
    trades: 18,
    wins: 7,
    losses: 11,
    winRate: 38.9,
    market: 'BTC/USD',
    createdAt: '2025-04-26',
  },
  {
    id: '11',
    name: 'Trend Ghost',
    strategy: 'Trend Following',
    status: 'active',
    pnl: 155.0,
    trades: 48,
    wins: 33,
    losses: 15,
    winRate: 68.8,
    market: 'SOL/USD',
    createdAt: '2025-04-28',
  },
  {
    id: '12',
    name: 'Reverse Arc',
    strategy: 'Mean Reversion',
    status: 'stopped',
    pnl: 3.1,
    trades: 7,
    wins: 4,
    losses: 3,
    winRate: 57.1,
    market: 'ETH/USD',
    createdAt: '2025-04-29',
  },
  {
    id: '13',
    name: 'Delta Pulse',
    strategy: 'Window Delta',
    status: 'active',
    pnl: 93.7,
    trades: 29,
    wins: 19,
    losses: 10,
    winRate: 65.5,
    market: 'BTC/USD',
    createdAt: '2025-04-30',
  },
  {
    id: '14',
    name: 'Shadow Sniper',
    strategy: 'Sniper',
    status: 'active',
    pnl: 278.4,
    trades: 63,
    wins: 47,
    losses: 16,
    winRate: 74.6,
    market: 'SOL/USD',
    createdAt: '2025-05-01',
  },
  {
    id: '15',
    name: 'Binance Wolf',
    strategy: 'Binance Velocity',
    status: 'stopped',
    pnl: -18.9,
    trades: 13,
    wins: 5,
    losses: 8,
    winRate: 38.5,
    market: 'BTC/USD',
    createdAt: '2025-05-02',
  },
]

// ---- Helpers ----
function fmt(n: number, prefix = '') {
  const abs = Math.abs(n).toFixed(2)
  return n >= 0 ? `${prefix}+$${abs}` : `${prefix}-$${abs}`
}

function statusLabel(s: BotStatus) {
  if (s === 'active') return { text: 'Aktív', color: '#22c55e' }
  if (s === 'error') return { text: 'Hiba', color: '#ef4444' }
  return { text: 'Leállítva', color: '#6b7280' }
}

const STRATEGY_COLORS: Record<string, string> = {
  Momentum: '#818cf8',
  'Mean Reversion': '#34d399',
  'Trend Following': '#60a5fa',
  Contrarian: '#f87171',
  Volatility: '#fbbf24',
  'Oracle Lag': '#a78bfa',
  'Fair Value': '#2dd4bf',
  Sniper: '#f472b6',
  'Window Delta': '#fb923c',
  'Binance Velocity': '#38bdf8',
}

// ---- Sort options ----
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'pnl', label: 'Legtöbb nyereség (PnL)' },
  { key: 'winRate', label: 'Win rate' },
  { key: 'trades', label: 'Legtöbb trade' },
  { key: 'wins', label: 'Legtöbb nyerés' },
  { key: 'losses', label: 'Legtöbb veszítés' },
  { key: 'name', label: 'Név (A-Z)' },
]

// ---- Summary stats ----
function Stats({ bots }: { bots: Bot[] }) {
  const totalPnl = bots.reduce((a, b) => a + b.pnl, 0)
  const totalTrades = bots.reduce((a, b) => a + b.trades, 0)
  const totalWins = bots.reduce((a, b) => a + b.wins, 0)
  const totalLosses = bots.reduce((a, b) => a + b.losses, 0)
  const avgWinRate =
    bots.length > 0
      ? bots.reduce((a, b) => a + b.winRate, 0) / bots.length
      : 0
  const activeBots = bots.filter((b) => b.status === 'active').length

  const cards = [
    { label: 'Aktív botok', value: activeBots, color: '#a3e635' },
    {
      label: 'Összes PnL',
      value: fmt(totalPnl),
      color: totalPnl >= 0 ? '#4ade80' : '#f87171',
    },
    { label: 'Trades', value: totalTrades, color: '#e2e8f0' },
    {
      label: 'Nyerés / Vesztés',
      value: null,
      wins: totalWins,
      losses: totalLosses,
    },
    {
      label: 'Avg Win Rate',
      value: `${avgWinRate.toFixed(1)}%`,
      color: '#e2e8f0',
    },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '28px',
      }}
    >
      {cards.map((c, i) => (
        <div
          key={i}
          style={{
            background: '#1a1a2e',
            border: '1px solid #2a2a3e',
            borderRadius: '12px',
            padding: '16px 18px',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: '#6b7280',
              margin: '0 0 8px',
              letterSpacing: '0.04em',
            }}
          >
            {c.label}
          </p>
          {c.wins !== undefined ? (
            <p style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>
              <span style={{ color: '#4ade80' }}>{c.wins}W</span>
              <span style={{ color: '#4b5563', margin: '0 4px' }}>/</span>
              <span style={{ color: '#f87171' }}>{c.losses}L</span>
            </p>
          ) : (
            <p
              style={{
                fontSize: '22px',
                fontWeight: 600,
                margin: 0,
                color: c.color ?? '#e2e8f0',
              }}
            >
              {c.value}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Bot Card ----
function BotCard({
  bot,
  onStart,
  onStop,
  onDelete,
  onReset,
}: {
  bot: Bot
  onStart: (id: string) => void
  onStop: (id: string) => void
  onDelete: (id: string) => void
  onReset: (id: string) => void
}) {
  const { text: statusText, color: statusColor } = statusLabel(bot.status)
  const stratColor = STRATEGY_COLORS[bot.strategy] ?? '#818cf8'
  const pnlColor = bot.pnl >= 0 ? '#4ade80' : '#f87171'

  return (
    <div
      style={{
        background: '#13131f',
        border: '1px solid #252535',
        borderRadius: '12px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f5e')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = '#252535')
      }
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 600,
              color: '#e2e8f0',
            }}
          >
            {bot.name}
          </h3>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: stratColor,
              background: `${stratColor}18`,
              padding: '2px 8px',
              borderRadius: '6px',
              marginTop: '5px',
              display: 'inline-block',
            }}
          >
            {bot.strategy}
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: statusColor,
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}40`,
            padding: '3px 10px',
            borderRadius: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          ● {statusText}
        </span>
      </div>

      {/* PnL big number */}
      <div style={{ borderTop: '1px solid #1e1e30', paddingTop: '7px' }}>
        <p
          style={{ fontSize: '10px', color: '#4b5563', margin: '0 0 2px' }}
        >
          PnL
        </p>
        <p
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: pnlColor,
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          {fmt(bot.pnl)}
        </p>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '5px',
        }}
      >
        {[
          { label: 'Trades', value: bot.trades },
          { label: 'Win rate', value: `${bot.winRate.toFixed(1)}%` },
          { label: 'Piac', value: bot.market },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: '#0d0d1a',
              borderRadius: '6px',
              padding: '5px 7px',
            }}
          >
            <p
              style={{
                fontSize: '10px',
                color: '#4b5563',
                margin: '0 0 2px',
              }}
            >
              {s.label}
            </p>
            <p
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#cbd5e1',
                margin: 0,
              }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* W/L bar */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#4b5563',
            marginBottom: '4px',
          }}
        >
          <span style={{ color: '#4ade80' }}>{bot.wins}W</span>
          <span style={{ color: '#f87171' }}>{bot.losses}L</span>
        </div>
        <div
          style={{
            height: '4px',
            background: '#1e1e30',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width:
                bot.trades > 0
                  ? `${(bot.wins / bot.trades) * 100}%`
                  : '0%',
              background:
                'linear-gradient(90deg, #22c55e, #4ade80)',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '0px' }}>
        {bot.status !== 'active' ? (
          <button
            onClick={() => onStart(bot.id)}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: '11px',
              fontWeight: 600,
              color: '#4ade80',
              background: '#4ade8014',
              border: '1px solid #4ade8030',
              borderRadius: '7px',
              cursor: 'pointer',
            }}
          >
            ▶ Indítás
          </button>
        ) : (
          <button
            onClick={() => onStop(bot.id)}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: '11px',
              fontWeight: 600,
              color: '#fbbf24',
              background: '#fbbf2414',
              border: '1px solid #fbbf2430',
              borderRadius: '7px',
              cursor: 'pointer',
            }}
          >
            ■ Leállítás
          </button>
        )}
        <button
          onClick={() => onReset(bot.id)}
          title="Adatok nullázása"
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#818cf8',
            background: '#818cf814',
            border: '1px solid #818cf830',
            borderRadius: '7px',
            cursor: 'pointer',
          }}
        >
          ↺
        </button>
        <button
          onClick={() => onDelete(bot.id)}
          title="Bot törlése"
          style={{
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#f87171',
            background: '#f8717114',
            border: '1px solid #f8717130',
            borderRadius: '7px',
            cursor: 'pointer',
          }}
        >
          🗑
        </button>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>(MOCK_BOTS)
  const [sortKey, setSortKey] = useState<SortKey>('pnl')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<BotStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<'none' | 'top3' | 'bottom3'>('none')

  const filtered = useMemo(() => {
    let list = bots
    if (statusFilter !== 'all') list = list.filter((b) => b.status === statusFilter)
    if (search.trim())
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.strategy.toLowerCase().includes(search.toLowerCase())
      )
    const dir = sortDir === 'asc' ? 1 : -1
    let sorted = [...list].sort((a, b) => {
      if (sortKey === 'name') return dir * a.name.localeCompare(b.name)
      return dir * ((a[sortKey] as number) - (b[sortKey] as number))
    })
    if (quickFilter === 'top3') {
      sorted = [...list].sort((a, b) => b.pnl - a.pnl).slice(0, 3)
    } else if (quickFilter === 'bottom3') {
      sorted = [...list].sort((a, b) => a.pnl - b.pnl).slice(0, 3)
    }
    return sorted
  }, [bots, sortKey, sortDir, statusFilter, search, quickFilter])

  const toggleDir = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))

  const handleStartAll = () =>
    setBots((prev) => prev.map((b) => ({ ...b, status: 'active' as BotStatus })))

  const handleStopAll = () =>
    setBots((prev) => prev.map((b) => ({ ...b, status: 'stopped' as BotStatus })))

  const handleStart = (id: string) =>
    setBots((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'active' } : b))
    )
  const handleStop = (id: string) =>
    setBots((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'stopped' } : b))
    )
  const handleDelete = (id: string) =>
    setBots((prev) => prev.filter((b) => b.id !== id))

  const handleResetAll = () =>
    setBots((prev) =>
      prev.map((b) => ({ ...b, pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 }))
    )

  const handleReset = (id: string) =>
    setBots((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 }
          : b
      )
    )

  return (
    <div
      style={{
        padding: '24px',
        background: '#0b0b14',
        minHeight: '100vh',
        overflowY: 'auto',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#3b3bff22',
              border: '1px solid #3b3bff44',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            🤖
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
              Botok
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>
              Trading botok kezelése
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleResetAll}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#818cf8',
              background: '#818cf814',
              border: '1px solid #818cf840',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ↺ Összes nullázása
          </button>
          <button
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              background: '#3b3bff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            + Új bot
          </button>
        </div>
      </div>

      {/* Stats */}
      <Stats bots={bots} />

      {/* Controls bar */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="🔍  Bot keresése..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1',
            minWidth: '180px',
            padding: '9px 14px',
            fontSize: '13px',
            background: '#13131f',
            border: '1px solid #252535',
            borderRadius: '10px',
            color: '#e2e8f0',
            outline: 'none',
          }}
        />

        {/* Status filter */}
        {(['all', 'active', 'stopped', 'error'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '9px',
              cursor: 'pointer',
              border:
                statusFilter === s
                  ? '1px solid #3b3bff'
                  : '1px solid #252535',
              background: statusFilter === s ? '#3b3bff22' : '#13131f',
              color:
                statusFilter === s
                  ? '#818cf8'
                  : s === 'active'
                  ? '#4ade80'
                  : s === 'error'
                  ? '#f87171'
                  : '#6b7280',
            }}
          >
            {s === 'all'
              ? 'Összes'
              : s === 'active'
              ? '● Aktív'
              : s === 'stopped'
              ? '■ Leállítva'
              : '✕ Hiba'}
          </button>
        ))}

        {/* Sort selector */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            padding: '9px 12px',
            fontSize: '12px',
            background: '#13131f',
            border: '1px solid #252535',
            borderRadius: '10px',
            color: '#e2e8f0',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Sort direction */}
        <button
          onClick={toggleDir}
          title={sortDir === 'desc' ? 'Csökkenő' : 'Növekvő'}
          style={{
            padding: '9px 14px',
            fontSize: '14px',
            background: '#13131f',
            border: '1px solid #252535',
            borderRadius: '10px',
            color: '#6b7280',
            cursor: 'pointer',
          }}
        >
          {sortDir === 'desc' ? '↓' : '↑'}
        </button>
      </div>

      {/* Quick actions bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '11px', color: '#4b5563', marginRight: '4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Gyors műveletek:
        </span>

        <button
          onClick={handleStartAll}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#4ade80',
            background: '#4ade8014',
            border: '1px solid #4ade8030',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          ▶ Összes indítása
        </button>

        <button
          onClick={handleStopAll}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#fbbf24',
            background: '#fbbf2414',
            border: '1px solid #fbbf2430',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          ■ Összes leállítása
        </button>

        <div style={{ width: '1px', height: '22px', background: '#252535', margin: '0 4px' }} />

        <span style={{ fontSize: '11px', color: '#4b5563', marginRight: '2px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Nézet:
        </span>

        <button
          onClick={() => setQuickFilter(quickFilter === 'top3' ? 'none' : 'top3')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: quickFilter === 'top3' ? '#fbbf24' : '#6b7280',
            background: quickFilter === 'top3' ? '#fbbf2418' : '#13131f',
            border: quickFilter === 'top3' ? '1px solid #fbbf2440' : '1px solid #252535',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          🏆 Top 3 legjobb
        </button>

        <button
          onClick={() => setQuickFilter(quickFilter === 'bottom3' ? 'none' : 'bottom3')}
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: quickFilter === 'bottom3' ? '#f87171' : '#6b7280',
            background: quickFilter === 'bottom3' ? '#f8717118' : '#13131f',
            border: quickFilter === 'bottom3' ? '1px solid #f8717140' : '1px solid #252535',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          ⚠ Top 3 legrosszabb
        </button>

        {quickFilter !== 'none' && (
          <button
            onClick={() => setQuickFilter('none')}
            style={{
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#6b7280',
              background: '#13131f',
              border: '1px solid #252535',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            ✕ Szűrő törlése
          </button>
        )}
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: '#13131f',
            border: '1px dashed #252535',
            borderRadius: '16px',
            padding: '60px 32px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🤖</p>
          <p
            style={{ fontSize: '16px', color: '#6b7280', margin: '0 0 6px' }}
          >
            {bots.length === 0
              ? 'Nincs bot konfiguráció'
              : 'Nincs találat a szűrési feltételekre'}
          </p>
          <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
            {bots.length === 0
              ? 'Hozzon létre egy új trading botot a kezdéshez'
              : 'Próbáljon más keresési feltételt'}
          </p>
        </div>
      ) : (
        <>
          <p
            style={{
              fontSize: '12px',
              color: '#374151',
              margin: '0 0 14px',
            }}
          >
            {filtered.length} bot találat
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '10px',
            }}
          >
            {filtered.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onStart={handleStart}
                onStop={handleStop}
                onDelete={handleDelete}
                onReset={handleReset}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

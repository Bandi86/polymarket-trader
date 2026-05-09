'use client';

import { Bell, X, Check, CheckCheck, Trash2, Settings, Filter, BarChart3, Clock } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationStore } from '@/lib/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';

export function NotificationCenter() {
  const {
    notifications,
    unread,
    unreadCount,
    preferences,
    markAllAsRead,
    clearAll,
    setPreferences,
    getBotStreak,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'trade' | 'settlement' | 'error'>('all');
  const [groupByBot, setGroupByBot] = useState(true);
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set(['all']));

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Most most';
    if (minutes < 60) return `${minutes}p ezelőtt`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}ó ezelőtt`;
    return `${Math.floor(hours / 24)}nap ezelőtt`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trade': return '📊';
      case 'settlement': return '✓';
      case 'session_complete': return '🏁';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '📬';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'trade': return 'border-blue-500/30 bg-blue-500/5';
      case 'settlement': return 'border-green-500/30 bg-green-500/5';
      case 'session_complete': return 'border-purple-500/30 bg-purple-500/5';
      case 'error': return 'border-red-500/30 bg-red-500/5';
      case 'warning': return 'border-amber-500/30 bg-amber-500/5';
      case 'info': return 'border-gray-500/30 bg-gray-500/5';
      default: return 'border-gray-500/30 bg-gray-500/5';
    }
  };

  const extractBotName = (title: string): string => {
    // Title format: "BotName action" — first word is bot name
    const match = title.match(/^([A-Za-z0-9_]+)/);
    return match ? match[0] : 'Other';
  };

  // Group notifications by bot
  const groupedNotifications = useMemo(() => {
    if (!groupByBot) return { all: notifications };
    const groups: Record<string, typeof notifications> = {};
    notifications.forEach(notif => {
      const botName = extractBotName(notif.title);
      if (!groups[botName]) groups[botName] = [];
      groups[botName].push(notif);
    });
    return groups;
  }, [notifications, groupByBot]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (filterType === 'all') return notifications;
    return notifications.filter(n => n.type === filterType);
  }, [notifications, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const trades = notifications.filter(n => n.type === 'trade');
    const settlements = notifications.filter(n => n.type === 'settlement');
    const wins = settlements.filter(s => s.data?.won === true);
    const losses = settlements.filter(s => s.data?.won === false);
    const errors = notifications.filter(n => n.type === 'error');
    return {
      totalTrades: trades.length,
      totalSettlements: settlements.length,
      wins: wins.length,
      losses: losses.length,
      winRate: settlements.length > 0 ? (wins.length / settlements.length) * 100 : 0,
      errors: errors.length,
    };
  }, [notifications]);

  const toggleBotGroup = (botName: string) => {
    const newExpanded = new Set(expandedBots);
    if (newExpanded.has(botName)) newExpanded.delete(botName);
    else newExpanded.add(botName);
    setExpandedBots(newExpanded);
  };

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5 text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white"
            style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[9998]"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="fixed top-[64px] right-1rem w-[450px] max-h-[calc(100vh-64px-2rem)] z-[9999] flex flex-col rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(11, 11, 15, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">Értesítések</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-400">
                      {unreadCount} új
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unread.length > 0 && (
                    <button onClick={markAllAsRead} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Mind olvasottnak jelöl">
                      <CheckCheck className="w-4 h-4 text-zinc-500" />
                    </button>
                  )}
                  <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Beállítások">
                    <Settings className="w-4 h-4 text-zinc-500" />
                  </button>
                  <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              {notifications.length > 0 && (
                <div
                  className="grid grid-cols-4 gap-2 px-5 py-3 border-b border-white/5"
                  style={{ background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  <StatItem icon="📊" label="Trade" value={stats.totalTrades} color="#3b82f6" />
                  <StatItem icon="✓" label="Nyert" value={stats.wins} color="#22c55e" />
                  <StatItem icon="✕" label="Lost" value={stats.losses} color="#ef4444" />
                  <StatItem icon="%" label="Win%" value={`${stats.winRate.toFixed(0)}%`} color="#a855f7" />
                </div>
              )}

              {/* Settings Panel */}
              {showSettings && (
                <div className="px-5 py-4 border-b border-white/5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                    Beállítások
                  </div>
                  <div className="flex flex-col gap-2">
                    <ToggleRow label="Összes" checked={preferences.enabled} onChange={(v) => setPreferences({ enabled: v })} />
                    <ToggleRow label="Trade értesítések" checked={preferences.tradeEnabled} onChange={(v) => setPreferences({ tradeEnabled: v })} disabled={!preferences.enabled} />
                    <ToggleRow label="Settlement" checked={preferences.settlementEnabled} onChange={(v) => setPreferences({ settlementEnabled: v })} disabled={!preferences.enabled} />
                    <ToggleRow label="Hibák" checked={preferences.errorEnabled} onChange={(v) => setPreferences({ errorEnabled: v })} />
                  </div>
                </div>
              )}

              {/* Filter Bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <div className="flex gap-1 flex-1 overflow-x-auto">
                  <FilterChip active={filterType === 'all'} onClick={() => setFilterType('all')} label="Mind" count={notifications.length} />
                  <FilterChip active={filterType === 'trade'} onClick={() => setFilterType('trade')} label="Trade" count={stats.totalTrades} />
                  <FilterChip active={filterType === 'settlement'} onClick={() => setFilterType('settlement')} label="Eredmény" count={stats.totalSettlements} />
                  <FilterChip active={filterType === 'error'} onClick={() => setFilterType('error')} label="Hibák" count={stats.errors} />
                </div>
                <button
                  onClick={() => setGroupByBot(!groupByBot)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                    groupByBot ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
                >
                  Bot szerint
                </button>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto p-3">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                    <Bell className="w-12 h-12 mb-3 opacity-20" />
                    <div className="text-sm font-medium">Nincsennek értesítések</div>
                    <div className="text-xs mt-1">Indíts botokat a kereskedés megkezdéséhez</div>
                  </div>
                ) : groupByBot ? (
                  <div className="flex flex-col gap-3">
                    {Object.entries(groupedNotifications).map(([botName, botNotifs]) => {
                      const filteredBotNotifs = botNotifs.filter(n =>
                        filterType === 'all' || n.type === filterType
                      );
                      if (filteredBotNotifs.length === 0) return null;
                      const isExpanded = expandedBots.has(botName);
                      const botWins = filteredBotNotifs.filter(n => n.data?.won === true).length;
                      const botLosses = filteredBotNotifs.filter(n => n.data?.won === false).length;
                      const botTrades = filteredBotNotifs.filter(n => n.type === 'trade').length;
                      return (
                        <BotGroup
                          key={botName}
                          botName={botName}
                          notifications={filteredBotNotifs}
                          isExpanded={isExpanded}
                          onToggle={() => toggleBotGroup(botName)}
                          stats={{ trades: botTrades, wins: botWins, losses: botLosses }}
                          getNotificationIcon={getNotificationIcon}
                          getNotificationColor={getNotificationColor}
                          formatTime={formatTime}
                          getBotStreak={getBotStreak}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredNotifications.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notification={notif}
                        icon={getNotificationIcon(notif.type)}
                        colorClass={getNotificationColor(notif.type)}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {filteredNotifications.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                  <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-xs font-medium text-zinc-500">
                    <Trash2 className="w-3.5 h-3.5" />
                    Mind töröl
                  </button>
                  <div className="text-[11px] text-zinc-500">
                    {filteredNotifications.length} értesítés
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// === Sub-components ===

function StatItem({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 p-2 rounded-lg"
      style={{ background: 'rgba(255, 255, 255, 0.03)' }}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-sm font-bold" style={{ color }}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="text-[10px] uppercase text-zinc-500">{label}</span>
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-transparent'
      }`}
    >
      {label} ({count})
    </button>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${disabled ? 'text-zinc-600' : 'text-zinc-400'}`}>{label}</span>
      <button
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
        style={{
          background: checked && !disabled ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

function BotGroup({
  botName, notifications, isExpanded, onToggle, stats,
  getNotificationIcon, getNotificationColor, formatTime, getBotStreak,
}: {
  botName: string;
  notifications: import('@/lib/notifications').Notification[];
  isExpanded: boolean;
  onToggle: () => void;
  stats: { trades: number; wins: number; losses: number };
  getNotificationIcon: (type: string) => string;
  getNotificationColor: (type: string) => string;
  formatTime: (ts: number) => string;
  getBotStreak: (botName: string) => { consecutive: number; wins: number; losses: number } | null;
}) {
  const latestNotif = notifications[0];
  const winRate = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(0) : '0';
  const streak = getBotStreak(botName);
  const streakConsecutive = streak?.consecutive || 0;
  const streakColor = streakConsecutive > 0 ? '#22c55e' : streakConsecutive < 0 ? '#ef4444' : '#6b7280';
  const streakIcon = streakConsecutive > 0 ? '🔥' : streakConsecutive < 0 ? '📉' : '➖';

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
      <button onClick={onToggle} className="flex items-center justify-between w-full px-4 py-3 bg-transparent border-none cursor-pointer">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))' }}>
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left min-w-0">
            <div className="font-semibold text-sm text-zinc-200 truncate">{botName}</div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-2">
              <span>{stats.trades} trade • {winRate}% win</span>
              {streakConsecutive !== 0 && (
                <span style={{ color: streakColor }}>{streakIcon} {Math.abs(streakConsecutive)} streak</span>
              )}
            </div>
            <div className="text-[10px] text-zinc-600">Utolsó: {formatTime(latestNotif.timestamp)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400">
            <span>W: {stats.wins}</span>
            <span className="text-white/20">|</span>
            <span className="text-red-400">L: {stats.losses}</span>
          </div>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 flex flex-col gap-2">
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  icon={getNotificationIcon(notif.type)}
                  colorClass={getNotificationColor(notif.type)}
                  formatTime={formatTime}
                  compact
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({
  notification, icon, colorClass, formatTime, compact = false,
}: {
  notification: import('@/lib/notifications').Notification;
  icon: string;
  colorClass: string;
  formatTime: (ts: number) => string;
  compact?: boolean;
}) {
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const clearNotification = useNotificationStore((s) => s.clearNotification);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-lg border p-3 ${colorClass}`}
      style={{ opacity: notification.read ? 0.6 : 1, padding: compact ? '0.5rem 0.75rem' : '0.75rem' }}
    >
      <div className="flex gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: compact ? '0.875rem' : '1.125rem' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}
              style={{ color: notification.read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
              {notification.title}
            </span>
            <button onClick={() => clearNotification(notification.id)} className="p-0.5 rounded hover:bg-white/5 transition-colors ml-2">
              <X className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
          {notification.message && (
            <div className={`text-xs text-zinc-400 mb-1 ${compact ? 'text-[10px]' : ''}`}>
              {notification.message}
            </div>
          )}
          {notification.data && (notification.data.strategy as string | undefined) && !compact && (
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 mb-2">
              <span>📈 {(notification.data.strategy as string)}</span>
              {notification.data.balance !== undefined && (
                <span>💰 ${(notification.data.balance as number).toFixed(2)}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(notification.timestamp)}
            </span>
            {!notification.read && (
              <>
                <span>•</span>
                <button onClick={() => markAsRead(notification.id)} className="flex items-center gap-1 hover:text-green-400 transition-colors">
                  <Check className="w-3 h-3" />
                  Olvasottnak
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
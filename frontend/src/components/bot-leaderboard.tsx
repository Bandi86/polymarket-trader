'use client';

import { useState, useEffect } from 'react';

interface LeaderboardEntry {
  bot_id: string;
  bot_name: string;
  strategy: string;
  rank: number;
  trades: number;
  win_rate: number;
  pnl: number;
  roi: number;
  balance: number;
}

export function BotLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const isDev = window.location.port === "3000";
        const baseUrl = isDev ? "http://localhost:3001" : window.location.origin;
        const res = await fetch(`${baseUrl}/api/competition/leaderboard`);
        const data = await res.json();
        setEntries(data.leaderboard || []);
        setLoading(false);
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-4">Loading leaderboard...</div>;
  }

  return (
    <div className="bg-gaming-surface rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Competition Leaderboard</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="py-2">#</th>
            <th className="py-2">Bot</th>
            <th className="py-2">Strategy</th>
            <th className="py-2">Trades</th>
            <th className="py-2">Win Rate</th>
            <th className="py-2">P&L</th>
            <th className="py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.bot_id} className="border-b border-gray-800">
              <td className="py-2 text-center">{entry.rank}</td>
              <td className="py-2">{entry.bot_name}</td>
              <td className="py-2">{entry.strategy}</td>
              <td className="py-2 text-center">{entry.trades}</td>
              <td className="py-2 text-center">{(entry.win_rate * 100).toFixed(1)}%</td>
              <td className={`py-2 text-center ${entry.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {entry.pnl >= 0 ? '+' : ''}{entry.pnl.toFixed(2)}
              </td>
              <td className="py-2 text-center font-bold">${entry.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
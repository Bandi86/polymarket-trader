"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { useBots, useAggregatePortfolio } from "@/hooks";

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function ExportData() {
  const { data: bots = [] } = useBots();
  const { data: agg } = useAggregatePortfolio();

  const csvHeaders = [
    "Bot ID",
    "Name",
    "Strategy",
    "Balance",
    "PnL",
    "Trades",
    "Wins",
    "Losses",
    "Win Rate",
    "ROI%",
  ];

  const csvRows = useMemo(() => {
    return bots.map((bot) => {
      const bp = agg?.bots?.find((b) => b.bot_id === bot.id);
      const balance = bp?.balance ?? bot.session.currentBalance ?? 0;
      const pnl = bp?.total_pnl ?? bot.session.pnl ?? 0;
      const trades = bp?.total_trades ?? bot.stats.trades ?? 0;
      const wins = bp?.winning_trades ?? bot.stats.wins ?? 0;
      const losses = bp?.losing_trades ?? bot.stats.losses ?? 0;
      const winRate = trades > 0 ? ((wins / trades) * 100).toFixed(1) : "0";
      const roi = bp?.roi_percent ?? 0;
      return [
        bot.id,
        bot.name,
        bot.strategy_type,
        balance.toFixed(2),
        pnl.toFixed(2),
        trades,
        wins,
        losses,
        `${winRate}%`,
        `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
      ];
    });
  }, [bots, agg]);

  function handleExportCSV() {
    const content = toCSV(csvHeaders, csvRows);
    downloadFile(
      content,
      `polymarket-bots-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8;"
    );
  }

  function handleExportJSON() {
    const exportData = bots.map((bot) => {
      const bp = agg?.bots?.find((b) => b.bot_id === bot.id);
      return {
        id: bot.id,
        name: bot.name,
        strategy: bot.strategy_type,
        status: bot.status,
        portfolio: bp
          ? {
              balance: bp.balance,
              initial_balance: bp.initial_balance,
              total_pnl: bp.total_pnl,
              total_trades: bp.total_trades,
              winning_trades: bp.winning_trades,
              losing_trades: bp.losing_trades,
              win_rate: bp.win_rate,
              roi_percent: bp.roi_percent,
              drawdown_percent: bp.drawdown_percent,
              avg_pnl_per_trade: bp.avg_pnl_per_trade,
            }
          : {
              balance: bot.session.currentBalance,
              total_pnl: bot.session.pnl,
              total_trades: bot.session.trades,
            },
        session: bot.session,
        stats: bot.stats,
        created_at: bot.created_at,
      };
    });

    downloadFile(
      JSON.stringify(exportData, null, 2),
      `polymarket-bots-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json;charset=utf-8;"
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        disabled={bots.length === 0}
        className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </button>
      <button
        onClick={handleExportJSON}
        disabled={bots.length === 0}
        className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-3.5 w-3.5" />
        Export JSON
      </button>
    </div>
  );
}

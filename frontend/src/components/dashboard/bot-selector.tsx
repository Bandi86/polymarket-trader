"use client";

import { Crosshair, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, SkeletonCard } from "@/components/ui";
import { useBots, useStartBot, useStopBot } from "@/hooks";
import { apiFetch } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { Bot as BotType } from "@/types";
import { BotDetailCard } from "./bot-detail-card";
import { BotRow } from "./bot-row";

export function BotSelector() {
  const { data: botsFromApi, isLoading, isFetching } = useBots();
  const { selectedBotIds, setSelectedBotIds } = useAppStore();
  const startBotMutation = useStartBot();
  const stopBotMutation = useStopBot();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const botList = botsFromApi ?? [];
  const isMutating = startBotMutation.isPending || stopBotMutation.isPending;

  const startBot = (id: number) => {
    startBotMutation.mutate(id, {
      onSuccess: () => toast.success("Bot elindítva"),
      onError: (err) => toast.error(err.message || "Hiba a bot indításakor"),
    });
  };

  const stopBot = (id: number) => {
    stopBotMutation.mutate(id, {
      onSuccess: () => toast.success("Bot leállítva"),
      onError: (err) => toast.error(err.message || "Hiba a bot leállításakor"),
    });
  };

  const handleToggle = (id: number) => {
    if (selectedBotIds.includes(id)) {
      setSelectedBotIds(selectedBotIds.filter((bid) => bid !== id));
    } else if (selectedBotIds.length < 2) {
      setSelectedBotIds([...selectedBotIds, id]);
    } else {
      toast.error("Maximum 2 bot választható ki egyszerre");
    }
  };

  const deleteBot = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/bots/${id}`, { method: "DELETE" });
      toast.success("Bot törölve!");
      if (selectedBotIds.includes(id)) {
        setSelectedBotIds(selectedBotIds.filter((bid) => bid !== id));
      }
    } catch {
      toast.error("Hiba a bot törlésekor");
    } finally {
      setDeletingId(null);
    }
  };

  const runningBots = botList.filter((b) => b.status === "running");
  const idleBots = botList.filter((b) => b.status !== "running");

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-sm text-zinc-500">Botok betöltése...</span>
        </div>
        <SkeletonCard variant="bot-row" count={3} />
      </div>
    );
  }

  if (botList.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl overflow-hidden flex flex-col">
        <EmptyState
          variant="bot"
          title="Nincsenek botok"
          description="Hozz létre egy botot a Botok oldalon"
          action={
            <a href="/bots" className="btn-primary text-sm">
              Bot létrehozása
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15">
            <Crosshair className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-zinc-200">Botok</span>
            <span className="text-xs text-zinc-500">
              {runningBots.length > 0 && (
                <span className="text-green-400">{runningBots.length} fut </span>
              )}
              <span>{botList.length} összes</span>
            </span>
          </div>
        </div>
        {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 text-zinc-600 animate-spin" />}
      </div>

      {/* Bot list */}
      <div
        className="px-2 pb-3 overflow-y-auto flex-1 space-y-0.5"
        style={{ maxHeight: "calc(100vh - 280px)" }}
      >
        {/* Running section */}
        {runningBots.length > 0 && (
          <>
            <div className="px-2 py-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-400/60">
                Futó botok ({runningBots.length})
              </span>
            </div>
            {runningBots.map((bot) => (
              <BotRow
                key={bot.id}
                bot={bot}
                isSelected={selectedBotIds.includes(bot.id)}
                isRunning={true}
                onToggle={() => handleToggle(bot.id)}
                onStart={startBot}
                onStop={stopBot}
                onDelete={deleteBot}
                isDeleting={deletingId === bot.id}
                isMutating={isMutating}
              />
            ))}
          </>
        )}

        {/* Idle section */}
        {idleBots.length > 0 && (
          <>
            <div className="px-2 py-1 mt-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500/60">
                Tétlen ({idleBots.length})
              </span>
            </div>
            {idleBots.map((bot) => (
              <BotRow
                key={bot.id}
                bot={bot}
                isSelected={selectedBotIds.includes(bot.id)}
                isRunning={false}
                onToggle={() => handleToggle(bot.id)}
                onStart={startBot}
                onStop={stopBot}
                onDelete={deleteBot}
                isDeleting={deletingId === bot.id}
                isMutating={isMutating}
              />
            ))}
          </>
        )}

        {/* Selected bot details */}
        {selectedBotIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
            <span className="px-2 text-[9px] font-bold uppercase tracking-wider text-indigo-400/60">
              Részletek
            </span>
            {botList
              .filter((b: BotType) => selectedBotIds.includes(b.id))
              .map((bot) => (
                <BotDetailCard
                  key={bot.id}
                  bot={bot}
                  isRunning={bot.status === "running"}
                  onStart={startBot}
                  onStop={stopBot}
                  isMutating={isMutating}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

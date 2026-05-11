// useTradingData - Re-exports BotData for backward compatibility
// The BotData type is defined in @/types as 'Bot'
import type { Bot } from "@/types";

// Re-export as BotData for useBotStatusState and other consumers
export type BotData = Bot;

// Re-export Position for convenience
export type { Position } from "@/types";

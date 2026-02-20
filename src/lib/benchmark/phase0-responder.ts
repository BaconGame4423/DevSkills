import type { Phase0Config } from "./types.js";
import { capturePaneContent, pasteBuffer, sendKeys } from "./tmux.js";

export function matchResponse(
  paneContent: string,
  config: Phase0Config
): string | null {
  for (const entry of config.responses) {
    if (paneContent.includes(entry.pattern)) {
      return entry.response;
    }
  }
  return null;
}

export function respondToPhase0(
  paneId: string,
  config: Phase0Config,
  turnCount: number
): { responded: boolean; turnCount: number; done: boolean } {
  if (turnCount >= config.max_turns) {
    return { responded: false, turnCount, done: true };
  }

  const paneContent = capturePaneContent(paneId);

  if (!paneContent.includes("?") && !paneContent.includes("？")) {
    return { responded: false, turnCount, done: false };
  }

  const response = matchResponse(paneContent, config);
  const textToSend = response ?? config.fallback;

  pasteBuffer(paneId, `phase0-buf-${Date.now()}`, textToSend);
  sendKeys(paneId, "Enter");

  const newTurnCount = turnCount + 1;
  const done = newTurnCount >= config.max_turns;

  return { responded: true, turnCount: newTurnCount, done };
}

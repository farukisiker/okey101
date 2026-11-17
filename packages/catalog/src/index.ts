// A2 (Claude Opus): the registry of every game in Demli Kahve.
import type { AnyGameDefinition, GameId, GameMeta, TableGroup } from '@kahve/core';
import { okey101Def, okeyDuzDef } from './okey';
import { pistiDef } from './pisti';
import { batakDef } from './batak';
import { tavlaDef } from './tavla';

export * from './okey';
export * from './pisti';
export * from './batak';
export * from './tavla';

const meta = (id: GameId, group: TableGroup, seatChoices: readonly number[]): GameMeta => ({
  id,
  group,
  status: 'soon',
  seatChoices,
  titleKey: `game.${id}`,
});

const DEFINITIONS: Partial<Record<GameId, AnyGameDefinition>> = {
  okey101: okey101Def,
  okeyDuz: okeyDuzDef,
  pisti: pistiDef,
  batak: batakDef,
  tavla: tavlaDef,
};

const toMeta = ({ id, group, status, seatChoices, titleKey }: GameMeta): GameMeta => ({ id, group, status, seatChoices, titleKey });

export const CATALOG: readonly GameMeta[] = [
  toMeta(okey101Def),
  toMeta(okeyDuzDef),
  toMeta(pistiDef),
  toMeta(batakDef),
  toMeta(tavlaDef),
  meta('king', 'kagit', [4]),
  meta('konken', 'kagit', [4]),
  meta('elli1', 'kagit', [4]),
];

/**
 * Pause between two actions of the same bot turn, for games whose turn is several actions (tavla: each checker
 * step, then the commit). The first action of a turn still waits the host's full bot delay (time to see the dice);
 * the steps after it follow at this pace so the move reads like a person playing. Games not listed keep the full
 * bot delay for every action (card games and okey are unchanged).
 */
export const BOT_STEP_DELAY_MS: Partial<Record<GameId, number>> = { tavla: 600 };

/** The step delay a host uses for `id` given its bot delay (never longer than the bot delay itself). */
export function botStepDelayMs(id: GameId, botDelayMs: number): number {
  return Math.min(botDelayMs, BOT_STEP_DELAY_MS[id] ?? botDelayMs);
}

/** The playable definition, or null for unknown or "Yakında" games. */
export function getDefinition(id: GameId): AnyGameDefinition | null {
  return DEFINITIONS[id] ?? null;
}

export function gamesInGroup(group: TableGroup): GameMeta[] {
  return CATALOG.filter((g) => g.group === group);
}

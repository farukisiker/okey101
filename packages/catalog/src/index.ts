// A2 (Claude Opus): the registry of every game in Demli Kahve.
import type { AnyGameDefinition, GameId, GameMeta, TableGroup } from '@kahve/core';
import { okey101Def, okeyDuzDef } from './okey';

export * from './okey';

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
};

const toMeta = ({ id, group, status, seatChoices, titleKey }: GameMeta): GameMeta => ({ id, group, status, seatChoices, titleKey });

export const CATALOG: readonly GameMeta[] = [
  toMeta(okey101Def),
  toMeta(okeyDuzDef),
  meta('pisti', 'kagit', [2, 4]),
  meta('batak', 'kagit', [4]),
  meta('tavla', 'tavla', [2]),
  meta('king', 'kagit', [4]),
  meta('konken', 'kagit', [4]),
  meta('elli1', 'kagit', [4]),
];

/** The playable definition, or null for unknown or "Yakında" games. */
export function getDefinition(id: GameId): AnyGameDefinition | null {
  return DEFINITIONS[id] ?? null;
}

export function gamesInGroup(group: TableGroup): GameMeta[] {
  return CATALOG.filter((g) => g.group === group);
}

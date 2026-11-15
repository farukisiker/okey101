import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameId, GameMeta, TableGroup } from '@kahve/core';
import type { Key } from '../i18n';

/** Temporary list (same shape as GameMeta); switches to `@kahve/catalog` once A2 lands. */
export const KAHVE_GAMES: readonly GameMeta[] = [
  { id: 'okey101', group: 'okey', status: 'active', seatChoices: [4], titleKey: 'game.okey101' },
  { id: 'okeyDuz', group: 'okey', status: 'active', seatChoices: [4], titleKey: 'game.okeyDuz' },
  { id: 'pisti', group: 'kagit', status: 'soon', seatChoices: [2, 4], titleKey: 'game.pisti' },
  { id: 'batak', group: 'kagit', status: 'soon', seatChoices: [4], titleKey: 'game.batak' },
  { id: 'king', group: 'kagit', status: 'soon', seatChoices: [4], titleKey: 'game.king' },
  { id: 'konken', group: 'kagit', status: 'soon', seatChoices: [4], titleKey: 'game.konken' },
  { id: 'elli1', group: 'kagit', status: 'soon', seatChoices: [4], titleKey: 'game.elli1' },
  { id: 'tavla', group: 'tavla', status: 'soon', seatChoices: [2], titleKey: 'game.tavla' },
];

export const gamesOf = (group: TableGroup) => KAHVE_GAMES.filter((g) => g.group === group);

/** titleKey is a plain string in the frozen contract; every id has its key in tr.ts. */
export const gameTitleKey = (g: GameMeta) => g.titleKey as Key;

const LAST_KEY = 'okey101.lastGame';

export async function loadLastGame(): Promise<GameId | null> {
  try {
    const v = await AsyncStorage.getItem(LAST_KEY);
    return v === 'okey101' || v === 'okeyDuz' ? v : null;
  } catch {
    return null;
  }
}

export function saveLastGame(id: GameId) {
  AsyncStorage.setItem(LAST_KEY, id).catch(() => {});
}

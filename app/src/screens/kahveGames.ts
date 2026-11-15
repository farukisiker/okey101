import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATALOG, gamesInGroup } from '@kahve/catalog';
import type { GameId, GameMeta, TableGroup } from '@kahve/core';
import type { Key } from '../i18n';

export const KAHVE_GAMES: readonly GameMeta[] = CATALOG;

export const gamesOf = (group: TableGroup) => gamesInGroup(group);

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

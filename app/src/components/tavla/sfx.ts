import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
import { buzz, isSoundOn } from '../../feedback';

export type TavlaSfx = 'dice' | 'move' | 'hit';

const SOURCES: Record<TavlaSfx, number> = {
  dice: require('../../../assets/sounds/dice-roll.wav'),
  move: require('../../../assets/sounds/checker-move.wav'),
  hit: require('../../../assets/sounds/checker-hit.wav'),
};
const players: Partial<Record<TavlaSfx, AudioPlayer>> = {};
for (const key of Object.keys(SOURCES) as TavlaSfx[]) {
  try {
    players[key] = createAudioPlayer(SOURCES[key]);
  } catch {
    // No audio backend: the game stays silent.
  }
}

export function playTavlaSfx(sfx: TavlaSfx, volume = 1) {
  if (!isSoundOn()) return;
  const p = players[sfx];
  if (!p) return;
  try {
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // A sound must never break the game.
  }
}

/** Sound plus a light vibration for one checker move (a hit is heavier). */
export function checkerFeedback(hit: boolean) {
  playTavlaSfx(hit ? 'hit' : 'move');
  buzz(hit ? 'medium' : 'light');
}

export function diceFeedback() {
  playTavlaSfx('dice');
}

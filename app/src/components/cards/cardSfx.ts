import { type AudioPlayer, createAudioPlayer } from 'expo-audio';
import { buzz, isSoundOn } from '../../feedback';

export type CardSfx = 'play' | 'take';

/**
 * Audio sources registry.
 * In this headless run without .wav files, no missing assets are required directly.
 * Fable will register actual sound assets here once created.
 */
const CARD_AUDIO_SOURCES: Partial<Record<CardSfx, number>> = {};
const cardPlayers: Partial<Record<CardSfx, AudioPlayer>> = {};

/**
 * Registers an audio source for card sound effects.
 */
export function registerCardAudioSource(key: CardSfx, source: number) {
  CARD_AUDIO_SOURCES[key] = source;
  try {
    cardPlayers[key] = createAudioPlayer(source);
  } catch {
    // Missing audio backend or unsupported environment
  }
}

/**
 * Plays a card sound effect if sound is enabled and the player is available.
 */
export function playCardSfx(sfx: CardSfx, volume = 1) {
  if (!isSoundOn()) return;
  const p = cardPlayers[sfx];
  if (!p) return;
  try {
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio playback must never crash the game
  }
}

/**
 * Feedback for playing a card (sound + light haptic).
 */
export function cardPlayFeedback() {
  playCardSfx('play');
  buzz('light');
}

/**
 * Feedback for taking a trick or pile (sound + medium or success haptic).
 */
export function cardTakeFeedback(isPisti = false) {
  playCardSfx('take');
  buzz(isPisti ? 'success' : 'medium');
}

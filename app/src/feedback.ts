import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/** Short table sounds: tiles clacking, a soft bell when it's your turn. */
export type Sfx = 'place' | 'draw' | 'discard' | 'turn' | 'open' | 'win' | 'error';

const SOURCES: Record<Sfx, number> = {
  place: require('../assets/sounds/place.wav'),
  draw: require('../assets/sounds/draw.wav'),
  discard: require('../assets/sounds/discard.wav'),
  turn: require('../assets/sounds/turn.wav'),
  open: require('../assets/sounds/open.wav'),
  win: require('../assets/sounds/win.wav'),
  error: require('../assets/sounds/error.wav'),
};

const SOUND_KEY = 'okey101.sound';
let players: Partial<Record<Sfx, AudioPlayer>> = {};
let soundOn = true;
let ready = false;

/** Loads the sound setting and preloads the clips. Safe to call more than once. */
export async function initFeedback(): Promise<boolean> {
  if (ready) return soundOn;
  ready = true;
  try {
    soundOn = (await AsyncStorage.getItem(SOUND_KEY)) !== 'off';
  } catch {
    soundOn = true;
  }
  try {
    // Older players often leave the silent switch on without knowing; the in-game toggle decides.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
  } catch {
    // Audio session unavailable (e.g. web without a user gesture yet); sounds just stay quiet.
  }
  players = {};
  for (const key of Object.keys(SOURCES) as Sfx[]) {
    try {
      players[key] = createAudioPlayer(SOURCES[key]);
    } catch {
      // Missing audio backend: keep going without this clip.
    }
  }
  return soundOn;
}

export function isSoundOn() {
  return soundOn;
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  AsyncStorage.setItem(SOUND_KEY, on ? 'on' : 'off').catch(() => {});
  if (on) play('place');
}

export function play(sfx: Sfx, volume = 1) {
  if (!soundOn) return;
  const p = players[sfx];
  if (!p) return;
  try {
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Never let a sound break the game.
  }
}

type Buzz = 'light' | 'medium' | 'success' | 'warning';

export function buzz(kind: Buzz) {
  try {
    const p =
      kind === 'light'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : kind === 'medium'
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          : Haptics.notificationAsync(
              kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
            );
    p.catch(() => {});
  } catch {
    // No haptics on this device.
  }
}

/** Sound plus a matching vibration for the player's own actions. */
export function feedback(sfx: Sfx) {
  play(sfx);
  if (sfx === 'place' || sfx === 'draw') buzz('light');
  else if (sfx === 'discard') buzz('medium');
  else if (sfx === 'turn' || sfx === 'open' || sfx === 'win') buzz('success');
  else if (sfx === 'error') buzz('warning');
}

// ---- Remembered player name ----

const NAME_KEY = 'okey101.name';

export async function loadName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function saveName(name: string) {
  AsyncStorage.setItem(NAME_KEY, name).catch(() => {});
}

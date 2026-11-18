import { createHmac, randomBytes } from 'node:crypto';

/*
 * E2: LiveKit access tokens for table voice chat, signed here with node:crypto (no LiveKit SDK).
 * LiveKit tokens are HS256 JWTs: iss = API key, sub = participant identity, `video` = the grant.
 * Nothing is recorded; the server only hands out tokens. Keys come from the environment only.
 */

export interface LiveKitConfig {
  /** wss://… address the app connects to. */
  url: string;
  apiKey: string;
  apiSecret: string;
}

/** Env var names (values never live in the repo): LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Null when any is missing. */
export function liveKitConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LiveKitConfig | null {
  const url = env.LIVEKIT_URL?.trim();
  const apiKey = env.LIVEKIT_API_KEY?.trim();
  const apiSecret = env.LIVEKIT_API_SECRET?.trim();
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

export const VOICE_TOKEN_TTL_SEC = 2 * 60 * 60;

export interface VoiceGrant {
  room: string;
  roomJoin: true;
  canPublish: true;
  canSubscribe: true;
  canPublishData: false;
  /** Microphone only: a modified app can't publish camera or screen at a table. */
  canPublishSources: ['microphone'];
}

export interface VoiceClaims {
  iss: string;
  sub: string;
  name: string;
  nbf: number;
  iat: number;
  exp: number;
  video: VoiceGrant;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** Signs a LiveKit token for one participant of one room. `nowMs` for tests. */
export function liveKitToken(
  cfg: Pick<LiveKitConfig, 'apiKey' | 'apiSecret'>,
  p: { room: string; identity: string; name: string; ttlSec?: number; nowMs?: number },
): string {
  const now = Math.floor((p.nowMs ?? Date.now()) / 1000);
  const claims: VoiceClaims = {
    iss: cfg.apiKey,
    sub: p.identity,
    name: p.name,
    nbf: now,
    iat: now,
    exp: now + (p.ttlSec ?? VOICE_TOKEN_TTL_SEC),
    video: {
      room: p.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ['microphone'],
    },
  };
  const head = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  return `${head}.${createHmac('sha256', cfg.apiSecret).update(head).digest('base64url')}`;
}

/** Random part of a participant identity (`s<seat>-<this>`). */
export const identitySuffix = () => randomBytes(6).toString('hex');

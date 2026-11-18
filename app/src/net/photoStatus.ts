import type { Key } from '../i18n/tr';
import type { AccountsErrorCode, PhotoStatus, ReasonCode } from './accountsClient';

/** Status line key. `review` looks the same as `pending` to the player. */
export function photoStatusKey(status: PhotoStatus): Key {
  switch (status) {
    case 'pending':
    case 'review':
      return 'profPhotoPending';
    case 'approved':
      return 'profPhotoApproved';
    case 'rejected':
      return 'profPhotoRejected';
    default:
      return 'profPhotoNone';
  }
}

export const REASON_KEYS: Record<ReasonCode, Key> = {
  nudity: 'profReasonNudity',
  violence: 'profReasonViolence',
  hate: 'profReasonHate',
  selfHarm: 'profReasonSelfHarm',
  text: 'profReasonText',
  symbol: 'profReasonSymbol',
  child: 'profReasonChild',
  otherPerson: 'profReasonOtherPerson',
  document: 'profReasonDocument',
  other: 'profReasonOther',
};

/** Reason texts for a rejected photo; an unknown code from a newer server falls back to "other". */
export function reasonKeys(reasons: readonly string[]): Key[] {
  const seen = new Set<Key>();
  for (const r of reasons) seen.add(REASON_KEYS[r as ReasonCode] ?? 'profReasonOther');
  return [...seen];
}

/** Photo is waiting for a decision, so the screen keeps polling. */
export const isWaiting = (status: PhotoStatus) => status === 'pending' || status === 'review';

export function errorKey(code: AccountsErrorCode | 'permission'): Key {
  switch (code) {
    case 'rate_limited':
      return 'profErrLimit';
    case 'bad_image':
    case 'too_large':
      return 'profErrImage';
    case 'permission':
      return 'profErrPerm';
    case 'already_linked':
      return 'profErrLinked';
    case 'invalid_token':
      return 'profErrToken';
    case 'not_configured':
      return 'profErrSignInOff';
    default:
      return 'profErrNet';
  }
}

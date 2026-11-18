export type PhotoStatus = 'none' | 'pending' | 'review' | 'approved' | 'rejected';
export type ReasonCode =
  | 'nudity'
  | 'violence'
  | 'hate'
  | 'selfHarm'
  | 'text'
  | 'symbol'
  | 'child'
  | 'otherPerson'
  | 'document'
  | 'other';

export const REASON_CODES: readonly ReasonCode[] = [
  'nudity',
  'violence',
  'hate',
  'selfHarm',
  'text',
  'symbol',
  'child',
  'otherPerson',
  'document',
  'other',
];

export function isReasonCode(v: unknown): v is ReasonCode {
  return typeof v === 'string' && (REASON_CODES as readonly string[]).includes(v);
}

export type Provider = 'apple' | 'google';
export const PROVIDERS: readonly Provider[] = ['apple', 'google'];

export interface Me {
  accountId: string;
  displayName: string | null;
  photoConsent: boolean;
  uploadsLeftToday: number;
  photo: { status: PhotoStatus; reasons: ReasonCode[]; url: string | null };
  /** Linked sign-in providers, in a fixed order (apple, google). */
  providers: Provider[];
}

export interface AuthResult {
  accountId: string;
  token: string;
  /** true: the provider identity belonged to another (existing) account and the caller is now signed in to it. */
  switched: boolean;
}

export type ErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'too_large'
  | 'bad_image'
  | 'rate_limited'
  | 'consent_required'
  | 'not_found'
  | 'invalid_token'
  | 'already_linked'
  | 'not_configured'
  | 'unavailable';

export interface AdminPhotoItem {
  accountId: string;
  displayName: string | null;
  status: PhotoStatus;
  reasons: ReasonCode[];
  uploadedAt: number;
}

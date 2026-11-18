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

export interface Me {
  accountId: string;
  displayName: string | null;
  photoConsent: boolean;
  uploadsLeftToday: number;
  photo: { status: PhotoStatus; reasons: ReasonCode[]; url: string | null };
}

export type ErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'too_large'
  | 'bad_image'
  | 'rate_limited'
  | 'consent_required'
  | 'not_found';

export interface AdminPhotoItem {
  accountId: string;
  displayName: string | null;
  status: PhotoStatus;
  reasons: ReasonCode[];
  uploadedAt: number;
}

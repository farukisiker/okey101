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
  /**
   * E2: epoch ms until which voice chat is off for this account (3 different people reported it within 7 days),
   * null when not banned. Informational in E2: the app keeps its own microphone off; the game server does not enforce it yet.
   */
  voiceBannedUntil: number | null;
}

// ---------------------------------------------------------------- E2 reports and blocks
export type ReportReason = 'insult' | 'harass' | 'askGift' | 'spam' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = ['insult', 'harass', 'askGift', 'spam', 'other'];
export const isReportReason = (v: unknown): v is ReportReason => typeof v === 'string' && (REPORT_REASONS as readonly string[]).includes(v);

/** Where the reported behaviour happened. */
export type ReportContext = 'voice' | 'saying' | 'photo' | 'name';
export const REPORT_CONTEXTS: readonly ReportContext[] = ['voice', 'saying', 'photo', 'name'];
export const isReportContext = (v: unknown): v is ReportContext => typeof v === 'string' && (REPORT_CONTEXTS as readonly string[]).includes(v);

/** 'open' until an admin closes (dismisses) the target's reports. */
export type ReportStatus = 'open' | 'closed';
export const REPORT_STATUSES: readonly ReportStatus[] = ['open', 'closed'];

/** One reported account in the admin list: its reports of the last 7 days with the given status. */
export interface AdminReportItem {
  targetAccountId: string;
  displayName: string | null;
  /** Reports in the window (one person may report more than once). */
  count: number;
  /** Different people who reported. */
  reporters: number;
  reasons: Partial<Record<ReportReason, number>>;
  contexts: Partial<Record<ReportContext, number>>;
  lastAt: number;
  voiceBannedUntil: number | null;
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
  | 'unavailable'
  /** E2: the block list is full (MAX_BLOCKS). */
  | 'limit_reached';

export interface AdminPhotoItem {
  accountId: string;
  displayName: string | null;
  status: PhotoStatus;
  reasons: ReasonCode[];
  uploadedAt: number;
}

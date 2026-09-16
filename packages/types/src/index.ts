// ============================================================
// PriorityMail — Shared Type Definitions
// Used by: web, mobile, backend, packages/priority-engine
// ============================================================

// ------------------------------------------------------------------
// Primitives
// ------------------------------------------------------------------

export type Priority = 'urgent' | 'high' | 'normal' | 'fyi';

export type Category =
  | 'work'
  | 'internship'
  | 'college'
  | 'academic'
  | 'personal';

export type PriorityRuleType =
  | 'label'
  | 'sender'
  | 'domain'
  | 'keyword'
  | 'subject_keyword'
  | 'vip';

export type PrioritySensitivity = 'Low' | 'Balanced' | 'High';

// ------------------------------------------------------------------
// Auth / User
// ------------------------------------------------------------------

/** A signed-in PriorityMail user (returned by GET /api/auth/me). */
export interface User {
  id: string;
  googleUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string; // ISO-8601
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' };

// ------------------------------------------------------------------
// Connected Gmail Accounts
// ------------------------------------------------------------------

/**
 * A Gmail account the user has explicitly connected in PriorityMail.
 * This is separate from the login account.
 */
export interface ConnectedGoogleAccount {
  id: string;
  userId: string;
  googleUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isPrimary: boolean;
  createdAt: string; // ISO-8601
}

// ------------------------------------------------------------------
// Gmail Credentials (server-side only, never sent to client)
// ------------------------------------------------------------------

/** Stored in DB — never exposed via API. */
export interface GmailCredential {
  id: string;
  connectedAccountId: string;
  // Tokens are stored AES-256-GCM encrypted. Fields below are for
  // internal service use after decryption; they are NOT in API responses.
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO-8601
  scope: string;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------
// Priority Rules & VIP People
// ------------------------------------------------------------------

export interface PriorityRule {
  id: string;
  type: PriorityRuleType;
  value: string;
  weight?: number;
  enabled: boolean;
  description?: string;
}

export interface VipPerson {
  id: string;
  name: string;
  email: string;
  category: string;
  createdAt?: string;
}

// ------------------------------------------------------------------
// Normalized Email (the canonical PriorityMail email shape)
// ------------------------------------------------------------------

/**
 * Normalized email from Gmail API. Every real and mock email MUST
 * include these fields. Priority fields are added after engine runs.
 */
export interface NormalizedEmail {
  connectedAccountId: string;
  accountEmail: string;
  gmailMessageId: string;
  gmailThreadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body?: string;
  receivedAt: string; // ISO-8601 or human-relative string
  labelIds: string[];
  isRead: boolean;
}

/**
 * A NormalizedEmail after the priority engine has processed it.
 * This is what the UI renders.
 */
export interface PriorityEmail extends NormalizedEmail {
  /** UI-stable ID (= gmailMessageId or mock id) */
  id: string;
  /** Alias kept for UI backward-compat */
  accountId: string;
  category: Category;
  priority: Priority;
  actionRequired: boolean;
  reason: string;
  reasons: string[];
  score?: number;
  deadline?: string;
  isCompleted: boolean;
  snoozedUntil?: string | null;
}

// ------------------------------------------------------------------
// Email Metadata (persisted server-side per user)
// ------------------------------------------------------------------

export interface EmailMetadata {
  id: string;
  userId: string;
  connectedAccountId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  isRead: boolean;
  isCompleted: boolean;
  snoozedUntil?: string | null;
  updatedAt: string;
}

// ------------------------------------------------------------------
// Priority Engine result
// ------------------------------------------------------------------

export interface PriorityCalculationResult {
  priority: Priority;
  category: Category;
  actionRequired: boolean;
  reasons: string[];
  reason: string;
  score: number;
}

// ------------------------------------------------------------------
// API response envelope
// ------------------------------------------------------------------

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

// ------------------------------------------------------------------
// Connected Account (legacy shape used in web UI — maps from ConnectedGoogleAccount)
// ------------------------------------------------------------------

export interface ConnectedAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isPrimary: boolean;
  /** 'demo' = mock, 'connected' = real OAuth */
  status: 'demo' | 'connected';
}

// ------------------------------------------------------------------
// App Settings (web local state)
// ------------------------------------------------------------------

export interface AppSettings {
  userName: string;
  pushNotifications: boolean;
  aiClassification: boolean;
  deadlineAlerts: boolean;
  vipAlerts: boolean;
  quietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  prioritySensitivity: PrioritySensitivity;
  googleAccountConnected: boolean;
  connectedEmail?: string;
}

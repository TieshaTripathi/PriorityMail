export type Priority = 'urgent' | 'high' | 'normal' | 'fyi';

export type Category = 'work' | 'internship' | 'college' | 'academic' | 'personal';

export interface ConnectedAccount {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isPrimary: boolean;
  status: 'demo' | 'connected';
}

export interface PriorityEmail {
  accountId: string;
  accountEmail: string;
  gmailMessageId: string;
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body?: string;
  category: Category;
  priority: Priority;
  actionRequired: boolean;
  reason: string;
  reasons: string[];
  receivedAt: string;
  deadline?: string;
  gmailThreadId: string;
  isRead: boolean;
  isCompleted: boolean;
  snoozedUntil?: string | null;
  score?: number;
}

export type PriorityRuleType =
  | 'label'
  | 'sender'
  | 'domain'
  | 'keyword'
  | 'subject_keyword'
  | 'vip';

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

export type PrioritySensitivity = 'Low' | 'Balanced' | 'High';

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

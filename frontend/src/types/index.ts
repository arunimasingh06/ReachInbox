export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  senders?: { id: string; email: string; name: string | null }[];
  slackIntegration?: {
    teamName: string | null;
    channel: string | null;
    updatedAt: string;
  } | null;
}

export type EmailStatus = 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface ScheduledEmail {
  id: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: EmailStatus;
  sentAt?: string | null;
  error?: string | null;
  jobId?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
}

export interface ScheduleFormInput {
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string | Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface SlackStatus {
  connected: boolean;
  details?: {
    teamName: string | null;
    channel: string | null;
    updatedAt: string;
  } | null;
}

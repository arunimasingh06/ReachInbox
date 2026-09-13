export interface EmailJobData {
  emailId: string;
  userId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface ScheduleEmailInput {
  senderEmail: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string | Date;
  delayBetweenEmails?: number; // seconds
  hourlyLimit?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

export interface SearchQueryParams {
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}

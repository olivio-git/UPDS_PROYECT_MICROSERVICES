export interface EmailNotification {
  _id?: string;
  to: string;
  from?: string;
  subject: string;
  template: string;
  templateData: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
  lastAttempt?: Date;
  sentAt?: Date;
  failureReason?: string;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplate {
  _id?: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  category: 'auth' | 'otp' | 'exam' | 'result' | 'general';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtpEmailData {
  email: string;
  code: string;
  purpose: string;
  expiresAt: Date;
  templateData: {
    purpose: string;
    expiryMinutes: number;
  };
}

export interface UserEventData {
  userId: string;
  email: string;
  eventType: string;
  timestamp: Date;
  [key: string]: any;
}

export interface EmailQueue {
  _id?: string;
  emailId: string;
  priority: number;
  scheduledAt: Date;
  processedAt?: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface KafkaMessage {
  timestamp: string;
  eventType: string;
  service: string;
  data: any;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

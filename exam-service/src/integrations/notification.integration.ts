import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface IEmailData {
  to: string;
  subject?: string;
  template?: string;
  data: any;
}

export class NotificationIntegration {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3001/notifications',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async sendExamScheduledEmail(candidateEmail: string, examData: any): Promise<boolean> {
    try {
      const response = await this.client.post('/send', {
        to: candidateEmail,
        type: 'exam_scheduled',
        data: {
          examName: examData.examName,
          sessionDate: examData.sessionDate,
          sessionTime: examData.sessionTime,
          duration: examData.duration,
          location: examData.location || 'Online',
          candidateName: examData.candidateName
        }
      });
      return response.data.success === true;
    } catch (error) {
      logger.error('Error sending exam scheduled email:', error);
      return false;
    }
  }

  async sendExamReminderEmail(candidateEmail: string, examData: any): Promise<boolean> {
    try {
      const response = await this.client.post('/send', {
        to: candidateEmail,
        type: 'exam_reminder',
        data: {
          examName: examData.examName,
          sessionDate: examData.sessionDate,
          sessionTime: examData.sessionTime,
          hoursUntilExam: examData.hoursUntilExam,
          candidateName: examData.candidateName
        }
      });
      return response.data.success === true;
    } catch (error) {
      logger.error('Error sending exam reminder email:', error);
      return false;
    }
  }

  async sendExamResultsEmail(candidateEmail: string, resultsData: any): Promise<boolean> {
    try {
      const response = await this.client.post('/send', {
        to: candidateEmail,
        type: 'exam_results',
        data: {
          examName: resultsData.examName,
          candidateName: resultsData.candidateName,
          score: resultsData.score,
          level: resultsData.level,
          passed: resultsData.passed,
          competencyScores: resultsData.competencyScores,
          feedback: resultsData.feedback
        }
      });
      return response.data.success === true;
    } catch (error) {
      logger.error('Error sending exam results email:', error);
      return false;
    }
  }

  async sendSessionCancelledEmail(emails: string[], sessionData: any): Promise<boolean> {
    try {
      const promises = emails.map(email => 
        this.client.post('/send', {
          to: email,
          type: 'session_cancelled',
          data: {
            sessionName: sessionData.sessionName,
            originalDate: sessionData.originalDate,
            reason: sessionData.reason || 'Administrative reasons'
          }
        })
      );

      const results = await Promise.all(promises);
      return results.every(r => r.data.success === true);
    } catch (error) {
      logger.error('Error sending session cancelled emails:', error);
      return false;
    }
  }

  async sendProctorAssignmentEmail(proctorEmail: string, sessionData: any): Promise<boolean> {
    try {
      const response = await this.client.post('/send', {
        to: proctorEmail,
        type: 'proctor_assignment',
        data: {
          sessionName: sessionData.sessionName,
          sessionDate: sessionData.sessionDate,
          sessionTime: sessionData.sessionTime,
          candidateCount: sessionData.candidateCount,
          examName: sessionData.examName,
          proctorName: sessionData.proctorName
        }
      });
      return response.data.success === true;
    } catch (error) {
      logger.error('Error sending proctor assignment email:', error);
      return false;
    }
  }
}

import axios from 'axios';
import { config } from '../config.js';
import { publishKafkaEvent } from './kafka.service.js';

/**
 * Fetch the exam result PDF from exam-service's internal endpoint.
 * Returns the PDF as a base64 string, or null if unavailable (best-effort).
 */
async function fetchExamResultPDF(params: {
  examResultId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  candidateId: string;
}): Promise<string | null> {
  try {
    const { examResultId, firstName, lastName, email, candidateId } = params;
    const url = `${config.examService.url}/internal/exam-results/${examResultId}/pdf`;

    const response = await axios.get(url, {
      params: { firstName, lastName, email, candidateId },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(response.data);
    return buffer.toString('base64');
  } catch {
    // PDF fetch is best-effort — never block the email from sending
    return null;
  }
}

/**
 * Send notification via the notification-service.
 */
export async function sendGradingNotification(params: {
  candidateEmail?: string;
  candidateFirstName?: string;
  candidateLastName?: string;
  candidateId: string;
  examName: string;
  examResultId?: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: string;
}): Promise<void> {
  const {
    candidateEmail,
    candidateFirstName,
    candidateLastName,
    candidateId,
    examName,
    examResultId,
    score,
    maxScore,
    percentage,
    status,
  } = params;

  // Create in-app notification
  try {
    await axios.post(`${config.notificationService.url}/notifications/inapp`, {
      recipientId: candidateId,
      recipientType: 'candidate',
      type: 'exam.graded',
      channel: 'in-app',
      content: {
        title: 'Examen calificado',
        body: `Tu examen "${examName}" ha sido calificado. Puntaje: ${score}/${maxScore} (${percentage.toFixed(1)}%)`,
        link: `/student/results`,
      },
      priority: 'normal',
      metadata: { examName, score, maxScore, percentage, status },
    });
  } catch {
    // In-app notification is best-effort
  }

  // Send email via Kafka (lightweight — no PDF in message to stay under Kafka's 1MB limit)
  if (candidateEmail) {
    console.log(`[grading-service] Publicando exam.graded para: ${candidateEmail}`);
    try {
      await publishKafkaEvent('exam.graded', {
        candidateEmail,
        candidateFirstName: candidateFirstName || 'Estudiante',
        candidateLastName: candidateLastName || '',
        candidateId,
        examName,
        examResultId,
        score,
        maxScore,
        percentage: parseFloat(percentage.toFixed(1)),
        status,
      });
    } catch {
      // Email is best-effort
    }
  }
}

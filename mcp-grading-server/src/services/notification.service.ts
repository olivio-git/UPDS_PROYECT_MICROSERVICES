import axios from 'axios';
import { TOPICS, GRADING_RESULT_PUBLISHED, type GradingResultPublishedDataV1 } from '@cba/events';
import { config } from '../config.js';
import { publishEnvelopeEvent } from './kafka.service.js';

export interface GradingNotificationParams {
  attemptId: string;
  examId?: string;
  candidateEmail?: string;
  candidateFirstName?: string;
  candidateLastName?: string;
  candidateId: string;
  examName: string;
  examResultId: string;
  score: number;
  maxScore: number;
  percentage: number;
  status: string;
  passed?: boolean;
  passingScore?: number;
  examType?: string;
  recommendedLevel?: string;
}

/**
 * Publishes a single `grading.result.published` envelope on `grading-events`
 * (key = attemptId). This replaces both the legacy `exam.graded` Kafka
 * message (raw, non-envelope shape) and the direct HTTP POST this service
 * used to make to notifications-service's `/notifications/inapp` endpoint.
 * notifications-service derives both the email and the in-app notification
 * from this one event (see its 'notifications-grading' consumer).
 *
 * Best-effort: if Kafka is unavailable this logs a warning and returns — the
 * grading result is already saved by the time this is called, so a failed
 * notification must never fail or retry the grading flow. If the publish
 * fails, the in-app notification is still created over HTTP (the path this
 * service used before Kafka); only the email is skipped in that case.
 */
export async function sendGradingNotification(params: GradingNotificationParams): Promise<void> {
  const {
    attemptId,
    examId,
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
    passed,
    passingScore,
    examType,
    recommendedLevel,
  } = params;

  const data: GradingResultPublishedDataV1 = {
    examResultId,
    attemptId,
    candidateId,
    examId,
    examName,
    status,
    totalScore: score,
    maxScore,
    percentage: parseFloat(percentage.toFixed(1)),
    candidateEmail,
    candidateFirstName: candidateFirstName || 'Estudiante',
    candidateLastName: candidateLastName || '',
    passed,
    passingScore,
    examType,
    recommendedLevel,
  };

  const published = await publishEnvelopeEvent(TOPICS.GRADING_EVENTS, GRADING_RESULT_PUBLISHED, attemptId, data);

  if (!published) {
    console.warn(
      `[grading-service] Kafka publish failed for grading.result.published (attempt=${attemptId}, examResultId=${examResultId}) — falling back to HTTP in-app notification, email skipped`
    );
    await sendInAppFallback(data);
  }
}

async function sendInAppFallback(data: GradingResultPublishedDataV1): Promise<void> {
  try {
    await axios.post(`${config.notificationService.url}/notifications/inapp`, {
      recipientId: data.candidateId,
      recipientType: 'candidate',
      type: 'exam.graded',
      channel: 'in-app',
      content: {
        title: 'Examen calificado',
        body: `Tu examen "${data.examName}" ha sido calificado. Puntaje: ${data.totalScore}/${data.maxScore} (${data.percentage.toFixed(1)}%)`,
        link: `/student/results`,
      },
      priority: 'normal',
      metadata: {
        examName: data.examName,
        score: data.totalScore,
        maxScore: data.maxScore,
        percentage: data.percentage,
        status: data.status,
      },
    });
  } catch (error: any) {
    console.error(`[grading-service] HTTP in-app notification fallback failed (examResultId=${data.examResultId}):`, error?.message || error);
  }
}

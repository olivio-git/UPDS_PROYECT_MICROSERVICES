import type { Kafka } from 'kafkajs';
import type Redis from 'ioredis';
import {
  runConsumer,
  TOPICS,
  GRADING_RESULT_PUBLISHED,
  type GradingResultPublishedDataV1,
  type ConsumerHandle,
} from '@cba/events';
import { NotificationService } from './notification.service';
import { fetchExamResultPDF, isEmailNotificationsEnabled } from './kafka-consumer.service';
import { describeGradingVerdict, GRADING_VERDICT_KIND } from '../utils/passFail';
import { formatScoreSummary } from '../utils/scoreFormat';

const DEDUPE_TTL_SECONDS = 7 * 24 * 3600; // 7 days

/**
 * Consumes `grading.result.published` from `grading-events` and does what
 * used to be split across two places:
 * - the 'exam.graded' case in kafka-consumer.service.ts (email, with prefs
 *   check + best-effort PDF fetch + Resend), and
 * - grading-service's direct HTTP POST to /notifications/inapp (in-app
 *   notification + Socket.IO emit to room `user:<candidateId>`, both handled
 *   by NotificationService.createInAppNotification()).
 *
 * Runs in its own consumer group ('notifications-grading'), separate from
 * the legacy consumer group in kafka-consumer.service.ts, so neither
 * consumer's rebalancing affects the other.
 *
 * Dedupe: gradeExam() re-publishes a *new* envelope (new id) every time it
 * re-sends a notification for an already-graded attempt, so the envelope id
 * cannot be used as the dedupe key. Instead we key on
 * `examResultId + status + channel`, guarded by a Redis SET NX EX — the first
 * consumer to claim a key does that channel's work; everyone else skips.
 */
export async function startGradingNotificationConsumer(
  kafka: Kafka,
  notificationService: NotificationService,
  redis: Redis
): Promise<ConsumerHandle> {
  return runConsumer({
    kafka,
    groupId: 'notifications-grading',
    topics: [TOPICS.GRADING_EVENTS],
    handlers: {
      [GRADING_RESULT_PUBLISHED]: async (envelope) => {
        const data = envelope.data as GradingResultPublishedDataV1;
        await handleGradingResultPublished(data, notificationService, redis);
      },
    },
  });
}

async function handleGradingResultPublished(
  data: GradingResultPublishedDataV1,
  notificationService: NotificationService,
  redis: Redis
): Promise<void> {
  // One key per channel: if the email went out but the in-app notification
  // failed, the retry must redo only the in-app part, not email again.
  const baseKey = `notif:grading:${data.examResultId}:${data.status}`;
  await runOnce(redis, `${baseKey}:email`, data, () => sendEmailIfEnabled(data, notificationService));
  await runOnce(redis, `${baseKey}:inapp`, data, () => sendInAppNotification(data, notificationService));
}

async function runOnce(
  redis: Redis,
  dedupeKey: string,
  data: GradingResultPublishedDataV1,
  send: () => Promise<void>
): Promise<void> {
  const claimed = await redis.set(dedupeKey, '1', 'EX', DEDUPE_TTL_SECONDS, 'NX');
  if (claimed !== 'OK') {
    console.info(
      `[notifications-grading] Duplicate grading.result.published for examResultId=${data.examResultId} status=${data.status} (${dedupeKey}) — already processed, skipping`
    );
    return;
  }

  try {
    await send();
  } catch (error) {
    // Let runConsumer's retry actually retry: free the key so a redelivery
    // of this message isn't silently skipped for this channel.
    await redis.del(dedupeKey).catch(() => undefined);
    throw error;
  }
}

async function sendEmailIfEnabled(
  data: GradingResultPublishedDataV1,
  notificationService: NotificationService
): Promise<void> {
  if (!data.candidateEmail) {
    console.warn(`[notifications-grading] no candidateEmail for examResultId=${data.examResultId} — skipping email`);
    return;
  }

  const emailEnabled = await isEmailNotificationsEnabled(data.candidateEmail);
  if (!emailEnabled) {
    console.log(`[notifications-grading] email notifications disabled for ${data.candidateEmail}`);
    return;
  }

  console.log(`[notifications-grading] sending grading email to ${data.candidateEmail}`);

  let pdfBase64: string | undefined;
  let pdfFilename: string | undefined;
  const pdf = await fetchExamResultPDF({
    examResultId: data.examResultId,
    firstName: data.candidateFirstName,
    lastName: data.candidateLastName,
    email: data.candidateEmail,
    candidateId: data.candidateId,
  });
  if (pdf) {
    pdfBase64 = pdf;
    pdfFilename = `Resultado_${data.examName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  }

  // Reuses the same email-sending path as the old 'exam.graded' handler.
  // grading-service is the source of truth for passed/passingScore; both
  // travel on the event so notifications-service never has to guess.
  await notificationService.sendExamGradedEmail({
    email: data.candidateEmail,
    firstName: data.candidateFirstName || 'Estudiante',
    lastName: data.candidateLastName || '',
    examName: data.examName,
    score: data.totalScore,
    maxScore: data.maxScore,
    percentage: data.percentage,
    status: data.status,
    passed: data.passed,
    passingScore: data.passingScore,
    examType: data.examType,
    recommendedLevel: data.recommendedLevel,
    pdfBase64,
    pdfFilename,
  });
}

async function sendInAppNotification(
  data: GradingResultPublishedDataV1,
  notificationService: NotificationService
): Promise<void> {
  // createInAppNotification() persists the notification, emits
  // 'notification.created' via Socket.IO to room `user:<candidateId>`, and
  // publishes a 'notification.created' event — the same three things the old
  // POST /notifications/inapp -> createInApp() controller did.
  //
  // It swallows its own errors and returns null on failure (that contract is
  // shared with other callers, so it isn't changed here). runOnce() already
  // claims a Redis dedupe key before calling this function and only frees it
  // on a thrown error, so a null/falsy return has to be treated as a failure
  // here — otherwise a failed in-app notification would be marked "done" for
  // 7 days (DEDUPE_TTL_SECONDS) and runConsumer would never retry it.
  // Same verdict the email renders (placement → recommended level; pending
  // review is never presented as failed).
  const verdict = describeGradingVerdict(data);
  const created = await notificationService.createInAppNotification({
    recipientId: data.candidateId,
    recipientType: 'candidate',
    type: 'exam.graded',
    channel: 'in-app',
    content: {
      title: 'Examen calificado',
      body: `Tu examen "${data.examName}" ha sido calificado. ${verdict.kind === GRADING_VERDICT_KIND.PLACEMENT ? verdict.label : `Resultado: ${verdict.label}`}. Puntaje: ${formatScoreSummary(data.percentage, data.totalScore, data.maxScore)}`,
      link: '/student/results',
    },
    read: false,
    priority: 'normal',
    metadata: {
      examName: data.examName,
      score: data.totalScore,
      maxScore: data.maxScore,
      percentage: data.percentage,
      status: data.status,
      passed: verdict.passed,
      passingScore: data.passingScore,
      examType: data.examType,
      recommendedLevel: data.recommendedLevel,
    },
  });

  if (!created) {
    throw new Error(
      `createInAppNotification returned null for examResultId=${data.examResultId} candidateId=${data.candidateId}`
    );
  }
}

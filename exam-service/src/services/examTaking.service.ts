import { Types } from 'mongoose';
import axios from 'axios';
import { Attempt } from '../models/attempt.model';
import { Exam } from '../models/exam.model';
import { Question } from '../models/question.model';
import { Response as ResponseModel } from '../models/response.model';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { SessionService } from './session.service';

export class ExamTakingService {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  async startExam(sessionId: string, userCandidateId: string) {
    // Validate session and candidate
    const session = await this.sessionService.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // ── Late entry validation ─────────────────────────────────────────────────
    const now = new Date();
    const startDate = new Date((session as any).scheduling.startDate);
    const endDate   = new Date((session as any).scheduling.endDate);
    const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 min grace always

    if ((session as any).status === 'scheduled') {
      throw new Error('Session has not started yet');
    }
    if ((session as any).status !== 'in_progress') {
      throw new Error('Session is not active');
    }

    // ── Check for existing attempt FIRST (re-entry bypasses late-entry check) ─
    const existingAttempt = await Attempt.findOne({
      sessionId: session._id,
      candidateId: userCandidateId
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'completed') {
        throw new Error('Exam already completed');
      }
      if (existingAttempt.status === 'cancelled') {
        throw new Error('Exam was cancelled');
      }

      // Check if time has expired
      if (existingAttempt.startedAt) {
        const elapsed = Math.floor((now.getTime() - existingAttempt.startedAt.getTime()) / 1000);
        const remaining = Math.max(0, existingAttempt.timeAllowedSeconds - elapsed);
        if (remaining <= 0) {
          existingAttempt.status = 'expired';
          existingAttempt.finishedAt = new Date();
          await existingAttempt.save();
          throw new Error('El tiempo del examen ha expirado');
        }
      }

      if (existingAttempt.status === 'expired') {
        throw new Error('El tiempo del examen ha expirado');
      }

      // Student has an in-progress attempt → allow re-entry without late-entry check
      // (they already entered, changing PC or reconnecting should be allowed)
    } else {
      // No existing attempt → this is a first entry → apply late-entry check
      const settings = (session as any).settings || {};
      if (!settings.allowLateEntry) {
        if (now.getTime() > startDate.getTime() + GRACE_PERIOD_MS) {
          throw new Error('Late entry is not allowed for this session');
        }
      } else {
        const lateLimit = (settings.lateEntryMinutes || 0) * 60 * 1000;
        if (now.getTime() > startDate.getTime() + lateLimit) {
          throw new Error('Late entry window has expired');
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // resolve candidate — first try populated candidatesData, fallback to raw registeredCandidates
    const candidatesData: any[] = (session as any).candidatesData || [];
    let candidate = candidatesData.find((c: any) => String(c._id) === String(userCandidateId)) || null;

    if (!candidate) {
      // Fallback: candidatesData may be empty if user-management-service was unreachable.
      // Check registeredCandidates directly — the source of truth.
      const registered: any[] = (session as any).participants?.registeredCandidates || [];
      const isRegistered = registered.some((id: any) => String(id) === String(userCandidateId));
      if (!isRegistered) {
        throw new Error('Candidate not registered for this session');
      }
      // Build minimal candidate object — _id is all that's needed for attempt creation
      candidate = { _id: userCandidateId };
    }

      // SessionService may populate the exam into either `exam` (aggregation) or `examId` (populate)
      let exam: any = (session as any).exam || (session as any).examId;

      // If we only have an ObjectId in examId, fetch the exam document
      if (exam && typeof exam === 'object' && !exam._id && exam.toString) {
        // it's likely an ObjectId-like, convert and fetch
        try {
          exam = await Exam.findById(exam).exec();
        } catch (err) {
          // noop, handled below
        }
      }

      if (!exam) throw new Error('Exam not found for session');

    // Build question set by sections from exam.structure
    const sections = [];
    let allSelectedQuestions: any[] = [];

    if (exam.structure && exam.structure.sections && exam.structure.sections.length > 0) {
      console.log(`📋 [ExamTaking] Generating questions by sections for exam: ${exam.name}`);

      // Step 1: Group sections by competency to avoid duplicates
      const sectionsByCompetency = new Map<string, any[]>();
      for (const sectionConfig of exam.structure.sections) {
        if (!sectionsByCompetency.has(sectionConfig.competency)) {
          sectionsByCompetency.set(sectionConfig.competency, []);
        }
        sectionsByCompetency.get(sectionConfig.competency)!.push(sectionConfig);
      }

      // Step 2: For each competency, fetch questions once and distribute among sections
      const competencyQuestionsMap = new Map<string, any[]>();

      for (const [competency, sectionsForCompetency] of sectionsByCompetency) {
        console.log(`🎯 [Competency: ${competency}] Processing ${sectionsForCompetency.length} sections`);

        // Calculate total questions needed for this competency
        const totalQuestionsNeeded = sectionsForCompetency.reduce((sum, section) => sum + section.questionCount, 0);
        console.log(`🔍 [Competency: ${competency}] Need ${totalQuestionsNeeded} total questions`);

        // Find questions for this competency
        let competencyQuestions: any[] = [];

        if (Array.isArray(exam.questionPool) && exam.questionPool.length > 0) {
          // If exam has a question pool, filter by competency
          const poolIds = exam.questionPool.map((id:string) => new Types.ObjectId(id));
          competencyQuestions = await Question.find({
            _id: { $in: poolIds },
            competency: competency,
            level: exam.targetLevel,
            isActive: true
          }).exec();
        } else {
          // Find questions by competency and level with buffer for randomization
          const bufferMultiplier = 1.5; // 50% buffer
          competencyQuestions = await Question.find({
            level: exam.targetLevel,
            competency: competency,
            isActive: true
          }).limit(Math.ceil(totalQuestionsNeeded * bufferMultiplier)).exec();
        }

        console.log(`✅ [Competency: ${competency}] Found ${competencyQuestions.length} available questions`);

        // Randomize questions for this competency
        if (exam.configuration.randomizeQuestions) {
          competencyQuestions = this.shuffleArray(competencyQuestions);
        }

        // Check if we have enough questions
        if (competencyQuestions.length < totalQuestionsNeeded) {
          console.warn(`⚠️ [Competency: ${competency}] Only found ${competencyQuestions.length}/${totalQuestionsNeeded} questions`);
        }

        competencyQuestionsMap.set(competency, competencyQuestions);
      }

      // Step 3: Distribute questions among sections, ensuring no duplicates
      for (const sectionConfig of exam.structure.sections) {
        const competencyQuestions = competencyQuestionsMap.get(sectionConfig.competency) || [];

        // Take questions for this section (they've already been shuffled)
        // For listening/speaking: deduplicate by context/mediaUrl so the same audio
        // doesn't appear in multiple questions within the same section
        let questionsForSection: any[];
        if (sectionConfig.competency === 'listening' || sectionConfig.competency === 'speaking') {
          const usedContexts = new Set<string>();
          const deduped: any[] = [];
          const consumed: number[] = [];
          for (let i = 0; i < competencyQuestions.length; i++) {
            if (deduped.length >= sectionConfig.questionCount) break;
            const q = competencyQuestions[i];
            const key = (q.content?.mediaUrl ?? q.content?.context ?? '').trim();
            if (key && usedContexts.has(key)) continue;
            if (key) usedContexts.add(key);
            deduped.push(q);
            consumed.push(i);
          }
          // Remove consumed questions from the pool (in reverse order to preserve indices)
          for (let i = consumed.length - 1; i >= 0; i--) {
            competencyQuestions.splice(consumed[i]!, 1);
          }
          questionsForSection = deduped;
        } else {
          questionsForSection = competencyQuestions.splice(0, sectionConfig.questionCount);
        }

        console.log(`📝 [Section: ${sectionConfig.name}] Assigned ${questionsForSection.length}/${sectionConfig.questionCount} questions`);

        if (questionsForSection.length < sectionConfig.questionCount) {
          console.warn(`⚠️ [Section: ${sectionConfig.name}] Only assigned ${questionsForSection.length}/${sectionConfig.questionCount} questions`);
        }

        // Create section structure
        const section = {
          id: sectionConfig.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          name: sectionConfig.name,
          competency: sectionConfig.competency,
          duration: sectionConfig.duration, // in minutes
          weight: sectionConfig.weight,
          questionCount: questionsForSection.length,
          questions: questionsForSection
        };

        sections.push(section);
        allSelectedQuestions.push(...questionsForSection);
      }
    } else {
      // Fallback: if no sections defined, create a single general section
      console.log(`⚠️ [ExamTaking] No sections defined, creating single general section`);

      let questionDocs: any[] = [];
      const questionCount = exam.questionCount || 10;

      if (Array.isArray(exam.questionPool) && exam.questionPool.length > 0) {
        const poolIds = exam.questionPool.map((id:string) => new Types.ObjectId(id));
        questionDocs = await Question.find({ _id: { $in: poolIds }, isActive: true }).exec();
      } else {
        questionDocs = await Question.find({ level: exam.targetLevel, isActive: true }).exec();
      }

      const shuffled = questionDocs.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, questionCount);

      sections.push({
        id: 'general',
        name: 'General',
        competency: 'general',
        duration: exam.structure?.totalDuration || 60,
        weight: 100,
        questionCount: selected.length,
        questions: selected
      });

      allSelectedQuestions = selected;
    }

    console.log(`🎯 [ExamTaking] Generated ${sections.length} sections with total ${allSelectedQuestions.length} questions`);

    // Create or update Attempt — use min(examDuration, sessionRemaining) so late joiners get correct time
    const examDurationSecs = (exam.structure?.totalDuration || 60) * 60;
    const sessionRemainingMs = endDate.getTime() - now.getTime();
    const sessionRemainingSecs = Math.max(0, Math.floor(sessionRemainingMs / 1000));
    const timeInSeconds = Math.min(examDurationSecs, sessionRemainingSecs);
    console.log(`🕒 [ExamTaking] Time: exam=${examDurationSecs}s, sessionRemaining=${sessionRemainingSecs}s, allowed=${timeInSeconds}s`);

    const attempt = await Attempt.findOneAndUpdate(
      { sessionId: session._id, candidateId: candidate._id },
      { $setOnInsert: {
          sessionId: session._id,
          candidateId: candidate._id,
          examId: exam._id,
          timeAllowedSeconds: timeInSeconds, // Convert minutes to seconds
          questionIds: allSelectedQuestions.map((q: any) => q._id), // Store all selected question IDs
          sectionsStructure: sections.map(section => ({
            id: section.id,
            name: section.name,
            competency: section.competency,
            duration: section.duration,
            weight: section.weight,
            questionCount: section.questionCount,
            questionIds: section.questions.map((q: any) => q._id)
          }))
        }
      },
      { upsert: true, new: true }
    );

    // set startedAt if not set
    if (!attempt.startedAt) {
      attempt.startedAt = new Date();
      // Store question IDs if not already stored
      if (!attempt.questionIds || attempt.questionIds.length === 0) {
        attempt.questionIds = allSelectedQuestions.map((q: any) => q._id);
      }
      await attempt.save();
    }

    // Helper: Fisher-Yates shuffle (pure, no mutations to original)
    const shuffleArray = <T>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i]!; shuffled[i] = shuffled[j]!; shuffled[j] = temp;
      }
      return shuffled;
    };

    // Return sections with questions (without correct answers) and timing info
    // Options and items are shuffled so students don't see them in correct order
    const sectionsWithQuestions = sections.map(section => ({
      ...section,
      questions: section.questions.map((q: any) => {
        const obj = q.toObject();
        if (obj.content) {
          if (obj.content.options) obj.content.options = shuffleArray(obj.content.options);
          if (obj.content.items) obj.content.items = shuffleArray(obj.content.items);
          delete obj.content.correctAnswer;
        }
        return obj;
      })
    }));

    // Get existing answers (in case this is a restart of an existing attempt)
    const responses = await ResponseModel.find({
      sessionId: attempt.sessionId,
      candidateId: attempt.candidateId
    }).select('questionId response timestamp').exec();

    const answers = responses.reduce((acc: any, resp: any) => {
      acc[resp.questionId.toString()] = resp.response;
      return acc;
    }, {});

    console.log(`💾 [StartExam] Found ${responses.length} existing responses`);

    return {
      examId: exam._id,
      sections: sectionsWithQuestions,
      answers: answers, // Include existing answers
      timeAllowedSeconds: attempt.timeAllowedSeconds,
      attemptId: attempt._id,
      totalQuestions: allSelectedQuestions.length
    };
  }

  async submitAnswer(sessionId: string, _authUserId: string, questionId: string, answer: any) {
    // locate attempt
    const attempt = await Attempt.findOne({ sessionId: sessionId });
    if (!attempt) throw new Error('Attempt not found');

    // Get question to determine competency
    const question = await Question.findById(questionId);
    if (!question) throw new Error('Question not found');

    console.log(`💾 [SubmitAnswer] Saving answer for question ${questionId}, competency: ${question.competency}`);
    console.log(`💾 [SubmitAnswer] Answer data:`, JSON.stringify(answer, null, 2));

    // Rewrite public MinIO URL to internal Docker URL so grading-service can download audio
    let processedAnswer = answer;
    if (processedAnswer?.audioUrl && env.MINIO_INTERNAL_ENDPOINT) {
      const publicBase = env.MINIO_PUBLIC_URL || `http://localhost:${env.MINIO_PORT}`;
      const internalBase = env.MINIO_INTERNAL_ENDPOINT;
      if (processedAnswer.audioUrl.startsWith(publicBase) && publicBase !== internalBase) {
        processedAnswer = { ...processedAnswer, audioUrl: processedAnswer.audioUrl.replace(publicBase, internalBase) };
        console.log(`🔁 [SubmitAnswer] Rewrote audioUrl to internal: ${processedAnswer.audioUrl}`);
      }
    }

    // upsert response with competency
    // NOTE: `response` field has a strict Mongoose schema that strips unknown fields
    // (positions, blanks, pairs, order). We save the full answer to `answer` (Mixed type)
    // so the grading-service can read the complete data.
    const resp = await ResponseModel.findOneAndUpdate(
      { sessionId: attempt.sessionId, candidateId: attempt.candidateId, questionId },
      {
        $set: {
          response: { type: question.type, ...processedAnswer },
          answer: processedAnswer,
          examId: attempt.examId,
          competency: question.competency || 'general'
        }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ [SubmitAnswer] Response saved with ID: ${resp._id}`);
    return { saved: true, responseId: resp._id };
  }

  async finishExam(sessionId: string, _authUserId: string) {
    const attempt = await Attempt.findOne({ sessionId: sessionId });
    if (!attempt) throw new Error('Attempt not found');

    attempt.finishedAt = new Date();
    attempt.status = 'completed';
    await attempt.save();

    logger.info(`🏁 [FinishExam] Attempt ${attempt._id} finished, starting evaluation...`);

    // Delegate grading to grading-service (fire-and-forget)
    axios.post(`${env.GRADING_SERVICE_URL}/api/v1/grading/exam`, {
      attemptId: String(attempt._id)
    }, { timeout: 120000 })
      .then(result => {
        logger.info(`✅ [FinishExam] Grading completed for attempt ${String(attempt._id)}, examResultId: ${result.data?.data?.examResultId}`);
      })
      .catch(error => {
        logger.error(`❌ [FinishExam] Grading failed for attempt ${String(attempt._id)}:`, error.message);
      });

    return {
      success: true,
      attemptId: attempt._id,
      message: 'Examen finalizado. Los resultados estarán disponibles en unos momentos.'
    };
  }

  async getTimeRemaining(sessionId: string, _authUserId: string) {
    const attempt = await Attempt.findOne({ sessionId: sessionId });
    if (!attempt || !attempt.startedAt) return { timeRemaining: 0, sessionEnded: false };

    // If attempt is already completed or expired, return 0
    if (attempt.status === 'completed' || attempt.status === 'expired') {
      return { timeRemaining: 0, sessionEnded: true };
    }

    // Check if the parent session was ended/cancelled by admin or teacher
    const session = await this.sessionService.findById(sessionId);
    if (session && (session.status === 'completed' || session.status === 'cancelled')) {
      return { timeRemaining: 0, sessionEnded: true };
    }

    const now = new Date();
    const elapsed = Math.floor((now.getTime() - (attempt.startedAt as Date).getTime()) / 1000);
    const remaining = Math.max(0, attempt.timeAllowedSeconds - elapsed);

    console.log(`⏱️ [Time Calculation] Session: ${sessionId}`);
    console.log(`   - Time allowed: ${attempt.timeAllowedSeconds}s (${Math.floor(attempt.timeAllowedSeconds / 60)} mins)`);
    console.log(`   - Elapsed: ${elapsed}s (${Math.floor(elapsed / 60)} mins)`);
    console.log(`   - Remaining: ${remaining}s (${Math.floor(remaining / 60)} mins)`);

    // Auto-expire if time is up and attempt is still in progress
    if (remaining <= 0 && attempt.status === 'in_progress') {
      attempt.status = 'expired';
      attempt.finishedAt = new Date();
      await attempt.save();
      logger.info(`Attempt ${attempt._id} auto-expired due to time expiration`);
    }

    return { timeRemaining: remaining, sessionEnded: false };
  }

  // New methods for HTTP-based exam taking

  async getMyAnswers(sessionId: string, _authUserId: string) {
    const attempt = await Attempt.findOne({ sessionId: sessionId });
    if (!attempt) throw new Error('Attempt not found');

    const responses = await ResponseModel.find({
      sessionId: attempt.sessionId,
      candidateId: attempt.candidateId
    }).select('questionId response timestamp').exec();

    console.log(`🔍 [GetMyAnswers] Found ${responses.length} responses for session ${sessionId}`);

    const answers = responses.reduce((acc: any, resp: any) => {
      const questionId = resp.questionId.toString();
      const responseData = resp.response;

      // Debug log for each response
      console.log(`📥 [GetMyAnswers] Question ${questionId}:`, {
        responseType: typeof responseData,
        responseData: JSON.stringify(responseData, null, 2),
        hasAnswer: responseData?.answer !== undefined,
        hasSelectedOptions: responseData?.selectedOptions !== undefined,
        answerValue: responseData?.answer,
        selectedOptions: responseData?.selectedOptions
      });

      acc[questionId] = responseData;
      return acc;
    }, {});

    console.log(`✅ [GetMyAnswers] Final answers object:`, Object.keys(answers).length, 'questions');
    return { answers, totalAnswered: responses.length };
  }

  async getActiveSession(authUserId: string) {
    // Find active attempt for this user
    const attempt = await Attempt.findOne({
      candidateId: authUserId,
      status: { $in: ['active', 'in_progress'] },
      finishedAt: { $exists: false }
    }).populate('sessionId').exec();

    if (!attempt) return null;

    // Check if session is still valid (not expired)
    if (attempt.startedAt) {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - (attempt.startedAt as Date).getTime()) / 1000);
      const remaining = Math.max(0, attempt.timeAllowedSeconds - elapsed);

      if (remaining <= 0) {
        // Auto-expire the attempt
        attempt.status = 'expired';
        attempt.finishedAt = new Date();
        await attempt.save();
        return null;
      }
    }

    return {
      sessionId: attempt.sessionId,
      attemptId: attempt._id,
      startedAt: attempt.startedAt,
      timeRemaining: attempt.startedAt ?
        Math.max(0, attempt.timeAllowedSeconds - Math.floor((new Date().getTime() - (attempt.startedAt as Date).getTime()) / 1000)) :
        attempt.timeAllowedSeconds,
      status: attempt.status
    };
  }

  async resumeExam(sessionId: string, _authUserId: string) {
    // Get attempt
    const attempt = await Attempt.findOne({ sessionId: sessionId });
    if (!attempt) throw new Error('Attempt not found');

    // Check if attempt is already finished
    if (attempt.status === 'completed') {
      throw new Error('Exam already completed');
    }

    if (attempt.status === 'cancelled') {
      throw new Error('Exam was cancelled');
    }

    if (attempt.status === 'expired') {
      throw new Error('Exam time has expired');
    }

    // Check if expired by time
    if (attempt.startedAt) {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - (attempt.startedAt as Date).getTime()) / 1000);
      const remaining = Math.max(0, attempt.timeAllowedSeconds - elapsed);

      if (remaining <= 0) {
        // Auto-expire the attempt
        attempt.status = 'expired';
        attempt.finishedAt = new Date();
        await attempt.save();
        throw new Error('Exam time has expired');
      }
    }

    // Get session and questions
    const session = await this.sessionService.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // Get exam
    let exam: any = (session as any).exam || (session as any).examId;
    if (exam && typeof exam === 'object' && !exam._id && exam.toString) {
      try {
        exam = await Exam.findById(exam).exec();
      } catch (err) {
        // noop, handled below
      }
    }
    if (!exam) throw new Error('Exam not found for session');

    // Get sections and questions - retrieve from stored structure in attempt
    let sections: any[] = [];

    if (attempt.sectionsStructure && attempt.sectionsStructure.length > 0) {
      console.log(`📋 [ResumeExam] Restoring ${attempt.sectionsStructure.length} sections from stored structure`);

      // Restore sections from stored structure
      for (const sectionStructure of attempt.sectionsStructure) {
        // Skip if no questionIds
        if (!sectionStructure.questionIds || sectionStructure.questionIds.length === 0) {
          console.warn(`⚠️ Section ${sectionStructure.name} has no questionIds, skipping...`);
          continue;
        }

        // Get questions for this section
        const sectionQuestions = await Question.find({
          _id: { $in: sectionStructure.questionIds },
          isActive: true
        }).exec();

        // Maintain original order only if we have questionIds
        if (sectionStructure.questionIds && sectionStructure.questionIds.length > 0) {
          sectionQuestions.sort((a, b) => {
            const aIndex = sectionStructure.questionIds.findIndex((id: any) => String(id) === String(a._id));
            const bIndex = sectionStructure.questionIds.findIndex((id: any) => String(id) === String(b._id));
            return aIndex - bIndex;
          });
        }

        // Create section with questions (without correct answers)
        const section = {
          id: sectionStructure.id,
          name: sectionStructure.name,
          competency: sectionStructure.competency,
          duration: sectionStructure.duration,
          weight: sectionStructure.weight,
          questionCount: sectionStructure.questionCount,
          questions: sectionQuestions.map((q: any) => {
            const obj = q.toObject();
            if (obj.content) delete obj.content.correctAnswer;
            return obj;
          })
        };

        sections.push(section);
        console.log(`✅ [Section: ${section.name}] Restored with ${section.questions.length} questions`);
      }
    } else if (attempt.questionIds && attempt.questionIds.length > 0) {
      // Fallback: if no sections structure but has questionIds (legacy)
      console.log(`⚠️ [ResumeExam] No sections structure found, creating single section from questionIds`);

      const allQuestions = await Question.find({
        _id: { $in: attempt.questionIds },
        isActive: true
      }).exec();

      // Sort by original order
      allQuestions.sort((a, b) => {
        const aIndex = attempt.questionIds!.findIndex((id: any) => String(id) === String(a._id));
        const bIndex = attempt.questionIds!.findIndex((id: any) => String(id) === String(b._id));
        return aIndex - bIndex;
      });

      sections = [{
        id: 'general',
        name: 'General',
        competency: 'general',
        duration: exam.structure?.totalDuration || 60,
        weight: 100,
        questionCount: allQuestions.length,
        questions: allQuestions.map((q: any) => {
          const obj = q.toObject();
          if (obj.content) delete obj.content.correctAnswer;
          return obj;
        })
      }];
    } else {
      throw new Error('No stored question structure found for this attempt');
    }

    console.log(`🎯 [ResumeExam] Restored ${sections.length} sections with total ${sections.reduce((total, s) => total + s.questions.length, 0)} questions`);

    // Get existing answers
    // NOTE: we select `answer` (Mixed/full data) in addition to `response` (strict schema).
    // The `response` field strips blanks/pairs/positions/order due to Mongoose strict schema.
    // The `answer` field (Mixed) preserves all fields — use it preferentially.
    const responses = await ResponseModel.find({
      sessionId: attempt.sessionId,
      candidateId: attempt.candidateId
    }).select('questionId response answer timestamp').exec();

    // Rewrite internal MinIO URLs back to public URLs so the browser can access audio
    const internalBase = env.MINIO_INTERNAL_ENDPOINT;
    const publicBase = env.MINIO_PUBLIC_URL || `http://localhost:${env.MINIO_PORT}`;

    const answers = responses.reduce((acc: any, resp: any) => {
      // Prefer `answer` (Mixed, full data) over `response` (strict schema, strips complex fields)
      let response = resp.answer ?? resp.response;
      console.log(`📋 [ResumeExam] Q:${resp.questionId} — answer field:`, JSON.stringify(resp.answer), '| response field:', JSON.stringify(resp.response));
      if (response?.audioUrl && internalBase && response.audioUrl.startsWith(internalBase)) {
        response = { ...response, audioUrl: response.audioUrl.replace(internalBase, publicBase) };
      }
      acc[resp.questionId.toString()] = response;
      return acc;
    }, {});

    // Calculate progress per section and overall
    let totalQuestions = 0;
    let currentSectionIndex = 0;
    let currentQuestionIndex = 0;

    for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
      const section = sections[sectionIdx];
      totalQuestions += section.questions.length;

      let sectionAnswered = 0;
      let firstUnanswered = -1;

      for (let questionIdx = 0; questionIdx < section.questions.length; questionIdx++) {
        const question = section.questions[questionIdx];
        if (answers[question._id.toString()]) {
          sectionAnswered++;
        } else if (firstUnanswered === -1) {
          firstUnanswered = questionIdx;
        }
      }

      // If this section has unanswered questions, set as current
      if (firstUnanswered !== -1) {
        currentSectionIndex = sectionIdx;
        currentQuestionIndex = firstUnanswered;
        break;
      }

      // If section is complete, move to next section
      if (sectionIdx === sections.length - 1) {
        // All sections complete
        currentSectionIndex = sectionIdx;
        currentQuestionIndex = section.questions.length - 1;
      }
    }

    const timeRemaining = attempt.startedAt ?
      Math.max(0, attempt.timeAllowedSeconds - Math.floor((new Date().getTime() - (attempt.startedAt as Date).getTime()) / 1000)) :
      attempt.timeAllowedSeconds;

    return {
      examId: exam._id,
      sections,
      answers,
      currentSectionIndex,
      currentQuestionIndex,
      timeRemaining,
      attemptId: attempt._id,
      totalQuestions,
      progress: {
        answered: Object.keys(answers).length,
        total: totalQuestions,
        sections: sections.map(section => ({
          id: section.id,
          name: section.name,
          answered: section.questions.filter((q: any) => answers[q._id.toString()]).length,
          total: section.questions.length
        }))
      }
    };
  }
  async attempts(sessionId: string, _authUserId: string,countPermitted:any) {
    const attempts = await Attempt.find({ sessionId: sessionId }).sort({ startedAt: -1 }).exec();
    const isPermitted = attempts.length < countPermitted;
    return { attempts, countPermitted:isPermitted };
  }

  // ==================== ADAPTIVE EXAM (CAT) METHODS ====================

  private readonly ADAPTIVE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  private readonly ADAPTIVE_AUTO_GRADABLE_TYPES = [
    'multiple_choice', 'true_false', 'fill_blanks', 'matching', 'ordering', 'drag_drop'
  ];

  private async pickAdaptiveQuestion(
    exam: any,
    level: string,
    excludeIds: string[]
  ): Promise<any | null> {
    const query: any = {
      level,
      isActive: true,
      type: { $in: this.ADAPTIVE_AUTO_GRADABLE_TYPES }
    };
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds.map((id: string) => new Types.ObjectId(id)) };
    }

    if (Array.isArray(exam.questionPool) && exam.questionPool.length > 0) {
      const poolIds = exam.questionPool.map((id: string) => new Types.ObjectId(id));
      query._id = {
        ...query._id,
        $in: poolIds,
        ...(excludeIds.length > 0 ? { $nin: excludeIds.map((id: string) => new Types.ObjectId(id)) } : {})
      };
      // MongoDB can't combine $in and $nin at the same level like this — use aggregate approach instead
      const candidates = await Question.find({
        _id: { $in: poolIds },
        level,
        isActive: true,
        type: { $in: this.ADAPTIVE_AUTO_GRADABLE_TYPES }
      }).exec();
      const filtered = candidates.filter(q => !excludeIds.includes(String(q._id)));
      if (filtered.length === 0) return null;
      return filtered[Math.floor(Math.random() * filtered.length)];
    }

    const candidates = await Question.find(query).exec();
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async startAdaptiveExam(sessionId: string, userCandidateId: string) {
    const session = await this.sessionService.findById(sessionId);
    if (!session) throw new Error('Session not found');

    // Validate candidate
    const candidate = (session as any).candidatesData?.find(
      (c: any) => String(c._id) === String(userCandidateId)
    ) || null;
    if (!candidate) throw new Error('Candidate not registered for this session');

    let exam: any = (session as any).exam || (session as any).examId;
    if (exam && typeof exam === 'object' && !exam._id && exam.toString) {
      try { exam = await Exam.findById(exam).exec(); } catch { /* noop */ }
    }
    if (!exam) throw new Error('Exam not found for session');

    // Check existing attempt
    const existingAttempt = await Attempt.findOne({
      sessionId: session._id,
      candidateId: candidate._id
    });
    if (existingAttempt) {
      if (existingAttempt.status === 'completed') throw new Error('Exam already completed');
      if (existingAttempt.status === 'expired') throw new Error('Exam time has expired');
      if (existingAttempt.status === 'cancelled') throw new Error('Exam was cancelled');
      // Resume adaptive if attempt already exists
      return this.resumeAdaptiveExam(sessionId, userCandidateId);
    }

    const placementConfig = (exam as any).placementConfig || {};
    const startingLevel = placementConfig.startingLevel || 'A2';
    const maxQuestions = placementConfig.maxQuestions ?? 20;
    const consecutiveWrongThreshold = placementConfig.consecutiveWrongThreshold ?? 3;
    const timeInSeconds = (exam.structure?.totalDuration || 60) * 60;

    // Pick first question
    const firstQuestion = await this.pickAdaptiveQuestion(exam, startingLevel, []);
    if (!firstQuestion) throw new Error(`No questions available for level ${startingLevel}`);

    const adaptiveState = {
      currentLevel: startingLevel,
      consecutiveWrong: 0,
      askedQuestionIds: [String(firstQuestion._id)],
      levelHistory: [],
      isFinished: false,
    };

    const attempt = new Attempt({
      sessionId: session._id,
      candidateId: candidate._id,
      examId: exam._id,
      timeAllowedSeconds: timeInSeconds,
      startedAt: new Date(),
      status: 'in_progress',
      adaptiveState,
    });
    await attempt.save();

    const questionObj = firstQuestion.toObject();
    if (questionObj.content) {
      if (questionObj.content.options) questionObj.content.options = this.shuffleArray(questionObj.content.options);
      if (questionObj.content.items) questionObj.content.items = this.shuffleArray(questionObj.content.items);
      delete questionObj.content.correctAnswer;
    }

    return {
      question: questionObj,
      attemptId: attempt._id,
      adaptiveState: {
        currentLevel: startingLevel,
        questionsAnswered: 0,
        maxQuestions,
        consecutiveWrongThreshold,
        isFinished: false,
      }
    };
  }

  async submitAdaptiveAnswer(sessionId: string, userCandidateId: string, questionId: string, answer: any) {
    const attempt = await Attempt.findOne({ sessionId });
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status === 'completed') throw new Error('Exam already completed');

    const question = await Question.findById(questionId);
    if (!question) throw new Error('Question not found');

    const exam = await Exam.findById(attempt.examId);
    if (!exam) throw new Error('Exam not found');

    const placementConfig = (exam as any).placementConfig || {};
    const maxQuestions = placementConfig.maxQuestions ?? 20;
    const consecutiveWrongThreshold = placementConfig.consecutiveWrongThreshold ?? 3;

    // Grade the answer via grading-service
    let gradeResult: any;
    try {
      const gradingResp = await axios.post(
        `${env.GRADING_SERVICE_URL}/api/v1/grading/question`,
        { questionId, response: answer },
        { timeout: 30000 }
      );
      gradeResult = gradingResp.data?.data || gradingResp.data;
    } catch (err: any) {
      logger.error(`[AdaptiveExam] Grading failed for question ${questionId}:`, err.message);
      throw new Error('Failed to grade answer: ' + err.message);
    }

    const isCorrect = gradeResult.isCorrect ?? (gradeResult.score > 0);
    const score = gradeResult.score ?? 0;
    const maxScore = gradeResult.maxScore ?? (question.metadata?.points ?? 1);

    // Save response
    await ResponseModel.findOneAndUpdate(
      { sessionId: attempt.sessionId, candidateId: attempt.candidateId, questionId },
      {
        $set: {
          response: { type: question.type, ...answer },
          answer,
          examId: attempt.examId,
          competency: question.competency || 'general'
        }
      },
      { upsert: true, new: true }
    );

    // Update adaptiveState
    type AdaptiveState = {
      currentLevel: string;
      consecutiveWrong: number;
      askedQuestionIds: string[];
      levelHistory: Array<{ questionId: string; level: string; isCorrect: boolean; score: number; maxScore: number }>;
      isFinished: boolean;
      stopReason?: 'max_questions' | 'consecutive_wrong' | 'manual';
    };
    const state: AdaptiveState = attempt.adaptiveState ? {
      currentLevel: attempt.adaptiveState.currentLevel,
      consecutiveWrong: attempt.adaptiveState.consecutiveWrong,
      askedQuestionIds: [...(attempt.adaptiveState.askedQuestionIds || [])],
      levelHistory: [...(attempt.adaptiveState.levelHistory || [])],
      isFinished: attempt.adaptiveState.isFinished,
      stopReason: attempt.adaptiveState.stopReason,
    } : {
      currentLevel: (exam as any).placementConfig?.startingLevel || 'A2',
      consecutiveWrong: 0,
      askedQuestionIds: [],
      levelHistory: [],
      isFinished: false,
    };

    // Add to level history
    state.levelHistory.push({
      questionId: String(questionId),
      level: state.currentLevel,
      isCorrect,
      score,
      maxScore,
    });

    const questionsAnswered = state.levelHistory.length;

    // Update level / consecutive wrong
    if (isCorrect) {
      state.consecutiveWrong = 0;
      const currentIdx = this.ADAPTIVE_LEVELS.indexOf(state.currentLevel);
      state.currentLevel = this.ADAPTIVE_LEVELS[Math.min(currentIdx + 1, this.ADAPTIVE_LEVELS.length - 1)]!;
    } else {
      state.consecutiveWrong = (state.consecutiveWrong || 0) + 1;
    }

    // Check stop conditions
    let stopReason: 'max_questions' | 'consecutive_wrong' | undefined;
    if (questionsAnswered >= maxQuestions) {
      stopReason = 'max_questions';
    } else if (state.consecutiveWrong >= consecutiveWrongThreshold) {
      stopReason = 'consecutive_wrong';
    }

    let nextQuestion: any = null;
    let finished = false;

    if (stopReason) {
      state.isFinished = true;
      state.stopReason = stopReason;
      attempt.status = 'completed';
      attempt.finishedAt = new Date();
      finished = true;
    } else {
      // Pick next question
      nextQuestion = await this.pickAdaptiveQuestion(exam, state.currentLevel, state.askedQuestionIds);
      if (!nextQuestion) {
        // Try adjacent levels if no questions available
        const adjacentLevels = this.ADAPTIVE_LEVELS.filter(l => l !== state.currentLevel);
        for (const lvl of adjacentLevels) {
          nextQuestion = await this.pickAdaptiveQuestion(exam, lvl, state.askedQuestionIds);
          if (nextQuestion) {
            state.currentLevel = lvl;
            break;
          }
        }
      }
      if (!nextQuestion) {
        state.isFinished = true;
        state.stopReason = 'max_questions';
        attempt.status = 'completed';
        attempt.finishedAt = new Date();
        finished = true;
      } else {
        state.askedQuestionIds.push(String(nextQuestion._id));
        const nextObj = nextQuestion.toObject();
        if (nextObj.content) {
          if (nextObj.content.options) nextObj.content.options = this.shuffleArray(nextObj.content.options);
          if (nextObj.content.items) nextObj.content.items = this.shuffleArray(nextObj.content.items);
          delete nextObj.content.correctAnswer;
        }
        nextQuestion = nextObj;
      }
    }

    attempt.adaptiveState = state;
    await attempt.save();

    // Fire-and-forget full exam grading if finished
    if (finished) {
      axios.post(`${env.GRADING_SERVICE_URL}/api/v1/grading/exam`, {
        attemptId: String(attempt._id)
      }, { timeout: 120000 })
        .then(r => logger.info(`[AdaptiveExam] Grading done for attempt ${attempt._id}, resultId: ${r.data?.data?.examResultId}`))
        .catch(e => logger.error(`[AdaptiveExam] Grading failed for attempt ${attempt._id}:`, e.message));
    }

    return {
      finished,
      stopReason: state.stopReason,
      gradeResult: { isCorrect, score, maxScore, feedback: gradeResult.feedback },
      nextQuestion: finished ? null : nextQuestion,
      adaptiveState: {
        currentLevel: state.currentLevel,
        questionsAnswered,
        maxQuestions,
        consecutiveWrongThreshold,
        consecutiveWrong: state.consecutiveWrong,
        isFinished: finished,
        stopReason: state.stopReason,
      }
    };
  }

  async resumeAdaptiveExam(sessionId: string, _userCandidateId: string) {
    const attempt = await Attempt.findOne({ sessionId });
    if (!attempt) throw new Error('Attempt not found');

    if (attempt.status === 'completed' || attempt.adaptiveState?.isFinished) {
      return { finished: true, adaptiveState: attempt.adaptiveState };
    }
    if (attempt.status === 'expired') throw new Error('Exam time has expired');

    const exam = await Exam.findById(attempt.examId);
    if (!exam) throw new Error('Exam not found');

    const placementConfig = (exam as any).placementConfig || {};
    const maxQuestions = placementConfig.maxQuestions ?? 20;
    const consecutiveWrongThreshold = placementConfig.consecutiveWrongThreshold ?? 3;

    const state = attempt.adaptiveState || {
      currentLevel: placementConfig.startingLevel || 'A2',
      consecutiveWrong: 0,
      askedQuestionIds: [],
      levelHistory: [],
      isFinished: false,
    };

    const nextQuestion = await this.pickAdaptiveQuestion(exam, state.currentLevel, state.askedQuestionIds);
    if (!nextQuestion) {
      return { finished: true, adaptiveState: state };
    }

    const questionObj = nextQuestion.toObject();
    if (questionObj.content) {
      if (questionObj.content.options) questionObj.content.options = this.shuffleArray(questionObj.content.options);
      if (questionObj.content.items) questionObj.content.items = this.shuffleArray(questionObj.content.items);
      delete questionObj.content.correctAnswer;
    }

    return {
      finished: false,
      question: questionObj,
      attemptId: attempt._id,
      adaptiveState: {
        currentLevel: state.currentLevel,
        questionsAnswered: state.levelHistory?.length ?? 0,
        maxQuestions,
        consecutiveWrongThreshold,
        consecutiveWrong: state.consecutiveWrong,
        isFinished: false,
      }
    };
  }

  /**
   * Fisher-Yates shuffle algorithm to randomize array elements
   * @param array Array to shuffle
   * @returns Shuffled copy of the array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }
}

export const CONSTANTS = {
  // MCER Levels
  LEVELS: {
    A1: 'A1',
    A2: 'A2',
    B1: 'B1',
    B2: 'B2',
    C1: 'C1',
    C2: 'C2'
  },

  // Competencies
  COMPETENCIES: {
    READING: 'reading',
    WRITING: 'writing',
    LISTENING: 'listening',
    SPEAKING: 'speaking'
  },

  // Exam Types
  EXAM_TYPES: {
    PLACEMENT: 'placement',
    PROGRESS: 'progress',
    FINAL: 'final',
    MOCK: 'mock'
  },

  // Question Types
  QUESTION_TYPES: {
    MULTIPLE_CHOICE: 'multiple_choice',
    TRUE_FALSE: 'true_false',
    OPEN_TEXT: 'open_text',
    ESSAY: 'essay',
    AUDIO_RESPONSE: 'audio_response',
    FILE_UPLOAD: 'file_upload'
  },

  // Session Status
  SESSION_STATUS: {
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
  },

  // Result Status
  RESULT_STATUS: {
    PENDING: 'pending',
    IN_EVALUATION: 'in_evaluation',
    COMPLETED: 'completed',
    REVIEWED: 'reviewed'
  },

  // Scoring Types
  SCORING_TYPES: {
    HOLISTIC: 'holistic',
    ANALYTIC: 'analytic'
  },

  // Cache TTL (in seconds)
  CACHE_TTL: {
    SHORT: 300,      // 5 minutes
    MEDIUM: 1800,    // 30 minutes
    LONG: 3600,      // 1 hour
    VERY_LONG: 86400 // 24 hours
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },

  // File Upload
  FILE_UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: {
      DOCUMENT: ['pdf', 'doc', 'docx'],
      IMAGE: ['jpg', 'jpeg', 'png', 'gif'],
      AUDIO: ['mp3', 'wav', 'm4a'],
      VIDEO: ['mp4', 'avi', 'mov']
    }
  },

  // Error Messages
  ERROR_MESSAGES: {
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Forbidden access',
    VALIDATION_ERROR: 'Validation error',
    INTERNAL_ERROR: 'Internal server error',
    EXAM_NOT_FOUND: 'Exam not found',
    QUESTION_NOT_FOUND: 'Question not found',
    LEVEL_NOT_FOUND: 'Level not found',
    RUBRIC_NOT_FOUND: 'Rubric not found',
    SESSION_NOT_FOUND: 'Session not found',
    INVALID_EXAM_TYPE: 'Invalid exam type',
    INVALID_LEVEL: 'Invalid level',
    INVALID_COMPETENCY: 'Invalid competency',
    INVALID_QUESTION_TYPE: 'Invalid question type'
  },

  // Success Messages
  SUCCESS_MESSAGES: {
    EXAM_CREATED: 'Exam created successfully',
    EXAM_UPDATED: 'Exam updated successfully',
    EXAM_DELETED: 'Exam deleted successfully',
    QUESTION_CREATED: 'Question created successfully',
    QUESTION_UPDATED: 'Question updated successfully',
    QUESTION_DELETED: 'Question deleted successfully',
    LEVEL_UPDATED: 'Level updated successfully',
    RUBRIC_CREATED: 'Rubric created successfully',
    RUBRIC_UPDATED: 'Rubric updated successfully',
    RUBRIC_DELETED: 'Rubric deleted successfully',
    SESSION_CREATED: 'Session created successfully',
    SESSION_UPDATED: 'Session updated successfully',
    SESSION_CANCELLED: 'Session cancelled successfully'
  }
};
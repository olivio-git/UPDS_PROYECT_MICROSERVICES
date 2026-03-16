// Tipos para el módulo de exámenes

// Tipos de preguntas
export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'open_text'
  | 'essay'
  | 'fill_blanks'
  | 'drag_drop'
  | 'matching'
  | 'ordering'
  | 'audio_response'
  | 'file_upload'
  | 'speaking'
  | 'writing';

// Competencias
export type Competency = 
  | 'reading' 
  | 'writing' 
  | 'listening' 
  | 'speaking';

// Niveles MCER
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// Interfaz para opciones de pregunta
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

// Interfaz para contenido de pregunta
export interface QuestionContent {
  question: string;
  instructions?: string;
  options?: QuestionOption[];
  // accept either a single string or an array of strings for answers
  correctAnswer?: string | string[];
  mediaUrl?: string;
  mediaType?: 'audio' | 'image' | 'video';
  context?: string;
  keywords?: string[];
  sampleAnswer?: string;
  // Para fill_blanks
  template?: string; // "The cat is ___ the house"
  blanks?: Array<{
    position: number;
    correctAnswers: string[];
    caseSensitive?: boolean;
  }>;
  // Para drag_drop, matching, ordering
  items?: Array<{
    id: string;
    content: string;
    correctPosition?: number;
    matchingPair?: string;
  mediaUrl?: string;
  mediaType?: 'audio' | 'image' | 'video';
  }>;
  // Para audio_response
  promptAudioUrl?: string;
  expectedResponseType?: 'word' | 'sentence' | 'paragraph';
}

// Interfaz para pregunta
export interface Question {
  _id?: string;
  type: QuestionType;               // Tipo de pregunta (MCQ, abierta, audio, etc.)
  competency: Competency;           // Competencia evaluada
  level: Level;                      // Nivel CEFR u otro estándar
  difficulty: number;                // Escala 1-5
  content: QuestionContent;          // Texto, opciones, archivos multimedia
  points?: number;                   // Puntos totales asignados
  metadata?: {
    tags?: string[];                 // Etiquetas para filtrado/búsqueda
    topic: string;                   // Tema principal
    subtopic?: string;               // Subtema
    estimatedTime?: number;          // Tiempo estimado (segundos)
    points?: number;                 // Puntos específicos de esta versión
    mediaType?: 'audio' | 'image' | 'video'; // Tipo de medio (audio, imagen, video)
    rubricId?: string; // Added field for rubric ID
  };
  statistics?: {
    timesUsed: number;               // Número de veces utilizada
    averageScore: number;            // Promedio de puntaje obtenido
    averageTime: number;             // Tiempo promedio de resolución
  };
  reviewedBy?: string;               // Usuario que revisó la pregunta
  lastUsed?: string;                  // Última vez que se usó
  isActive: boolean;                  // Estado de disponibilidad
  createdBy?: string;                 // Autor de la pregunta
  createdAt?: string;                 // Fecha de creación
  updatedAt?: string;                 // Última actualización
}


// Interfaz para examen
export interface Exam {
  _id?: string;
  name: string;
  description?: string;
  type: 'placement' | 'progress' | 'final' | 'practice';
  targetLevel: Level;
  structure: {
    sections: ExamSection[];
    totalQuestions: number;
    totalPoints: number;
    totalDuration: number; // en minutos
    maxAttempts?: number; // Máximo de intentos permitidos
    passingScore?: number;
  };
  configuration: {
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
    showResults: boolean;
    allowReview: boolean;
    passingScore: number;
    maxAttempts?: number;
    attemptsAllowed?:number;
  };
  questionPool?: string[]; // IDs de preguntas
  isActive: boolean;
  isTemplate: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interfaz para sección de examen
export interface ExamSection {
  id: string;
  name: string;
  competency: Competency;
  instructions: string;
  questionCount: number;
  questionTypes: QuestionType[];
  points: number;
  duration?: number; // en minutos
  order: number;
  passingScore?: number; // Puntaje mínimo para aprobar esta sección
}

// Interfaz para sesión de examen
export interface ExamSession {
  _id?: string;
  examId: string;
  exam?: Exam;
  sessionName: string;
  scheduling: {
    startDate: string;
    endDate: string;
    duration: number;
    timeZone: string;
    timeSlots: any[];
  };
  participants: {
    candidates: string[];
    proctors: string[];
    maxCandidates: number;
    registeredCandidates?:any[]
  };
  settings: {
    requireProctor: boolean;
    recordSession: boolean;
    allowLateEntry: boolean;
    browserLockdown: boolean;
    autoStart: boolean;
    lateEntryMinutes?:number;
  };
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  stats?: {
    registered: number;
    started: number;
    completed: number;
    averageScore: number;
    totalRegistered:number;
    totalCompleted:number;
    totalAbandoned:number;
  };
  sessionType?: 'group_synchronized' | 'individual_flexible';
  timing?: {
    sessionWindow: {
      start: string; // Fecha/hora inicio (ISO)
      end: string;   // Fecha/hora fin (ISO)
    };
    examDuration: number; // Duración en minutos
    lateJoinPolicy?: 'remaining' | 'guaranteed' | 'sliding' | undefined; // Política al entrar tarde
    maxLateness?: number; // Minutos máximos permitidos de retraso
    autoSaveInterval?: number; // Intervalo de auto-guardado (segundos)
    guaranteedTime?: boolean; // Si garantiza tiempo completo aunque entre tarde
  };
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interfaz para resultado de examen
export interface ExamResult {
  _id?: string;
  candidateId: string;
  examId: string;
  sessionId: string;
  responses: QuestionResponse[];
  scores: {
    total: number;
    byCompetency: Record<Competency, number>;
    percentage: number;
    level?: Level;
  };
  timing: {
    startTime: string;
    endTime: string;
    duration: number;
    pausedDuration?: number;
  };
  feedback?: {
    general: string;
    byCompetency: Record<Competency, string>;
    recommendations: string[];
  };
  status: 'in_progress' | 'completed' | 'abandoned' | 'disqualified';
  createdAt?: string;
  updatedAt?: string;
}

// Interfaz para respuesta a pregunta
export interface QuestionResponse {
  questionId: string;
  competency: Competency;
  response: {
    answer?: string | string[];
    audioUrl?: string;
    textResponse?: string;
  };
  evaluation?: {
    isCorrect?: boolean;
    score: number;
    maxScore: number;
    feedback?: string;
  };
  timeSpent: number;
  attempts: number;
}

// Tipos para filtros y paginación
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QuestionFilters {
  type?: QuestionType;
  competency?: Competency;
  level?: Level;
  difficulty?: number;
  tags?: string[];
  isActive?: boolean;
}

export interface ExamFilters {
  type?: 'placement' | 'progress' | 'final' | 'practice';
  targetLevel?: Level;
  isActive?: boolean;
  isTemplate?: boolean;
}

// Respuestas de API
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}
export interface ApiQuestionResponse {
  questions: Question[];
  total: number;
  page: number;
  totalPages: number;
}

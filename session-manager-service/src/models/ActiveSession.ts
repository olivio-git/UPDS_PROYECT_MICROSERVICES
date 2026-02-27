import mongoose, { Document, Schema } from 'mongoose';

// Interfaz para el estado de un participante
export interface IParticipantStatus {
  status: 'waiting' | 'connected' | 'in_progress' | 'completed' | 'disconnected';
  joinedAt?: Date;
  lastActivity: Date;
  currentQuestionIndex: number;
  answeredQuestions: string[];
  timeSpent: number;
  ipAddress?: string;
  userAgent?: string;
}

// Interfaz para datos de sesión individual
export interface IIndividualSessionData {
  candidateId: string;
  subSessionId: string;      // ABC-FLEX-001.01
  startedAt: Date;
  expiresAt: Date;
  timeAllowed: number;       // en segundos
  autoSaveInterval: number;  // en segundos
  status: 'waiting' | 'active' | 'completed' | 'expired';
  lastAutoSave?: Date;
  disconnections: number;
  lastActivity: Date;
}

// Interfaz para configuración de timing
export interface ITimingConfig {
  sessionWindow: {
    start: Date;
    end: Date;
  };
  examDuration?: number;     // en minutos (solo para flexible)
  guaranteedTime?: boolean;
  lateJoinPolicy?: 'guaranteed' | 'remaining' | 'sliding';
  maxLateness?: number;      // minutos
  autoSaveInterval?: number; // segundos
  memoryCleanupInterval?: number; // minutos
}

// Interfaz para una respuesta en la sesión
export interface ISessionResponse {
  questionId: string;
  candidateId: string;
  response: any;
  timeSpent: number;
  timestamp: Date;
  evaluation?: {
    isCorrect?: boolean;
    score: number;
    maxScore: number;
    feedback?: string;
    evaluatedBy: 'auto' | 'ai' | 'human';
    evaluatedAt: Date;
  };
}

// Interfaz principal de la sesión activa
export interface IActiveSession extends Document {
  _id: string;
  sessionId: string;
  examId: string;
  sessionName: string;
  examName: string;
  
  // Tipo de sesión - NUEVO
  sessionType: 'group_synchronized' | 'individual_flexible';
  
  // Estado de la sesión
  status: 'scheduled' | 'lobby_open' | 'active' | 'paused' | 'completed' | 'cancelled';
  startedAt?: Date;
  endedAt?: Date;
  
  // Configuración de timing - NUEVO
  timing?: ITimingConfig;
  
  // Sesiones individuales - NUEVO (solo para individual_flexible)
  individualSessions?: Map<string, IIndividualSessionData>;
  
  // Configuración
  settings: {
    duration: number; // en minutos
    autoStart: boolean;
    autoEnd: boolean;
    allowLateJoin: boolean;
    showResults: boolean;
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
    maxAttempts: number;
    instructions?: string;
    maxParticipants?: number;
    requiresTechnicalVerification?: boolean;
    allowOpenRegistration?: boolean;
    registrationDeadline?: Date;
    competencies?: string[];
  };
  
  // Participantes
  participants: {
    registeredCandidates: string[];
    activeCandidates: string[];
    proctors: string[];
    status: Map<string, IParticipantStatus>;
  };
  
  // Preguntas y progreso
  questions: {
    totalQuestions: number;
    questionsPerCandidate: Map<string, string[]>; // candidateId -> questionIds
    sectionedQuestionsPerCandidate?: Map<string, any[]>; // candidateId -> sections with questions
    responses: ISessionResponse[];
  };
  
  // Estadísticas en tiempo real
  stats: {
    totalParticipants: number;
    activeParticipants: number;
    completedParticipants: number;
    averageProgress: number;
    averageTimeSpent: number;
  };
  
  // Configuración técnica
  technical: {
    serverInstance: string;
    lastHeartbeat: Date;
    connections: number;
  };
  
  // Metadatos
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  
  // Información del lobby
  lobbyActive?: boolean;
  lobbyCreatedAt?: Date;
  
  // Control de memoria - NUEVO
  memoryStats?: {
    totalSubSessions: number;
    activeSubSessions: number;
    lastCleanup: Date;
    autoSaveJobs: number;
  };

  // Métodos de instancia
  isActive(): boolean;
  canJoin(userId: string): boolean;
  addParticipant(userId: string, role: 'candidate' | 'proctor'): void;
  removeParticipant(userId: string): void;
  addResponse(response: ISessionResponse): void;
  updateStats(): void;
  // Nuevos métodos para sesión individual
  createIndividualSession(candidateId: string, config: ITimingConfig): string;
  getIndividualSession(candidateId: string): IIndividualSessionData | null;
  cleanupExpiredSessions(): void;
}

// Interfaz del Modelo con métodos estáticos tipados
export interface IActiveSessionModel extends mongoose.Model<IActiveSession> {
  findBySessionId(sessionId: string): Promise<IActiveSession | null>;
  findActiveByExam(examId: string): Promise<IActiveSession[]>;
  findByParticipant(userId: string): Promise<IActiveSession[]>;
  cleanupAllExpiredSessions(): Promise<any>;
  getMemoryStats(): Promise<any>;
}

const ParticipantStatusSchema = new Schema({
  status: {
    type: String,
    enum: ['waiting', 'connected', 'in_progress', 'completed', 'disconnected'],
    default: 'waiting'
  },
  joinedAt: Date,
  lastActivity: { type: Date, default: Date.now },
  currentQuestionIndex: { type: Number, default: 0 },
  answeredQuestions: [String],
  timeSpent: { type: Number, default: 0 },
  ipAddress: String,
  userAgent: String
});

const SessionResponseSchema = new Schema({
  questionId: { type: String, required: true },
  candidateId: { type: String, required: true },
  response: Schema.Types.Mixed,
  timeSpent: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  evaluation: {
    isCorrect: Boolean,
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    feedback: String,
    evaluatedBy: {
      type: String,
      enum: ['auto', 'ai', 'human'],
      default: 'auto'
    },
    evaluatedAt: Date
  }
});

// Schema para sesión individual
const IndividualSessionSchema = new Schema({
  candidateId: { type: String, required: true },
  subSessionId: { type: String, required: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  timeAllowed: { type: Number, required: true },
  autoSaveInterval: { type: Number, default: 30 },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'expired'],
    default: 'waiting'
  },
  lastAutoSave: Date,
  disconnections: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now }
});

// Schema para configuración de timing
const TimingConfigSchema = new Schema({
  sessionWindow: {
    start: { type: Date, required: false },
    end: { type: Date, required: false }
  },
  examDuration: Number,
  guaranteedTime: { type: Boolean, default: false },
  lateJoinPolicy: {
    type: String,
    enum: ['guaranteed', 'remaining', 'sliding'],
    default: 'remaining'
  },
  maxLateness: { type: Number, default: 0 },
  autoSaveInterval: { type: Number, default: 30 },
  memoryCleanupInterval: { type: Number, default: 60 }
});

const ActiveSessionSchema = new Schema<IActiveSession, IActiveSessionModel>({
  sessionId: { type: String, required: true, unique: true, index: true },
  sessionType: {
    type: String,
    enum: ['group_synchronized', 'individual_flexible'],
    default: 'group_synchronized',
    index: true
  },
  examId: { type: String, required: true, index: true },
  sessionName: { type: String, required: true },
  examName: { type: String, required: true },
  
  status: {
    type: String,
    enum: ['scheduled', 'lobby_open', 'active', 'paused', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  startedAt: Date,
  endedAt: Date,
  
  timing: TimingConfigSchema,
  individualSessions: {
    type: Map,
    of: IndividualSessionSchema,
    default: {}
  },
  
  settings: {
    duration: { type: Number, required: false },
    autoStart: { type: Boolean, default: false },
    autoEnd: { type: Boolean, default: true },
    allowLateJoin: { type: Boolean, default: true },
    showResults: { type: Boolean, default: false },
    randomizeQuestions: { type: Boolean, default: true },
    randomizeOptions: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: 1 },
    instructions: String,
    maxParticipants: { type: Number },
    requiresTechnicalVerification: { type: Boolean, default: false },
    allowOpenRegistration: { type: Boolean, default: false },
    registrationDeadline: { type: Date },
    competencies: [{ type: String }]
  },
  
  participants: {
    registeredCandidates: [String],
    activeCandidates: [String],
    proctors: [String],
    status: {
      type: Map,
      of: ParticipantStatusSchema,
      default: {}
    }
  },
  
  questions: {
    totalQuestions: { type: Number, default: 0 },
    questionsPerCandidate: {
      type: Map,
      of: [String],
      default: {}
    },
    responses: [SessionResponseSchema]
  },
  
  stats: {
    totalParticipants: { type: Number, default: 0 },
    activeParticipants: { type: Number, default: 0 },
    completedParticipants: { type: Number, default: 0 },
    averageProgress: { type: Number, default: 0 },
    averageTimeSpent: { type: Number, default: 0 }
  },
  
  technical: {
    serverInstance: String,
    lastHeartbeat: { type: Date, default: Date.now },
    connections: { type: Number, default: 0 }
  },
  
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  scheduledAt: { type: Date },
  lobbyActive: { type: Boolean, default: false },
  lobbyCreatedAt: { type: Date },
  
  memoryStats: {
    totalSubSessions: { type: Number, default: 0 },
    activeSubSessions: { type: Number, default: 0 },
    lastCleanup: { type: Date, default: Date.now },
    autoSaveJobs: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'active_sessions'
});

// Índices para optimización
ActiveSessionSchema.index({ sessionId: 1, status: 1 });
ActiveSessionSchema.index({ examId: 1 });
ActiveSessionSchema.index({ sessionType: 1, status: 1 });
ActiveSessionSchema.index({ 'participants.registeredCandidates': 1 });
ActiveSessionSchema.index({ 'participants.activeCandidates': 1 });
ActiveSessionSchema.index({ createdAt: 1 });
ActiveSessionSchema.index({ 'technical.lastHeartbeat': 1 });
ActiveSessionSchema.index({ 'memoryStats.lastCleanup': 1 });
ActiveSessionSchema.index({ 'individualSessions.candidateId': 1 });

// Middleware para actualizar updatedAt
ActiveSessionSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Métodos de instancia
ActiveSessionSchema.methods.isActive = function(): boolean {
  return this.status === 'active';
};

ActiveSessionSchema.methods.canJoin = function(userId: string): boolean {
  if (!this.isActive() && this.status !== 'scheduled') {
    return false;
  }
  
  return this.participants.registeredCandidates.includes(userId) ||
         this.participants.proctors.includes(userId);
};

ActiveSessionSchema.methods.addParticipant = function(userId: string, role: 'candidate' | 'proctor') {
  if (role === 'candidate' && !this.participants.activeCandidates.includes(userId)) {
    this.participants.activeCandidates.push(userId);
  }
  
  if (!this.participants.status.has(userId)) {
    this.participants.status.set(userId, {
      status: 'connected',
      joinedAt: new Date(),
      lastActivity: new Date(),
      currentQuestionIndex: 0,
      answeredQuestions: [],
      timeSpent: 0
    });
  }
  
  this.stats.activeParticipants = this.participants.activeCandidates.length;
  this.technical.connections += 1;
};

ActiveSessionSchema.methods.removeParticipant = function(userId: string) {
  const participantStatus = this.participants.status.get(userId);
  if (participantStatus) {
    participantStatus.status = 'disconnected';
    participantStatus.lastActivity = new Date();
    this.participants.status.set(userId, participantStatus);
  }
  
  this.participants.activeCandidates = this.participants.activeCandidates.filter(
    (id: string) => id !== userId
  );
  
  this.stats.activeParticipants = this.participants.activeCandidates.length;
  this.technical.connections = Math.max(0, this.technical.connections - 1);
};

ActiveSessionSchema.methods.addResponse = function(response: ISessionResponse) {
  this.questions.responses.push(response);
  
  // Actualizar progreso del participante
  const participantStatus = this.participants.status.get(response.candidateId);
  if (participantStatus) {
    participantStatus.answeredQuestions.push(response.questionId);
    participantStatus.timeSpent += response.timeSpent;
    participantStatus.lastActivity = new Date();
    this.participants.status.set(response.candidateId, participantStatus);
  }
  
  this.updateStats();
};

ActiveSessionSchema.methods.updateStats = function() {
  const participants = Array.from(this.participants.status.values()) as IParticipantStatus[];
  const activeParticipants = participants.filter(p => p.status === 'connected' || p.status === 'in_progress');
  const completedParticipants = participants.filter(p => p.status === 'completed');
  
  this.stats.activeParticipants = activeParticipants.length;
  this.stats.completedParticipants = completedParticipants.length;
  
  if (participants.length > 0) {
    const totalAnswered = participants.reduce<number>((sum, p) => sum + p.answeredQuestions.length, 0);
    const totalPossible = participants.length * this.questions.totalQuestions;
    this.stats.averageProgress = totalPossible > 0 ? (totalAnswered / totalPossible) * 100 : 0;
    
    const totalTime = participants.reduce<number>((sum, p) => sum + p.timeSpent, 0);
    this.stats.averageTimeSpent = participants.length > 0 ? totalTime / participants.length : 0;
  }
  
  this.technical.lastHeartbeat = new Date();
};

// Métodos para sesión individual
ActiveSessionSchema.methods.createIndividualSession = function(candidateId: string, config: ITimingConfig): string {
  const sessionIndex = this.memoryStats?.totalSubSessions || 0;
  const subSessionId = `${this.sessionId}.${String(sessionIndex + 1).padStart(3, '0')}`;
  
  const now = new Date();
  const examDuration = (config.examDuration || 60) * 60 * 1000; // convertir a ms
  
  const individualSession: IIndividualSessionData = {
    candidateId,
    subSessionId,
    startedAt: now,
    expiresAt: new Date(now.getTime() + examDuration),
    timeAllowed: examDuration / 1000, // en segundos
    autoSaveInterval: config.autoSaveInterval || 30,
    status: 'active',
    disconnections: 0,
    lastActivity: now
  };
  
  if (!this.individualSessions) {
    this.individualSessions = new Map();
  }
  
  this.individualSessions.set(candidateId, individualSession);
  
  // Actualizar stats de memoria
  if (!this.memoryStats) {
    this.memoryStats = {
      totalSubSessions: 0,
      activeSubSessions: 0,
      lastCleanup: now,
      autoSaveJobs: 0
    };
  }
  
  this.memoryStats.totalSubSessions += 1;
  this.memoryStats.activeSubSessions += 1;
  
  return subSessionId;
};

ActiveSessionSchema.methods.getIndividualSession = function(candidateId: string): IIndividualSessionData | null {
  return this.individualSessions?.get(candidateId) || null;
};

ActiveSessionSchema.methods.cleanupExpiredSessions = function(): void {
  if (!this.individualSessions || this.individualSessions.size === 0) return;
  
  const now = new Date();
  let cleaned = 0;
  
  for (const [candidateId, session] of this.individualSessions.entries()) {
    // Limpiar sesiones expiradas o completadas hace más de 1 hora
    const isExpired = now > session.expiresAt;
    const isOldCompleted = session.status === 'completed' && 
                          (now.getTime() - session.expiresAt.getTime()) > 60 * 60 * 1000;
    
    if (isExpired || isOldCompleted) {
      this.individualSessions.delete(candidateId);
      cleaned++;
      
      if (session.status === 'active') {
        this.memoryStats!.activeSubSessions -= 1;
      }
    }
  }
  
  if (this.memoryStats) {
    this.memoryStats.lastCleanup = now;
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Limpiadas ${cleaned} sesiones individuales expiradas para sesión ${this.sessionId}`);
  }
};

// Métodos estáticos
ActiveSessionSchema.statics.findBySessionId = function(sessionId: string) {
  return this.findOne({ sessionId });
};

ActiveSessionSchema.statics.findActiveByExam = function(examId: string) {
  return this.find({ examId, status: 'active' });
};

ActiveSessionSchema.statics.findByParticipant = function(userId: string) {
  return this.find({
    $or: [
      { 'participants.registeredCandidates': userId },
      { 'participants.activeCandidates': userId },
      { 'participants.proctors': userId }
    ]
  });
};

// Métodos estáticos para manejo de memoria
ActiveSessionSchema.statics.cleanupAllExpiredSessions = async function() {
  try {
    // Obtener todas las sesiones individual_flexible
    const sessions = await this.find({ sessionType: 'individual_flexible' });
    let totalCleaned = 0;
    
    for (const session of sessions) {
      // Llamar al método de instancia que maneja la limpieza correctamente
      const before = session.memoryStats?.activeSubSessions || 0;
      session.cleanupExpiredSessions();
      const after = session.memoryStats?.activeSubSessions || 0;
      const cleaned = before - after;
      
      if (cleaned > 0) {
        totalCleaned += cleaned;
        await session.save();
      }
    }
    
    return { modifiedCount: sessions.length, cleanedSessions: totalCleaned };
  } catch (error) {
    console.error('Error en cleanupAllExpiredSessions:', error);
    throw error;
  }
};

ActiveSessionSchema.statics.getMemoryStats = function() {
  return this.aggregate([
    { $match: { sessionType: 'individual_flexible' } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalSubSessions: { $sum: '$memoryStats.totalSubSessions' },
        activeSubSessions: { $sum: '$memoryStats.activeSubSessions' },
        totalAutoSaveJobs: { $sum: '$memoryStats.autoSaveJobs' }
      }
    }
  ]);
};

// Middleware para limpieza automática
ActiveSessionSchema.pre('save', function() {
  this.updatedAt = new Date();
  
  // Auto-limpieza cada 10 minutos
  if (this.sessionType === 'individual_flexible' && this.memoryStats) {
    const timeSinceLastCleanup = Date.now() - this.memoryStats.lastCleanup.getTime();
    if (timeSinceLastCleanup > 10 * 60 * 1000) { // 10 minutos
      this.cleanupExpiredSessions();
    }
  }
});

export const ActiveSessionModel = mongoose.model<IActiveSession, IActiveSessionModel>('ActiveSession', ActiveSessionSchema);

import { ObjectId } from 'mongodb';

// ================================
// USER TYPES
// ================================

export interface User {
  _id?: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  profile: UserProfile;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  teacherData?: TeacherData;
  proctorData?: ProctorData;
}

export type UserRole = 'admin' | 'teacher' | 'proctor' | 'student';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface UserProfile {
  avatar?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  nationality?: string;
  bio?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  language: 'es' | 'en';
  timezone: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface TeacherData {
  department: string;
  specialization: string[];
  experience: number; // años
  certifications: Certification[];
  schedule: TeacherSchedule[];
}

export interface ProctorData {
  availableHours: AvailableHours[];
  certificationLevel: string;
  languages: string[];
  maxSimultaneousSessions: number;
}

export interface Certification {
  name: string;
  institution: string;
  date: Date;
  expiryDate?: Date;
  verificationUrl?: string;
}

export interface TeacherSchedule {
  dayOfWeek: number; // 0-6 (domingo a sábado)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface AvailableHours {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// ================================
// CANDIDATE TYPES
// ================================

export interface Candidate {
  _id?: ObjectId;
  personalInfo: PersonalInfo;
  academicInfo: AcademicInfo;
  technicalSetup: TechnicalSetup;
  examHistory: ExamHistoryEntry[];
  status: CandidateStatus;
  registeredBy: ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: Date | string;
  nationality?: string;
  identification?: {
    type: 'ci' | 'passport' | 'other';
    number: string;
  };
  // Retrocompatibilidad para importación CSV
  idNumber?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface AcademicInfo {
  currentLevel: MCERLevel;
  targetLevel: MCERLevel;
  studyPurpose?: StudyPurpose;
  previousExperience?: PreviousExperience[] | string;
  institution?: string;
  courseDuration?: number; // en meses
  // Retrocompatibilidad para importación CSV
  motivation?: string;
}

export type MCERLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type StudyPurpose = 'academic' | 'professional' | 'travel' | 'personal' | 'immigration';

export interface PreviousExperience {
  institution: string;
  level: MCERLevel;
  duration: number; // en meses
  year: number;
  certificateUrl?: string;
}

export interface TechnicalSetup {
  hasCamera?: boolean;
  hasMicrophone?: boolean;
  hasStableInternet?: boolean;
  browserInfo?: BrowserInfo;
  systemInfo?: SystemInfo;
  lastTechCheck?: Date;
  techCheckResults?: TechCheckResults;
  // Retrocompatibilidad para importación CSV
  browser?: string;
  operatingSystem?: string;
}

export interface BrowserInfo {
  name: string;
  version: string;
  userAgent: string;
}

export interface SystemInfo {
  os: string;
  device: string;
  screenResolution: string;
}

export interface TechCheckResults {
  camera: boolean;
  microphone: boolean;
  speakers: boolean;
  internetSpeed: number; // Mbps
  latency: number; // ms
}

export interface ExamHistoryEntry {
  examId: ObjectId;
  sessionId: ObjectId;
  date: Date;
  level: MCERLevel;
  scores: CompetencyScores;
  overallScore: number;
  result: ExamResult;
  certificateUrl?: string;
}

export interface CompetencyScores {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

export type ExamResult = 'passed' | 'failed' | 'pending';

export type CandidateStatus = 'registered' | 'verified' | 'active' | 'inactive' | 'graduated';

// ================================
// ROLE & PERMISSION TYPES
// ================================

export interface Role {
  _id?: ObjectId;
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  resource: string;
  actions: string[];
}

// Recursos del sistema
export type Resource = 
  | 'users' 
  | 'candidates' 
  | 'exams' 
  | 'sessions' 
  | 'reports' 
  | 'settings' 
  | 'roles'
  | 'questions'
  | 'results';

// Acciones permitidas
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';

// ================================
// API TYPES
// ================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  role?: UserRole;
  level?: MCERLevel;
  dateFrom?: Date;
  dateTo?: Date;
}

// ================================
// REQUEST/RESPONSE TYPES
// ================================

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profile?: Partial<UserProfile>;
  teacherData?: TeacherData;
  proctorData?: ProctorData;
  status?: UserStatus;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  profile?: Partial<UserProfile>;
  permissions?: Permission[];
  teacherData?: TeacherData;
  proctorData?: ProctorData;
  email?: string;
}

export interface CreateCandidateRequest {
  personalInfo: PersonalInfo;
  academicInfo: AcademicInfo;
  technicalSetup?: TechnicalSetup;
  notes?: string;
}

export interface UpdateCandidateRequest {
  personalInfo?: Partial<PersonalInfo>;
  academicInfo?: Partial<AcademicInfo>;
  technicalSetup?: Partial<TechnicalSetup>;
  status?: CandidateStatus;
  notes?: string;
}

export interface BulkImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  data: any;
}

// ================================
// JWT PAYLOAD TYPE
// ================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat?: number;
  exp?: number;
}

// ================================
// EVENT TYPES (for Kafka)
// ================================

export interface UserEvent {
  type: 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'USER_LOGIN' | 'USER_LOGOUT';
  userId: string;
  data: any;
  timestamp: Date;
  metadata?: {
    source: string;
    version: string;
    correlationId?: string;
  };
}

export interface CandidateEvent {
  type: 'CANDIDATE_REGISTERED' | 'CANDIDATE_UPDATED' | 'CANDIDATE_VERIFIED' | 'CANDIDATE_STATUS_CHANGED';
  candidateId: string;
  data: any;
  timestamp: Date;
  metadata?: {
    source: string;
    version: string;
    correlationId?: string;
  };
}

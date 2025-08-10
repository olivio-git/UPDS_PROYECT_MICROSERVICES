import { z } from 'zod';

// ================================
// COMMON SCHEMAS
// ================================

const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ObjectId inválido');

const EmailSchema = z.string().email('Email inválido');

const PhoneSchema = z.string().min(7, 'Teléfono debe tener al menos 7 caracteres').optional();

const MCERLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const UserRoleSchema = z.enum(['admin', 'teacher', 'proctor', 'student']);

const UserStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending']);

const CandidateStatusSchema = z.enum(['registered', 'verified', 'active', 'inactive', 'graduated']);

// ================================
// ADDRESS SCHEMA
// ================================

const AddressSchema = z.object({
  street: z.string().min(5, 'Dirección debe tener al menos 5 caracteres'),
  city: z.string().min(2, 'Ciudad debe tener al menos 2 caracteres'),
  state: z.string().min(2, 'Estado debe tener al menos 2 caracteres'),
  country: z.string().min(2, 'País debe tener al menos 2 caracteres'),
  zipCode: z.string().optional(),
});

// ================================
// USER SCHEMAS
// ================================

const UserPreferencesSchema = z.object({
  language: z.enum(['es', 'en']).default('es'),
  timezone: z.string().default('America/La_Paz'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    sms: z.boolean().default(false),
  }),
});

const UserProfileSchema = z.object({
  avatar: z.string().url().optional(),
  phone: PhoneSchema,
  address: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  nationality: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  preferences: UserPreferencesSchema.optional(),
});

const CertificationSchema = z.object({
  name: z.string().min(2, 'Nombre de certificación requerido'),
  institution: z.string().min(2, 'Institución requerida'),
  date: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  verificationUrl: z.string().url().optional(),
});

const TeacherScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido'),
});

const TeacherDataSchema = z.object({
  department: z.string().min(2, 'Departamento requerido'),
  specialization: z.array(z.string()).min(1, 'Al menos una especialización requerida'),
  experience: z.number().min(0, 'Experiencia no puede ser negativa'),
  certifications: z.array(CertificationSchema).default([]),
  schedule: z.array(TeacherScheduleSchema).default([]),
});

const AvailableHoursSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido'),
});

const ProctorDataSchema = z.object({
  availableHours: z.array(AvailableHoursSchema).default([]),
  certificationLevel: z.string().min(1, 'Nivel de certificación requerido'),
  languages: z.array(z.string()).min(1, 'Al menos un idioma requerido'),
  maxSimultaneousSessions: z.number().min(1, 'Mínimo 1 sesión simultánea'),
});

const PermissionSchema = z.object({
  resource: z.string().min(1, 'Recurso requerido'),
  actions: z.array(z.string()).min(1, 'Al menos una acción requerida'),
});

// ================================
// CANDIDATE SCHEMAS
// ================================

const EmergencyContactSchema = z.object({
  name: z.string().min(2, 'Nombre de contacto de emergencia requerido'),
  relationship: z.string().min(2, 'Relación requerida'),
  phone: z.string().min(7, 'Teléfono de contacto requerido'),
  email: EmailSchema.optional(),
});

const PersonalInfoSchema = z.object({
  firstName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'Apellido debe tener al menos 2 caracteres'),
  email: EmailSchema,
  phone: PhoneSchema,
  dateOfBirth: z.coerce.date().refine(
    (date) => {
      const age = new Date().getFullYear() - date.getFullYear();
      return age >= 16 && age <= 100;
    },
    'Edad debe estar entre 16 y 100 años'
  ),
  nationality: z.string().min(2, 'Nacionalidad requerida'),
  identification: z.object({
    type: z.enum(['ci', 'passport', 'other']),
    number: z.string().min(3, 'Número de identificación inválido'),
  }),
  address: AddressSchema,
  emergencyContact: EmergencyContactSchema.optional(),
});

const PreviousExperienceSchema = z.object({
  institution: z.string().min(2, 'Institución requerida'),
  level: MCERLevelSchema,
  duration: z.number().min(1, 'Duración debe ser al menos 1 mes'),
  year: z.number().min(2000).max(new Date().getFullYear()),
  certificateUrl: z.string().url().optional(),
});

const AcademicInfoSchema = z.object({
  currentLevel: MCERLevelSchema,
  targetLevel: MCERLevelSchema,
  studyPurpose: z.enum(['academic', 'professional', 'travel', 'personal', 'immigration']),
  previousExperience: z.array(PreviousExperienceSchema).default([]),
  institution: z.string().optional(),
  courseDuration: z.number().positive().optional(),
});

const BrowserInfoSchema = z.object({
  name: z.string().default(''),
  version: z.string().default(''),
  userAgent: z.string().default(''),
});

const SystemInfoSchema = z.object({
  os: z.string().default(''),
  device: z.string().default(''),
  screenResolution: z.string().default(''),
});

const TechCheckResultsSchema = z.object({
  camera: z.boolean(),
  microphone: z.boolean(),
  speakers: z.boolean(),
  internetSpeed: z.number().min(0),
  latency: z.number().min(0),
});

const TechnicalSetupSchema = z.object({
  hasCamera: z.boolean().default(false),
  hasMicrophone: z.boolean().default(false),
  hasStableInternet: z.boolean().default(false),
  browserInfo: BrowserInfoSchema.default({}),
  systemInfo: SystemInfoSchema.default({}),
  lastTechCheck: z.coerce.date().optional(),
  techCheckResults: TechCheckResultsSchema.optional(),
});

// ================================
// ROLE SCHEMAS
// ================================

const RoleSchema = z.object({
  name: z.string()
    .min(2, 'Nombre del rol debe tener al menos 2 caracteres')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Nombre contiene caracteres inválidos'),
  description: z.string().min(10, 'Descripción debe tener al menos 10 caracteres'),
  permissions: z.array(PermissionSchema).min(1, 'Al menos un permiso requerido'),
  isDefault: z.boolean().default(false),
});

// ================================
// REQUEST SCHEMAS
// ================================

// Pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Filters
export const FilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  role: UserRoleSchema.optional(),
  level: MCERLevelSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// User Requests
export const CreateUserSchema = z.object({
  email: EmailSchema,
  firstName: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'Apellido debe tener al menos 2 caracteres'),
  role: UserRoleSchema,
  profile: UserProfileSchema.optional(),
  teacherData: TeacherDataSchema.optional(),
  proctorData: ProctorDataSchema.optional(),
}).refine((data) => {
  // Validar que teacherData esté presente si el rol es teacher
  if (data.role === 'teacher' && !data.teacherData) {
    return false;
  }
  // Validar que proctorData esté presente si el rol es proctor
  if (data.role === 'proctor' && !data.proctorData) {
    return false;
  }
  return true;
}, {
  message: 'Datos específicos del rol son requeridos',
  path: ['role'],
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  profile: UserProfileSchema.partial().optional(),
  permissions: z.array(PermissionSchema).optional(),
  teacherData: TeacherDataSchema.optional(),
  proctorData: ProctorDataSchema.optional(),
});

export const UpdateUserPasswordSchema = z.object({
  oldPassword: z.string().min(8, 'Contraseña actual requerida'),
  newPassword: z.string({
    required_error: "Nueva contraseña es requerida"
  })
  .min(8, 'Nueva contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirmación de contraseña requerida'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

// Candidate Requests
export const CreateCandidateSchema = z.object({
  personalInfo: PersonalInfoSchema,
  academicInfo: AcademicInfoSchema,
  technicalSetup: TechnicalSetupSchema.partial().optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateCandidateSchema = z.object({
  personalInfo: PersonalInfoSchema.partial().optional(),
  academicInfo: AcademicInfoSchema.partial().optional(),
  technicalSetup: TechnicalSetupSchema.partial().optional(),
  status: CandidateStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
});

// Role Requests
export const CreateRoleSchema = RoleSchema;

export const UpdateRoleSchema = RoleSchema.partial();

// Bulk Import
export const BulkImportSchema = z.object({
  data: z.array(z.record(z.any())).min(1, 'Al menos un registro requerido'),
  skipErrors: z.boolean().default(false),
  updateExisting: z.boolean().default(false),
});

// Tech Check
export const TechCheckSchema = z.object({
  candidateId: ObjectIdSchema,
  results: TechCheckResultsSchema,
});

// Search
export const SearchSchema = z.object({
  query: z.string().min(1, 'Consulta de búsqueda requerida'),
  type: z.enum(['users', 'candidates', 'all']).default('all'),
  filters: FilterSchema.optional(),
  pagination: PaginationSchema.optional(),
});

// Batch Operations
export const BatchUpdateSchema = z.object({
  ids: z.array(ObjectIdSchema).min(1, 'Al menos un ID requerido'),
  updates: z.record(z.any()).refine(
    (updates) => Object.keys(updates).length > 0,
    'Al menos un campo para actualizar requerido'
  ),
});

export const BatchDeleteSchema = z.object({
  ids: z.array(ObjectIdSchema).min(1, 'Al menos un ID requerido'),
  force: z.boolean().default(false),
});

// File Upload
export const FileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string().refine(
    (mimetype) => [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ].includes(mimetype),
    'Tipo de archivo no permitido'
  ),
  size: z.number().max(10 * 1024 * 1024, 'Archivo muy grande (máximo 10MB)'),
});

// ================================
// PARAMETER SCHEMAS
// ================================

// Para validar parámetros de URL
export const idParamsSchema = z.object({
  id: ObjectIdSchema,
});

export const getUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const getCandidatesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  status: CandidateStatusSchema.optional(),
  level: MCERLevelSchema.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'personalInfo.firstName', 'personalInfo.lastName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const getRolesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Schema para importación de candidatos
export const importCandidatesSchema = z.object({
  file: z.any(), // multer file
  skipErrors: z.coerce.boolean().default(false),
  updateExisting: z.coerce.boolean().default(false),
});

// Schema para validar cambio de contraseña
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  confirmPassword: z.string().min(1, 'Confirmación de contraseña requerida'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

// Schema para asignar rol
export const assignRoleSchema = z.object({
  roleId: ObjectIdSchema,
  permissions: z.array(PermissionSchema).optional(),
});

// ================================
// EXPORT SCHEMAS
// ================================

export {
  ObjectIdSchema,
  EmailSchema,
  PhoneSchema,
  MCERLevelSchema,
  UserRoleSchema,
  UserStatusSchema,
  CandidateStatusSchema,
  AddressSchema,
  UserProfileSchema,
  PersonalInfoSchema,
  AcademicInfoSchema,
  TechnicalSetupSchema,
  RoleSchema,
  PermissionSchema,
  TeacherDataSchema,
  ProctorDataSchema,
};

import { ObjectId } from 'mongodb';
import { 
  Candidate,
  PersonalInfo,
  AcademicInfo,
  TechnicalSetup,
  ExamHistoryEntry,
  CandidateStatus,
  MCERLevel,
  CompetencyScores
} from '@/types';

export class CandidateModel implements Candidate {
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

  constructor(data: Partial<Candidate>) {
    this._id = data._id ?? undefined;
    this.personalInfo = data.personalInfo || {} as PersonalInfo;
    this.academicInfo = data.academicInfo || {} as AcademicInfo;
    this.technicalSetup = data.technicalSetup || this.getDefaultTechnicalSetup();
    this.examHistory = data.examHistory || [];
    this.status = data.status || 'registered';
    this.registeredBy = data.registeredBy || new ObjectId();
    this.notes = data.notes ?? undefined;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // ================================
  // MÉTODOS DE UTILIDAD
  // ================================

  public getFullName(): string {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`.trim();
  }

  public getAge(): number | null {
    if (!this.personalInfo.dateOfBirth) return null;
    
    const today = new Date();
    const birthDate = new Date(this.personalInfo.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  public isActive(): boolean {
    return this.status === 'active';
  }

  public isEligibleForLevel(level: MCERLevel): boolean {
    // Verificar si el candidato cumple los requisitos para el nivel
    const levelOrder: MCERLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIndex = levelOrder.indexOf(this.academicInfo.currentLevel);
    const targetIndex = levelOrder.indexOf(level);
    
    // No puede saltar más de un nivel
    return targetIndex <= currentIndex + 1;
  }

  public calculateTargetLevel(): MCERLevel {
    // Lógica para calcular el nivel objetivo basado en historial
    if (this.examHistory.length === 0) {
      return this.academicInfo.currentLevel;
    }

    // Obtener el último examen aprobado
    const lastPassedExam = this.examHistory
      .filter(exam => exam.result === 'passed')
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    if (!lastPassedExam) {
      return this.academicInfo.currentLevel;
    }

    // Sugerir el siguiente nivel
    const levelOrder: MCERLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIndex = levelOrder.indexOf(lastPassedExam.level);
    
    if (currentIndex < levelOrder.length - 1) {
      return levelOrder[currentIndex + 1] ?? lastPassedExam.level;
    }

    return lastPassedExam.level;
  }

  public getLastExamScore(): number | null {
    if (this.examHistory.length === 0) return null;
    
    const lastExam = this.examHistory
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    
    return lastExam?.overallScore || null;
  }

  public updateStatus(newStatus: CandidateStatus): void {
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  public addExamResult(examResult: ExamHistoryEntry): void {
    this.examHistory.push(examResult);
    this.updatedAt = new Date();
  }

  public updateTechnicalSetup(techSetup: Partial<TechnicalSetup>): void {
    this.technicalSetup = { ...this.technicalSetup, ...techSetup };
    this.updatedAt = new Date();
  }

  // ================================
  // MÉTODOS PRIVADOS
  // ================================

  private getDefaultTechnicalSetup(): TechnicalSetup {
    return {
      hasCamera: false,
      hasMicrophone: false,
      hasStableInternet: false,
      browser: 'Unknown',
      operatingSystem: 'Unknown'
    };
  }

  // ================================
  // VALIDACIONES
  // ================================

  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar información personal
    if (!this.personalInfo.firstName || this.personalInfo.firstName.trim().length < 2) {
      errors.push('Nombre debe tener al menos 2 caracteres');
    }

    if (!this.personalInfo.lastName || this.personalInfo.lastName.trim().length < 2) {
      errors.push('Apellido debe tener al menos 2 caracteres');
    }

    if (!this.personalInfo.email || !this.isValidEmail(this.personalInfo.email)) {
      errors.push('Email debe ser válido');
    }

    // Validar información académica
    const validLevels: MCERLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    if (!validLevels.includes(this.academicInfo.currentLevel)) {
      errors.push('Nivel actual debe ser válido (A1-C2)');
    }

    if (!validLevels.includes(this.academicInfo.targetLevel)) {
      errors.push('Nivel objetivo debe ser válido (A1-C2)');
    }

    // Validar que el nivel objetivo sea mayor o igual al actual
    const currentIndex = validLevels.indexOf(this.academicInfo.currentLevel);
    const targetIndex = validLevels.indexOf(this.academicInfo.targetLevel);
    if (targetIndex < currentIndex) {
      errors.push('Nivel objetivo no puede ser menor al nivel actual');
    }

    // Validar registeredBy
    if (!this.registeredBy || !ObjectId.isValid(this.registeredBy.toString())) {
      errors.push('ID del registrador debe ser válido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ================================
  // SERIALIZACIÓN
  // ================================

  public toJSON(): Candidate {
    const result: Candidate = {
      _id: this._id,
      personalInfo: this.personalInfo,
      academicInfo: this.academicInfo,
      technicalSetup: this.technicalSetup,
      examHistory: this.examHistory,
      status: this.status,
      registeredBy: this.registeredBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    
    if (this.notes !== undefined) {
      result.notes = this.notes;
    }
    
    return result;
  }

  // ================================
  // FACTORY METHODS
  // ================================

  // Factory method para crear desde datos de base de datos
  public static fromDatabase(data: any): CandidateModel {
    return new CandidateModel({
      _id: data._id,
      personalInfo: data.personalInfo,
      academicInfo: data.academicInfo,
      technicalSetup: data.technicalSetup,
      examHistory: data.examHistory || [],
      status: data.status,
      registeredBy: data.registeredBy,
      notes: data.notes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  // Factory method para crear candidato mínimo
  public static createMinimal(
    personalInfo: PersonalInfo,
    academicInfo: AcademicInfo,
    registeredBy: ObjectId
  ): CandidateModel {
    return new CandidateModel({
      personalInfo,
      academicInfo,
      registeredBy,
      status: 'registered',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Método para preparar datos para importación Excel
  public static fromExcelRow(row: any, registeredBy: ObjectId): CandidateModel {
    const personalInfo: PersonalInfo = {
      firstName: row['Nombre'] || row['First Name'] || '',
      lastName: row['Apellido'] || row['Last Name'] || '',
      email: row['Email'] || row['Correo'] || '',
      phone: row['Teléfono'] || row['Phone'] || '',
      dateOfBirth: row['Fecha Nacimiento'] || row['Date of Birth'] ? new Date(row['Fecha Nacimiento'] || row['Date of Birth']) : undefined,
      nationality: row['Nacionalidad'] || row['Nationality'] || '',
      identification: {
        type: 'ci',
        number: row['CI'] || row['ID'] || '',
      },
      address: {
        street: row['Dirección'] || row['Address'] || '',
        city: row['Ciudad'] || row['City'] || '',
        state: row['Estado'] || row['State'] || '',
        country: row['País'] || row['Country'] || 'Bolivia',
        zipCode: row['Código Postal'] || row['Zip Code'] || '',
      },
    };

    const academicInfo: AcademicInfo = {
      currentLevel: (row['Nivel Actual'] || row['Current Level'] || 'A1') as MCERLevel,
      targetLevel: (row['Nivel Objetivo'] || row['Target Level'] || 'A2') as MCERLevel,
      studyPurpose: (row['Propósito'] || row['Purpose'] || 'personal') as any,
      previousExperience: row['Experiencia Previa'] || row['Previous Experience'] || '',
      institution: row['Institución'] || row['Institution'] || '',
    };

    const technicalSetup: TechnicalSetup = {
      hasCamera: row['Tiene Cámara'] === 'Sí' || row['Has Camera'] === 'Yes' || false,
      hasMicrophone: row['Tiene Micrófono'] === 'Sí' || row['Has Microphone'] === 'Yes' || false,
      hasStableInternet: row['Internet Estable'] === 'Sí' || row['Stable Internet'] === 'Yes' || false,
      browser: row['Navegador'] || row['Browser'] || 'Chrome',
      operatingSystem: row['Sistema Operativo'] || row['Operating System'] || 'Windows'
    };

    return new CandidateModel({
      personalInfo,
      academicInfo,
      technicalSetup,
      registeredBy,
      status: 'registered',
      notes: row['Notas'] || row['Notes'] || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ================================
  // MÉTODOS DE COMPARACIÓN
  // ================================

  public equals(other: CandidateModel): boolean {
    return this._id?.toString() === other._id?.toString();
  }

  public isNewer(other: CandidateModel): boolean {
    return this.updatedAt > other.updatedAt;
  }

  // ================================
  // MÉTODOS DE UTILIDAD PARA REPORTES
  // ================================

  public getContactInfo(): string {
    return `${this.personalInfo.email}${this.personalInfo.phone ? ` | ${this.personalInfo.phone}` : ''}`;
  }

  public getProgressSummary(): string {
    const currentLevel = this.academicInfo.currentLevel;
    const targetLevel = this.academicInfo.targetLevel;
    const examsCount = this.examHistory.length;
    
    return `${currentLevel} → ${targetLevel} (${examsCount} examen${examsCount !== 1 ? 'es' : ''})`;
  }

  public getTechnicalReadiness(): boolean {
    return Boolean(
      this.technicalSetup.hasCamera &&
      this.technicalSetup.hasMicrophone &&
      this.technicalSetup.hasStableInternet
    );
  }
}

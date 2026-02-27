import { authSDK } from './sdk-simple-auth';

const API_BASE_URL = import.meta.env.VITE_EXAM_SERVICE_URL || 'http://localhost:3002';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  levels?: string[];
  competencies?: string[];
  examTypes?: string[];
  candidateIds?: string[];
  minScore?: number;
  maxScore?: number;
  status?: string[];
}

export interface CompetencyAnalysis {
  competencyBreakdown: Record<string, {
    averageScore: number;
    studentsEvaluated: number;
    totalQuestions: number;
    difficulty: 'easy' | 'medium' | 'hard';
    improvementTrend: number;
  }>;
  overallStats: {
    totalExams: number;
    completionRate: number;
    averageScore: number;
  };
  comparativeAnalysis: {
    improvementAreas: string[];
    strengthAreas: string[];
  };
  recommendations: string[];
}

export interface StudentStats {
  totalStudents: number;
  evaluatedStudents: number;
  averageScore: number;
  performanceDistribution: {
    excellent: number;
    good: number;
    satisfactory: number;
    needsImprovement: number;
  };
  levelDistribution: Record<string, number>;
  topPerformers: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
    examsCompleted: number;
  }>;
  timeAnalysis: {
    averageTime: number;
    timeEfficiency: number;
  };
  progressionAnalysis: {
    progressionRate: number;
    studentsImproving: number;
  };
}

export interface DashboardSummary {
  overview: {
    totalStudents: number;
    evaluatedStudents: number;
    averageScore: number;
    totalExams: number;
    completionRate: number;
  };
  performanceDistribution: {
    excellent: number;
    good: number;
    satisfactory: number;
    needsImprovement: number;
  };
  competencyRanking: Array<{
    competency: string;
    averageScore: number;
    studentsEvaluated: number;
    difficulty: string;
  }>;
  levelDistribution: Record<string, number>;
  topPerformers: Array<{
    studentId: string;
    studentName: string;
    averageScore: number;
    examsCompleted: number;
  }>;
  improvementAreas: string[];
  recommendations: string[];
  trends: {
    timeEfficiency: number;
    progressionRate: number;
  };
}

export interface TrendsData {
  trends: Array<{
    period: string;
    averageScore: number;
    studentsEvaluated: number;
    totalStudents?: number;
  }>;
  period: 'week' | 'month' | 'quarter';
  competency: string;
}

export interface StudentHistoryData {
  studentId: string;
  studentInfo: {
    name: string;
    email: string;
    registrationDate: string;
  };
  examHistory: Array<{
    examId: string;
    examTitle: string;
    sessionId: string;
    sessionName: string;
    completedAt: string;
    finalScore: number;
    maxScore: number;
    percentage: number;
    level: string;
    status: string;
    timeSpent: number;
    competencyScores: Array<{
      competency: string;
      score: number;
      maxScore: number;
      percentage: number;
    }>;
    feedback: string;
  }>;
  summary: {
    totalExams: number;
    averageScore: number;
    bestScore: number;
    worstScore: number;
    totalTimeSpent: number;
    mostRecentExam: string;
    oldestExam: string;
  };
  competencyProgress: Record<string, {
    currentLevel: string;
    averageScore: number;
    examsCount: number;
    progression: Array<{
      examDate: string;
      score: number;
      level: string;
    }>;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  recommendations: string[];
}

export interface ExportOptions {
  includeInterpretation?: boolean;
  language?: 'spanish' | 'english';
  interpretationLanguage?: 'spanish' | 'english';
  interpretationDepth?: 'brief' | 'detailed';
  interpretationFocus?: 'academic' | 'administrative' | 'strategic';
  companyName?: string;
}

export interface UpcomingSessionsData {
  totalUpcomingSessions: number;
  sessionsThisWeek: number;
  sessionsNextWeek: number;
  upcomingSessions: Array<{
    sessionId: string;
    sessionName: string;
    examTitle: string;
    examId: string;
    startDate: string;
    endDate: string;
    status: string;
    totalSlots: number;
    registeredCandidates: number;
    maxCandidates: number;
    availableSlots: number;
    proctorsAssigned: number;
    timeSlots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      capacity: number;
      enrolled: number;
      available: number;
    }>;
    settings: {
      requireProctor: boolean;
      allowLateEntry: boolean;
      lateEntryMinutes: number;
    };
  }>;
  proctorWorkload: Array<{
    proctorId: string;
    proctorName: string;
    assignedSessions: number;
    upcomingHours: number;
  }>;
  summary: {
    totalCandidatesRegistered: number;
    averageCapacityUtilization: number;
    sessionsNeedingProctors: number;
  };
}

class ReportsService {
  private baseUrl = `${API_BASE_URL}/api/v1/reports`;

  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authSDK.getAccessToken()}`,
    };
  }

  private buildQueryString(filters: ReportFilters | Record<string, unknown>): string {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          (value as unknown[]).forEach(v => params.append(key, String(v)));
        } else {
          params.append(key, String(value));
        }
      }
    });

    return params.toString();
  }

  async getCompetencyAnalysis(filters: ReportFilters = {}): Promise<CompetencyAnalysis> {
    const queryString = this.buildQueryString(filters);
    const url = `${this.baseUrl}/competencies${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error fetching competency analysis: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getStudentStats(filters: ReportFilters = {}): Promise<StudentStats> {
    const queryString = this.buildQueryString(filters);
    const url = `${this.baseUrl}/students${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error fetching student statistics: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getDashboardSummary(filters: ReportFilters = {}): Promise<DashboardSummary> {
    const queryString = this.buildQueryString(filters);
    const url = `${this.baseUrl}/dashboard${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error fetching dashboard summary: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getTrends(
    period: 'week' | 'month' | 'quarter' = 'month',
    competency?: string,
    filters: ReportFilters = {}
  ): Promise<TrendsData> {
    const queryString = this.buildQueryString({
      ...filters,
      period,
      ...(competency && { competency }),
    });

    const url = `${this.baseUrl}/trends${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error fetching trends data: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getUpcomingSessions(filters: ReportFilters = {}): Promise<UpcomingSessionsData> {
    const queryString = this.buildQueryString(filters);
    const url = `${this.baseUrl}/upcoming-sessions${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error fetching upcoming sessions: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getStudentHistory(studentId: string): Promise<StudentHistoryData> {
    const url = `${this.baseUrl}/student/${studentId}/history`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error fetching student history: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async exportReport(
    type: 'competency' | 'students' | 'upcoming-sessions' | 'student-history',
    filters: ReportFilters = {},
    format: 'csv' | 'pdf' = 'csv',
    studentId?: string,
    exportOptions?: ExportOptions
  ): Promise<void> {
    const queryString = this.buildQueryString({
      ...filters,
      format,
      ...(studentId && { studentId }),
      ...(exportOptions?.includeInterpretation && { includeInterpretation: 'true' }),
      ...(exportOptions?.language && { language: exportOptions.language }),
      ...(exportOptions?.interpretationLanguage && { interpretationLanguage: exportOptions.interpretationLanguage }),
      ...(exportOptions?.interpretationDepth && { interpretationDepth: exportOptions.interpretationDepth }),
      ...(exportOptions?.interpretationFocus && { interpretationFocus: exportOptions.interpretationFocus }),
      ...(exportOptions?.companyName && { companyName: exportOptions.companyName }),
    });

    const url = `${this.baseUrl}/export/${type}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error exporting report: ${response.statusText}`);
    }

    // Download the file
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;

    // Determine file extension based on format
    const fileExtension = format === 'pdf' ? 'pdf' : 'csv';
    const fileName = studentId
      ? `${type}_${studentId}_${new Date().toISOString().split('T')[0]}.${fileExtension}`
      : `${type}_report_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
}

export const reportsService = new ReportsService();
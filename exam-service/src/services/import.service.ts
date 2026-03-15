import * as csv from 'csv-parser';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { IQuestion } from '../models/question.model';
import { logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { QuestionService } from './question.service';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  imported: any[];
}

interface QuestionImportRow {
  type: string;
  competency: string;
  level: string;
  difficulty: string | number;
  question: string;
  instructions?: string;
  context?: string;
  options?: string;
  correctAnswer?: string;
  keywords?: string;
  topic?: string;
  subtopic?: string;
  tags?: string;
  points?: string | number;
  estimatedTime?: string | number;
}

export class ImportService {
  private questionService: QuestionService;

  constructor() {
    this.questionService = new QuestionService();
  }

  async importQuestionsFromFile(
    file: Express.Multer.File,
    userId: string
  ): Promise<ImportResult> {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return this.importQuestionsFromExcel(file.buffer, userId);
    } else if (fileExtension === 'csv') {
      return this.importQuestionsFromCSV(file.buffer, userId);
    } else {
      throw new Error('Unsupported file format. Please use Excel (.xlsx, .xls) or CSV files.');
    }
  }

  async importQuestionsFromExcel(
    buffer: Buffer,
    userId: string
  ): Promise<ImportResult> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No se encontraron hojas en el archivo Excel');
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('No se encontró la hoja en el archivo Excel');
      }
      const data = XLSX.utils.sheet_to_json<QuestionImportRow>(worksheet);

      return this.processQuestionData(data, userId);
    } catch (error) {
      logger.error('Error importing questions from Excel:', error);
      throw error;
    }
  }

  async importQuestionsFromCSV(
    buffer: Buffer,
    userId: string
  ): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const results: QuestionImportRow[] = [];
      const stream = Readable.from(buffer.toString());

      stream
        .pipe(csv.default({ separator: ',' }))
        .on('data', (data: any) => results.push(data))
        .on('end', async () => {
          try {
            const importResult = await this.processQuestionData(results as QuestionImportRow[], userId);
            resolve(importResult);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private async processQuestionData(
    data: QuestionImportRow[],
    userId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      imported: []
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel/CSV rows start at 1, plus header row

      try {
        const question = this.mapRowToQuestion(row as QuestionImportRow, userId);
        const validationError = this.validateQuestion(question);

        if (validationError) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            error: validationError,
            data: row
          });
          continue;
        }

        const createdQuestion = await this.questionService.create(question);
        result.success++;
        result.imported.push(createdQuestion);
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
          data: row
        });
      }
    }

    logger.info(`Import completed: ${result.success} success, ${result.failed} failed`);
    return result;
  }

  private mapRowToQuestion(row: QuestionImportRow, userId: string): Partial<IQuestion> {
    const question: Partial<IQuestion> = {
      type: this.normalizeQuestionType(row.type) as any,
      competency: this.normalizeCompetency(row.competency) as any,
      level: this.normalizeLevel(row.level),
      difficulty: this.parseDifficulty(row.difficulty),
      content: {    
        question: row.question?.trim(),
        instructions: row.instructions?.trim(),
        context: row.context?.trim(),
        options: this.parseOptions(row.options),
        correctAnswer: row.correctAnswer?.trim(),
        keywords: this.parseKeywords(row.keywords)
      },
      metadata: {
        topic: row.topic?.trim(),
        subtopic: row.subtopic?.trim(),
        tags: this.parseTags(row.tags),
        points: this.parseNumber(row.points) || 1,
        estimatedTime: this.parseNumber(row.estimatedTime) || 60
      },
      createdBy: userId as any,
      isActive: true
    };

    return question;
  }

  private validateQuestion(question: Partial<IQuestion>): string | null {
    if (!question.type) return 'Question type is required';
    if (!Validator.isValidQuestionType(question.type)) return 'Invalid question type';

    if (!question.competency) return 'Competency is required';
    if (!Validator.isValidCompetency(question.competency)) return 'Invalid competency';

    if (!question.level) return 'Level is required';
    if (!Validator.isValidLevel(question.level)) return 'Invalid level';

    if (!question.difficulty) return 'Difficulty is required';
    if (!Validator.isValidDifficulty(question.difficulty)) return 'Invalid difficulty (must be 1-5)';

    if (!question.content?.question) return 'Question text is required';

    // Validate based on question type
    if (question.type === 'multiple_choice') {
      if (!question.content.options || question.content.options.length < 2) {
        return 'Multiple choice questions must have at least 2 options';
      }
      if (!question.content.options.some(opt => opt.isCorrect)) {
        return 'Multiple choice questions must have at least one correct option';
      }
    }

    if (question.type === 'true_false') {
      if (!question.content.correctAnswer) {
        return 'True/False questions must have a correct answer';
      }
      const correctAnswerValue = Array.isArray(question.content.correctAnswer)
        ? question.content.correctAnswer[0]
        : question.content.correctAnswer;
      if (!['true', 'false'].includes(String(correctAnswerValue).toLowerCase())) {
        return 'True/False answer must be "true" or "false"';
      }
    }

    return null;
  }

  private normalizeQuestionType(type: string): string {
    const typeMap: Record<string, string> = {
      'multiple choice': 'multiple_choice',
      'multiple-choice': 'multiple_choice',
      'mc': 'multiple_choice',
      'true false': 'true_false',
      'true-false': 'true_false',
      'tf': 'true_false',
      'open text': 'open_text',
      'open-text': 'open_text',
      'essay': 'essay',
      'audio': 'audio_response',
      'audio response': 'audio_response',
      'file': 'file_upload',
      'file upload': 'file_upload'
    };

    const normalized = type?.toLowerCase().trim();
    return typeMap[normalized] || normalized;
  }

  private normalizeCompetency(competency: string): string {
    const competencyMap: Record<string, string> = {
      'r': 'reading',
      'w': 'writing',
      'l': 'listening',
      's': 'speaking'
    };

    const normalized = competency?.toLowerCase().trim();
    return competencyMap[normalized] || normalized;
  }

  private normalizeLevel(level: string): string {
    return level?.toUpperCase().trim();
  }

  private parseDifficulty(difficulty: string | number): number {
    if (typeof difficulty === 'number') return difficulty;
    const parsed = parseInt(difficulty, 10);
    return isNaN(parsed) ? 3 : parsed;
  }

  private parseOptions(optionsStr?: string): any[] | undefined {
    if (!optionsStr) return undefined;

    try {
      // Try to parse as JSON first
      if (optionsStr.startsWith('[')) {
        return JSON.parse(optionsStr);
      }

      // Parse pipe-separated format: "A|Option A|false;B|Option B|true;..."
      const options = optionsStr.split(';').map(opt => {
        const parts = opt.split('|');
        if (parts.length >= 2) {
          return {
            id: parts[0]?.trim() || '',
            text: parts[1]?.trim() || '',
            isCorrect: parts[2]?.toLowerCase().trim() === 'true'
          };
        }
        return null;
      }).filter(Boolean);

      return options.length > 0 ? options : undefined;
    } catch (error) {
      logger.error('Error parsing options:', error);
      return undefined;
    }
  }

  private parseKeywords(keywordsStr?: string): string[] | undefined {
    if (!keywordsStr) return undefined;
    return keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
  }

  private parseTags(tagsStr?: string): string[] | undefined {
    if (!tagsStr) return undefined;
    return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  }

  private parseNumber(value?: string | number): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  // Export templates for users

  generateExcelTemplate(): Buffer {
    const templateData = [
      {
        type: 'multiple_choice',
        competency: 'reading',
        level: 'B1',
        difficulty: 3,
        question: 'What is the main idea of the passage?',
        instructions: 'Read the passage and select the best answer',
        context: 'The passage text goes here...',
        options: 'A|First option|false;B|Second option|true;C|Third option|false',
        correctAnswer: 'B',
        keywords: 'main idea,passage,reading comprehension',
        topic: 'Reading Comprehension',
        subtopic: 'Main Idea',
        tags: 'reading,B1,main-idea',
        points: 2,
        estimatedTime: 120
      },
      {
        type: 'true_false',
        competency: 'listening',
        level: 'A2',
        difficulty: 2,
        question: 'The speaker mentions three different types of transportation.',
        instructions: 'Listen to the audio and answer true or false',
        context: '',
        options: '',
        correctAnswer: 'true',
        keywords: 'transportation,listening',
        topic: 'Listening Comprehension',
        subtopic: 'Detail Recognition',
        tags: 'listening,A2,details',
        points: 1,
        estimatedTime: 60
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    // Add column widths
    worksheet['!cols'] = [
      { width: 15 }, // type
      { width: 12 }, // competency
      { width: 8 },  // level
      { width: 10 }, // difficulty
      { width: 50 }, // question
      { width: 30 }, // instructions
      { width: 40 }, // context
      { width: 40 }, // options
      { width: 15 }, // correctAnswer
      { width: 30 }, // keywords
      { width: 20 }, // topic
      { width: 20 }, // subtopic
      { width: 30 }, // tags
      { width: 8 },  // points
      { width: 12 }  // estimatedTime
    ];

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  generateCSVTemplate(): string {
    const headers = [
      'type',
      'competency',
      'level',
      'difficulty',
      'question',
      'instructions',
      'context',
      'options',
      'correctAnswer',
      'keywords',
      'topic',
      'subtopic',
      'tags',
      'points',
      'estimatedTime'
    ];

    const rows = [
      headers.join(','),
      'multiple_choice,reading,B1,3,"What is the main idea of the passage?","Read the passage and select the best answer","The passage text goes here...","A|First option|false;B|Second option|true;C|Third option|false",B,"main idea,passage,reading comprehension","Reading Comprehension","Main Idea","reading,B1,main-idea",2,120',
      'true_false,listening,A2,2,"The speaker mentions three different types of transportation.","Listen to the audio and answer true or false","","",true,"transportation,listening","Listening Comprehension","Detail Recognition","listening,A2,details",1,60'
    ];

    return rows.join('\n');
  }
}

export const importService = new ImportService();
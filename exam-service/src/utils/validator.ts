import { Types } from 'mongoose';
import { CONSTANTS } from './constants';

export class Validator {
  static isValidObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidLevel(level: string): boolean {
    return Object.values(CONSTANTS.LEVELS).includes(level);
  }

  static isValidCompetency(competency: string): boolean {
    return Object.values(CONSTANTS.COMPETENCIES).includes(competency);
  }

  static isValidExamType(type: string): boolean {
    return Object.values(CONSTANTS.EXAM_TYPES).includes(type);
  }

  static isValidQuestionType(type: string): boolean {
    return Object.values(CONSTANTS.QUESTION_TYPES).includes(type);
  }

  static isValidScoringType(type: string): boolean {
    return Object.values(CONSTANTS.SCORING_TYPES).includes(type);
  }

  static isValidSessionStatus(status: string): boolean {
    return Object.values(CONSTANTS.SESSION_STATUS).includes(status);
  }

  static isValidDifficulty(difficulty: number): boolean {
    return difficulty >= 1 && difficulty <= 5;
  }

  static isValidPercentage(percentage: number): boolean {
    return percentage >= 0 && percentage <= 100;
  }

  static isValidDuration(duration: number): boolean {
    return duration > 0 && duration <= 480; // Max 8 hours
  }

  static sanitizeString(str: string): string {
    return str.trim().replace(/[<>]/g, '');
  }

  static validateExamStructure(structure: any): boolean {
    if (!structure || !structure.sections || !Array.isArray(structure.sections)) {
      return false;
    }

    let totalWeight = 0;
    for (const section of structure.sections) {
      if (!section.name || !section.competency || !section.duration || !section.questionCount || !section.weight) {
        return false;
      }
      if (!this.isValidCompetency(section.competency)) {
        return false;
      }
      totalWeight += section.weight;
    }

    // Total weight should be 100%
    return Math.abs(totalWeight - 100) < 0.01;
  }

  static validateQuestionOptions(options: any[]): boolean {
    if (!Array.isArray(options) || options.length < 2) {
      return false;
    }

    let hasCorrect = false;
    for (const option of options) {
      if (!option.id || !option.text) {
        return false;
      }
      if (option.isCorrect) {
        hasCorrect = true;
      }
    }

    return hasCorrect;
  }

  static validateRubricCriteria(criteria: any[]): boolean {
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return false;
    }

    let totalWeight = 0;
    for (const criterion of criteria) {
      if (!criterion.name || !criterion.description || !criterion.weight || !criterion.levels) {
        return false;
      }
      if (!Array.isArray(criterion.levels) || criterion.levels.length === 0) {
        return false;
      }
      totalWeight += criterion.weight;
    }

    // Total weight should be 100%
    return Math.abs(totalWeight - 100) < 0.01;
  }
}
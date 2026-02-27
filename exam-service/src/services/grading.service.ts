import { Response } from '../models/response.model';
import { Question } from '../models/question.model';
import { Rubric } from '../models/rubric.model';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../utils/constants';

export class GradingService {
  async gradeMultipleChoice(questionId: string, answer: string[]): Promise<{ isCorrect: boolean; score: number }> {
    try {
      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');

      const correctOptions = question.content.options
        ?.filter(opt => opt.isCorrect)
        .map(opt => opt.id) || [];

      const isCorrect = JSON.stringify(answer.sort()) === JSON.stringify(correctOptions.sort());
      const score = isCorrect ? (question.metadata.points || 1) : 0;

      return { isCorrect, score };
    } catch (error) {
      logger.error('Error grading multiple choice:', error);
      throw error;
    }
  }

  async gradeTrueFalse(questionId: string, answer: string): Promise<{ isCorrect: boolean; score: number }> {
    try {
      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');

      const isCorrect = answer === question.content.correctAnswer;
      const score = isCorrect ? (question.metadata.points || 1) : 0;

      return { isCorrect, score };
    } catch (error) {
      logger.error('Error grading true/false:', error);
      throw error;
    }
  }

  async gradeOpenText(questionId: string, answer: string): Promise<{ score: number; feedback: string }> {
    try {
      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');

      // Basic keyword matching for now
      const keywords = question.content.keywords || [];
      let matchedKeywords = 0;

      const answerLower = answer.toLowerCase();
      for (const keyword of keywords) {
        if (answerLower.includes(keyword.toLowerCase())) {
          matchedKeywords++;
        }
      }

      const maxScore = question.metadata.points || 10;
      const score = keywords.length > 0 
        ? (matchedKeywords / keywords.length) * maxScore 
        : 0;

      const feedback = `Matched ${matchedKeywords} out of ${keywords.length} key concepts.`;

      return { score, feedback };
    } catch (error) {
      logger.error('Error grading open text:', error);
      throw error;
    }
  }

  async gradeWithRubric(rubricId: string, responses: any[]): Promise<{ score: number; feedback: any[] }> {
    try {
      const rubric = await Rubric.findById(rubricId);
      if (!rubric) throw new Error('Rubric not found');

      let totalScore = 0;
      const feedback: any[] = [];

      for (const criterion of rubric.criteria) {
        const response = responses.find(r => r.criterionName === criterion.name);
        if (response) {
          const criterionScore = response.score;
          const weightedScore = (criterionScore / rubric.maxScore) * criterion.weight;
          totalScore += weightedScore;

          feedback.push({
            criterion: criterion.name,
            score: criterionScore,
            weightedScore,
            feedback: response.feedback
          });
        }
      }

      return { score: totalScore, feedback };
    } catch (error) {
      logger.error('Error grading with rubric:', error);
      throw error;
    }
  }

  async calculateCompetencyScore(responses: any[]): Promise<{ [key: string]: number }> {
    try {
      const competencyScores: { [key: string]: { total: number; count: number } } = {};

      for (const response of responses) {
        if (!competencyScores[response.competency]) {
          competencyScores[response.competency] = { total: 0, count: 0 };
        }

        const scorePercentage = (response.evaluation.score / response.evaluation.maxScore) * 100;
        const competencyScore = competencyScores[response.competency]!;
        competencyScore.total += scorePercentage;
        competencyScore.count++;
      }

      const averageScores: { [key: string]: number } = {};
      for (const competency in competencyScores) {
        const competencyScore = competencyScores[competency]!;
        averageScores[competency] = 
          competencyScore.total / competencyScore.count;
      }

      return averageScores;
    } catch (error) {
      logger.error('Error calculating competency scores:', error);
      throw error;
    }
  }

  async determineLevel(scores: { [key: string]: number }): Promise<string> {
    try {
      const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

      if (overallScore >= 90) return 'C2';
      if (overallScore >= 80) return 'C1';
      if (overallScore >= 70) return 'B2';
      if (overallScore >= 60) return 'B1';
      if (overallScore >= 50) return 'A2';
      return 'A1';
    } catch (error) {
      logger.error('Error determining level:', error);
      throw error;
    }
  }

  async generateFeedback(scores: { [key: string]: number }, targetLevel: string): Promise<string> {
    const feedback: string[] = [];
    
    feedback.push(`Overall Performance Summary:`);
    
    for (const [competency, score] of Object.entries(scores)) {
      let level = '';
      if (score >= 90) level = 'Excellent';
      else if (score >= 75) level = 'Good';
      else if (score >= 60) level = 'Satisfactory';
      else if (score >= 40) level = 'Needs Improvement';
      else level = 'Poor';
      
      feedback.push(`- ${competency}: ${score.toFixed(1)}% (${level})`);
    }

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
    const achievedLevel = await this.determineLevel(scores);
    
    feedback.push(`\nTarget Level: ${targetLevel}`);
    feedback.push(`Achieved Level: ${achievedLevel}`);
    feedback.push(`Overall Score: ${overallScore.toFixed(1)}%`);

    if (achievedLevel >= targetLevel) {
      feedback.push(`\nCongratulations! You have achieved the target level.`);
    } else {
      feedback.push(`\nYou need more practice to reach the target level.`);
    }

    return feedback.join('\n');
  }
}
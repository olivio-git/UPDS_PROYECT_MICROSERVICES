import { Rubric, IRubric } from '../models/rubric.model';
import { KafkaService } from './kafka.service';
import { logger } from '../utils/logger';
import { cache } from '../config/redis';
import { CONSTANTS } from '../utils/constants';

export class RubricService {
  private kafkaService: KafkaService;

  constructor() {
    this.kafkaService = new KafkaService();
  }

  async create(rubricData: Partial<IRubric>): Promise<IRubric> {
    try {
      const rubric = new Rubric(rubricData);
      await rubric.save();

      await this.kafkaService.publishEvent('rubric.created', {
        rubricId: rubric._id,
        name: rubric.name,
        competency: rubric.competency,
        level: rubric.level,
        createdBy: rubric.createdBy
      });

      logger.info(`Rubric created: ${rubric._id}`);
      return rubric;
    } catch (error) {
      logger.error('Error creating rubric:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<IRubric | null> {
    try {
      const cacheKey = `rubric:${id}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Remove User populate
      const rubric = await Rubric.findById(id);

      if (rubric) {
        await cache.set(cacheKey, rubric, CONSTANTS.CACHE_TTL.LONG);
      }

      return rubric;
    } catch (error) {
      logger.error(`Error finding rubric ${id}:`, error);
      throw error;
    }
  }

  async findAll(filters: any = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const query: any = {};

      if (filters.competency) query.competency = filters.competency;
      if (filters.level) query.level = filters.level;
      if (filters.scoringType) query.scoringType = filters.scoringType;
      if (filters.isActive !== undefined) query.isActive = filters.isActive;
      if (filters.search) {
        query.name = { $regex: filters.search, $options: 'i' };
      }

      // Remove User populate
      const [rubrics, total] = await Promise.all([
        Rubric.find(query)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        Rubric.countDocuments(query)
      ]);

      return {
        rubrics,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error finding rubrics:', error);
      throw error;
    }
  }

  async update(id: string, updateData: Partial<IRubric>): Promise<IRubric | null> {
    try {
      const rubric = await Rubric.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (rubric) {
        await cache.del(`rubric:${id}`);
        
        await this.kafkaService.publishEvent('rubric.updated', {
          rubricId: rubric._id,
          changes: Object.keys(updateData)
        });
      }

      return rubric;
    } catch (error) {
      logger.error(`Error updating rubric ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const rubric = await Rubric.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (rubric) {
        await cache.del(`rubric:${id}`);
        
        await this.kafkaService.publishEvent('rubric.deleted', {
          rubricId: rubric._id
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting rubric ${id}:`, error);
      throw error;
    }
  }

  async findByCompetencyAndLevel(competency: string, level: string): Promise<IRubric[]> {
    try {
      return await Rubric.find({
        competency,
        level,
        isActive: true
      });
    } catch (error) {
      logger.error('Error finding rubrics by competency and level:', error);
      throw error;
    }
  }

  async clone(id: string, newName: string, userId: string): Promise<IRubric | null> {
    try {
      const originalRubric = await this.findById(id);
      if (!originalRubric) {
        return null;
      }

      const clonedData = {
        name: newName,
        competency: originalRubric.competency,
        level: originalRubric.level,
        criteria: originalRubric.criteria,
        scoringType: originalRubric.scoringType,
        maxScore: originalRubric.maxScore,
        isActive: true,
        createdBy: userId
      };

      const clonedRubric = new Rubric(clonedData);
      await clonedRubric.save();

      await this.kafkaService.publishEvent('rubric.cloned', {
        originalRubricId: originalRubric._id,
        clonedRubricId: clonedRubric._id,
        newName,
        clonedBy: userId
      });

      logger.info(`Rubric cloned: ${originalRubric._id} -> ${clonedRubric._id}`);
      return clonedRubric;
    } catch (error) {
      logger.error(`Error cloning rubric ${id}:`, error);
      throw error;
    }
  }

  async calculateScore(rubricId: string, responses: any[]): Promise<number> {
    try {
      const rubric = await this.findById(rubricId);
      if (!rubric) throw new Error('Rubric not found');

      let totalScore = 0;

      for (const criterion of rubric.criteria) {
        const response = responses.find(r => r.criterionName === criterion.name);
        if (response) {
          const weightedScore = (response.score / rubric.maxScore) * criterion.weight;
          totalScore += weightedScore;
        }
      }

      return totalScore;
    } catch (error) {
      logger.error(`Error calculating score with rubric ${rubricId}:`, error);
      throw error;
    }
  }
}
import { cache } from '../config/redis';
import { ILevel, Level } from '../models/level.model';
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';

export class LevelService {
  async findAll(filters: any = {}) {
    try {
      const query: any = {};
      
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      // Remove User populate
      const lvl = await Level.findOne();
      const levels = await Level.find(query)
        .sort({ code: 1 });

      return levels;
    } catch (error) {
      logger.error('Error finding levels:', error);
      throw error;
    }
  }

  async findByCode(code: string): Promise<ILevel | null> {
    try {
      const cacheKey = `level:${code}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Remove User populate
      const level = await Level.findOne({ code });

      if (level) {
        await cache.set(cacheKey, level, CONSTANTS.CACHE_TTL.VERY_LONG);
      }

      return level;
    } catch (error) {
      logger.error(`Error finding level ${code}:`, error);
      throw error;
    }
  }

  async update(code: string, updateData: Partial<ILevel>): Promise<ILevel | null> {
    try {
      const level = await Level.findOneAndUpdate(
        { code },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (level) {
        await cache.del(`level:${code}`);
      }

      return level;
    } catch (error) {
      logger.error(`Error updating level ${code}:`, error);
      throw error;
    }
  }

  async create(levelData: Partial<ILevel>): Promise<ILevel> {
    try {
      const level = new Level(levelData);
      const savedLevel = await level.save();

      logger.info(`Level ${savedLevel.code} created successfully`);
      return savedLevel;
    } catch (error) {
      logger.error('Error creating level:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<ILevel | null> {
    try {
      const level = await Level.findById(id);
      return level;
    } catch (error) {
      logger.error(`Error finding level by id ${id}:`, error);
      throw error;
    }
  }

  async updateById(id: string, updateData: Partial<ILevel>): Promise<ILevel | null> {
    try {
      const level = await Level.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (level) {
        await cache.del(`level:${level.code}`);
        logger.info(`Level ${level.code} updated successfully`);
      }

      return level;
    } catch (error) {
      logger.error(`Error updating level by id ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const level = await Level.findById(id);
      if (!level) {
        return false;
      }

      await Level.findByIdAndDelete(id);
      await cache.del(`level:${level.code}`);

      logger.info(`Level ${level.code} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Error deleting level by id ${id}:`, error);
      throw error;
    }
  }

  async initializeLevels(userId: string): Promise<void> {
    try {
      const existingLevels = await Level.countDocuments();
      if (existingLevels > 0) {
        logger.info('Levels already initialized');
        return;
      }

      const levels = [
        {
          code: 'A1',
          name: 'Beginner',
          description: 'Can understand and use familiar everyday expressions and very basic phrases.',
          competencyRequirements: {
            reading: {
              minScore: 60,
              description: 'Can understand familiar names, words and very simple sentences.',
              canDoStatements: [
                'Can understand very short, simple texts.',
                'Can find specific, predictable information in simple everyday material.',
                'Can understand short, simple personal letters.'
              ]
            },
            writing: {
              minScore: 60,
              description: 'Can write a short, simple postcard.',
              canDoStatements: [
                'Can write simple isolated phrases and sentences.',
                'Can write a short simple postcard.',
                'Can fill in forms with personal details.'
              ]
            },
            listening: {
              minScore: 60,
              description: 'Can recognize familiar words and very basic phrases.',
              canDoStatements: [
                'Can understand familiar words and very basic phrases.',
                'Can catch the main point in short, clear, simple messages.',
                'Can understand simple directions.'
              ]
            },
            speaking: {
              minScore: 60,
              description: 'Can interact in a simple way.',
              canDoStatements: [
                'Can use simple phrases and sentences.',
                'Can ask and answer simple questions.',
                'Can describe where they live and people they know.'
              ]
            },
            grammar: {
              minScore: 60,
              description: 'Can use basic grammatical structures.',
              canDoStatements: [
                'Can use present tense correctly.',
                'Can form simple questions.',
                'Can use basic vocabulary appropriately.'
              ]
            },
            vocabulary: {
              minScore: 60,
              description: 'Can use basic vocabulary for everyday situations.',
              canDoStatements: [
                'Can use basic vocabulary for personal information.',
                'Can name common objects and actions.',
                'Can express basic needs and wants.'
              ]
            }
          },
          overallMinScore: 60,
          isActive: true,
          createdBy: userId
        },
        {
          code: 'A2',
          name: 'Elementary',
          description: 'Can understand sentences and frequently used expressions related to areas of most immediate relevance.',
          competencyRequirements: {
            reading: {
              minScore: 65,
              description: 'Can read very short, simple texts.',
              canDoStatements: [
                'Can find specific information in simple texts.',
                'Can understand short simple personal letters.',
                'Can understand the main points in short newspaper articles.'
              ]
            },
            writing: {
              minScore: 65,
              description: 'Can write short, simple notes and messages.',
              canDoStatements: [
                'Can write short, simple notes and messages.',
                'Can write a very simple personal letter.',
                'Can write simple phrases and sentences about themselves.'
              ]
            },
            listening: {
              minScore: 65,
              description: 'Can understand phrases and highest frequency vocabulary.',
              canDoStatements: [
                'Can understand phrases and high frequency vocabulary.',
                'Can catch the main point in short messages.',
                'Can understand the essentials of clear standard speech.'
              ]
            },
            speaking: {
              minScore: 65,
              description: 'Can communicate in simple and routine tasks.',
              canDoStatements: [
                'Can handle very short social exchanges.',
                'Can use a series of phrases to describe things.',
                'Can communicate in simple routine tasks.'
              ]
            },
            grammar: {
              minScore: 65,
              description: 'Can use simple grammatical structures accurately.',
              canDoStatements: [
                'Can use past and future tenses in simple contexts.',
                'Can form more complex questions.',
                'Can use modal verbs for requests and suggestions.'
              ]
            },
            vocabulary: {
              minScore: 65,
              description: 'Can use expanded vocabulary for familiar topics.',
              canDoStatements: [
                'Can use vocabulary related to work and leisure.',
                'Can describe experiences and plans.',
                'Can express opinions on familiar topics.'
              ]
            }
          },
          overallMinScore: 65,
          isActive: true,
          createdBy: userId
        }
      ];

      for (const levelData of levels) {
        const level = new Level(levelData);
        await level.save();
      }

      logger.info('Levels initialized successfully');
    } catch (error) {
      logger.error('Error initializing levels:', error);
      throw error;
    }
  }
}
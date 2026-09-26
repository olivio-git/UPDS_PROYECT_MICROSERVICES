import { AppError } from '../middleware/errorHandler.middleware';
import {
  getSectionWeightsTotal,
  INVALID_SECTION_WEIGHTS,
  isSectionWeightSumValid,
  sectionWeightsSumMessage,
  type WeightedSection,
} from './sectionWeights';

/**
 * Throws a 400 AppError (code INVALID_SECTION_WEIGHTS) when the sections'
 * weights don't sum to 100. `buildMessage` lets callers such as clone explain
 * what the teacher has to do.
 */
export function assertSectionWeightsSumTo100(
  sections: ReadonlyArray<WeightedSection> | null | undefined,
  buildMessage: (total: number) => string = sectionWeightsSumMessage
): void {
  const total = getSectionWeightsTotal(sections);
  if (total === null || isSectionWeightSumValid(total)) return;
  throw new AppError(buildMessage(total), 400, INVALID_SECTION_WEIGHTS);
}

import type { Competency, MCERLevel, ScoringType } from "../constants/academic.constants";

export interface RubricCriterion {
  name: string;
  description: string;
  weight: number; // percentage
  levels: RubricLevel[];
}

export interface RubricLevel {
  score: number;
  description: string;
  examples?: string[];
}

export interface Rubric {
  _id?: string;
  name: string;
  competency: Competency;
  level: MCERLevel;
  criteria: RubricCriterion[];
  scoringType: ScoringType;
  maxScore: number;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RubricFormData {
  name: string;
  competency: Competency;
  level: MCERLevel;
  criteria: RubricCriterion[];
  scoringType: ScoringType;
  maxScore: number;
  isActive: boolean;
}

export interface RubricFilters {
  competency?: Competency;
  level?: MCERLevel;
  scoringType?: ScoringType;
  isActive?: boolean;
  search?: string;
}

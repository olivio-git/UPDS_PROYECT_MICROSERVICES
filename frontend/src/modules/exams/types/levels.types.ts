import type { Competency, MCERLevel } from "../constants/academic.constants";

export interface MCERLevelDefinition {
  _id?: string;
  code: MCERLevel;
  name: string;
  description: string;
  competencyRequirements: {
    [K in Competency]: {
      minScore: number;
      description: string;
      canDoStatements: string[];
    };
  };
  overallMinScore: number;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompetencyRequirement {
  minScore: number;
  description: string;
  canDoStatements: string[];
}

export interface LevelFormData {
  code: MCERLevel;
  name: string;
  description: string;
  competencyRequirements: Record<Competency, CompetencyRequirement>;
  overallMinScore: number;
  isActive: boolean;
}

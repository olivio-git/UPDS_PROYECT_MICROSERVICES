import {
  BookA,
  BookOpen,
  Headphones,
  Mic,
  PenTool,
  SpellCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  COMPETENCIES,
  COMPETENCY_LABELS,
  DEFAULT_COMPETENCY_WEIGHT,
  type Competency,
} from '../../constants/academic.constants';
import { distributeByShares } from '../../utils/weights';

export interface SectionDraft {
  id: string;
  name: string;
  competency: string;
  instructions: string;
  questionCount: number;
  questionTypes: string[];
  weight: number;
  duration?: number;
  order: number;
}

export const COMPETENCY_ICON: Record<Competency, LucideIcon> = {
  reading: BookOpen,
  writing: PenTool,
  listening: Headphones,
  speaking: Mic,
  grammar: SpellCheck,
  vocabulary: BookA,
};

export const DEFAULT_INSTRUCTIONS: Record<Competency, string> = {
  reading:
    'Lee atentamente cada texto antes de responder las preguntas. Puedes releer los pasajes cuantas veces necesites. Responde únicamente en base a la información proporcionada en los textos.',
  writing:
    'Responde cada pregunta de forma clara y organizada. Cuida la gramática, el vocabulario y la coherencia en tu escritura. Lee bien las instrucciones de cada ejercicio antes de comenzar.',
  listening:
    'Escucha con atención cada audio antes de responder. Usa auriculares para una mejor experiencia. Asegúrate de tener el volumen adecuado antes de iniciar.',
  speaking:
    'Habla con claridad y a un ritmo natural al responder. Asegúrate de que tu micrófono esté funcionando antes de comenzar. Responde de forma completa y fluida dentro del tiempo indicado.',
  grammar:
    'Elige o completa la forma gramatical correcta en cada oración. Fíjate en el tiempo verbal, la concordancia y el orden de las palabras.',
  vocabulary:
    'Elige la palabra que mejor completa o corresponde a cada enunciado. Presta atención al contexto de la oración.',
};

/** Typical size of a section per competency (questions, minutes). */
const DEFAULT_SIZE: Record<Competency, { questions: number; minutes: number }> = {
  reading: { questions: 10, minutes: 25 },
  writing: { questions: 2, minutes: 30 },
  listening: { questions: 8, minutes: 20 },
  speaking: { questions: 2, minutes: 10 },
  grammar: { questions: 10, minutes: 12 },
  vocabulary: { questions: 10, minutes: 12 },
};

export const isCompetency = (c: string): c is Competency => (COMPETENCIES as readonly string[]).includes(c);

export function newSection(competency: Competency, order: number, weight = 0): SectionDraft {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: COMPETENCY_LABELS[competency],
    competency,
    instructions: DEFAULT_INSTRUCTIONS[competency],
    questionCount: DEFAULT_SIZE[competency].questions,
    questionTypes: ['multiple_choice'],
    weight,
    duration: DEFAULT_SIZE[competency].minutes,
    order,
  };
}

/** Weights following the MCER defaults (skills 20, grammar/vocabulary 10), scaled to 100. */
export const mcerWeights = (sections: ReadonlyArray<Pick<SectionDraft, 'competency'>>) =>
  distributeByShares(sections.map((s) => (isCompetency(s.competency) ? DEFAULT_COMPETENCY_WEIGHT[s.competency] : 10)));

export const TEMPLATES: Array<{ id: string; label: string; detail: string; competencies: Competency[] }> = [
  { id: 'mcer', label: 'MCER completo', detail: '6 competencias · 20/20/20/20/10/10', competencies: ['listening', 'reading', 'grammar', 'vocabulary', 'writing', 'speaking'] },
  { id: 'skills', label: 'Cuatro habilidades', detail: 'Lectura, escritura, escucha y habla · 25% c/u', competencies: ['listening', 'reading', 'writing', 'speaking'] },
  { id: 'use', label: 'Uso del idioma', detail: 'Gramática y vocabulario · 50% c/u', competencies: ['grammar', 'vocabulary'] },
];

export function sectionsFromTemplate(templateId: string): SectionDraft[] {
  const t = TEMPLATES.find((x) => x.id === templateId)!;
  const drafts = t.competencies.map((c, i) => newSection(c, i + 1));
  return mcerWeights(drafts).map((w, i) => ({ ...drafts[i]!, weight: w }));
}


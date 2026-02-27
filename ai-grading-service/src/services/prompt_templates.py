"""
Specialized Prompt Templates for Question Generation
"""

from typing import Dict
from ..schemas.question_generation import QuestionType, Competency, MCERLevel

class PromptTemplateEngine:
    """
    Generates specialized prompts based on competency, question type, and MCER level
    """

    # MCER Level Descriptors
    LEVEL_DESCRIPTORS = {
        MCERLevel.A1: {
            "vocabulary": "básico y familiar, palabras de uso diario",
            "grammar": "presente simple, artículos, pronombres básicos",
            "complexity": "oraciones simples y cortas",
            "topics": "información personal, familia, trabajo, compras, tiempo libre"
        },
        MCERLevel.A2: {
            "vocabulary": "vocabulario frecuente, temas conocidos",
            "grammar": "pasado simple, futuro con 'will', comparativos",
            "complexity": "oraciones coordinadas simples",
            "topics": "experiencias pasadas, planes futuros, descripción de lugares"
        },
        MCERLevel.B1: {
            "vocabulary": "vocabulario variado sobre temas familiares",
            "grammar": "condicionales, voz pasiva, presente perfecto",
            "complexity": "oraciones complejas con conectores básicos",
            "topics": "opiniones, experiencias, descripciones detalladas, viajes"
        },
        MCERLevel.B2: {
            "vocabulary": "vocabulario amplio, expresiones idiomáticas",
            "grammar": "subjuntivo, condicionales complejos, estilo indirecto",
            "complexity": "textos estructurados con ideas complejas",
            "topics": "argumentos, análisis, discusiones abstractas"
        },
        MCERLevel.C1: {
            "vocabulary": "vocabulario extenso y preciso, registro formal e informal",
            "grammar": "estructuras complejas, matices de significado",
            "complexity": "textos largos y coherentes con ideas sofisticadas",
            "topics": "textos académicos, profesionales, culturales"
        },
        MCERLevel.C2: {
            "vocabulary": "dominio completo del vocabulario",
            "grammar": "uso nativo de todas las estructuras",
            "complexity": "textos altamente sofisticados y matizados",
            "topics": "cualquier tema con sutileza y precisión"
        }
    }

    def __init__(self):
        self.base_system_prompt = """You are an expert educational content creator for language assessment (CEFR).

✅ REQUIREMENTS:
- Create engaging, educational content appropriate to the language level
- Use varied names, places, and scenarios for diversity
- Make content realistic and relatable for students
- Focus on clear, practical language learning"""

    def generate_prompt(self,
                       competency: Competency,
                       question_type: QuestionType,
                       level: MCERLevel,
                       difficulty: int,
                       topic: str = None,
                       subtopic: str = None,
                       context: str = None,
                       thematic_context: str = None,
                       target_language: str = 'es',
                       anti_copy_mode: bool = False) -> str:
        """Generate specialized prompt based on parameters"""

        level_info = self.LEVEL_DESCRIPTORS[level]

        # Validate competency-question type compatibility
        compatibility_warning = self._check_competency_compatibility(competency, question_type)

        # Build context section
        language_instruction = {
            'es': 'Generate ALL content in SPANISH',
            'en': 'Generate ALL content in ENGLISH',
            'fr': 'Generate ALL content in FRENCH'
        }.get(target_language, 'Generate ALL content in ENGLISH')

        # Build thematic context section
        thematic_instruction = ""
        if thematic_context:
            thematic_instruction = f"""
🎯 THEMATIC CONTEXT:
Based on the following context/theme, create original educational content:
"{thematic_context}"

IMPORTANT: Use this as inspiration for the THEME and TOPIC only. Create completely original content, characters, and situations around this theme.
"""

        context_section = f"""
TASK: {competency.value.title()} | {question_type.value.replace('_', ' ').title()} | Level {level.value} | Difficulty {difficulty}/5
LANGUAGE: {language_instruction}
{thematic_instruction}
{compatibility_warning}
"""

        # Simplified retry instruction for anti-copy mode
        if anti_copy_mode:
            context_section += "\n⚡ RETRY: Please generate different content with varied names and scenarios.\n"

        if subtopic:
            context_section += f"- Subtopic: {subtopic}\n"
        if context:
            context_section += f"- Additional context: {context}\n"

        # Get competency-specific instructions (no templates)
        competency_instructions = self._get_competency_instructions(competency, question_type, level_info)

        # Get output format requirements
        output_format = self._get_output_format(question_type)

        return f"""{self.base_system_prompt}

{context_section}

LEVEL {level.value} - Use {level_info['vocabulary']} vocabulary, {level_info['grammar']} grammar

{competency_instructions}

{output_format}

Write in {target_language.upper()}. Create engaging educational content. Generate now!"""

    def _check_competency_compatibility(self, competency: Competency, question_type: QuestionType) -> str:
        """Check if competency and question type are compatible and return warnings"""

        incompatible_combinations = {
            (Competency.READING, QuestionType.SPEAKING): "⚠️ ADVERTENCIA: COMPRENSIÓN LECTORA con pregunta ORAL - asegúrate de incluir texto para leer",
            (Competency.READING, QuestionType.AUDIO_RESPONSE): "⚠️ ADVERTENCIA: COMPRENSIÓN LECTORA con respuesta AUDIO - incluye texto de lectura",
            (Competency.LISTENING, QuestionType.ESSAY): "⚠️ ADVERTENCIA: COMPRENSIÓN AUDITIVA con ENSAYO - incluye script de audio",
            (Competency.SPEAKING, QuestionType.MULTIPLE_CHOICE): "⚠️ ADVERTENCIA: EXPRESIÓN ORAL con opción múltiple - crea situación comunicativa",
            (Competency.WRITING, QuestionType.MULTIPLE_CHOICE): "⚠️ ADVERTENCIA: EXPRESIÓN ESCRITA con opción múltiple - debe evaluar escritura"
        }

        combination = (competency, question_type)
        if combination in incompatible_combinations:
            return incompatible_combinations[combination]

        # Recommendations for better combinations
        good_combinations = {
            Competency.READING: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.OPEN_TEXT],
            Competency.LISTENING: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.MATCHING],
            Competency.SPEAKING: [QuestionType.SPEAKING, QuestionType.AUDIO_RESPONSE],
            Competency.WRITING: [QuestionType.ESSAY, QuestionType.WRITING, QuestionType.OPEN_TEXT],
            Competency.GRAMMAR: [QuestionType.MULTIPLE_CHOICE, QuestionType.FILL_BLANKS, QuestionType.MATCHING],
            Competency.VOCABULARY: [QuestionType.MULTIPLE_CHOICE, QuestionType.MATCHING, QuestionType.FILL_BLANKS]
        }

        if competency in good_combinations and question_type not in good_combinations[competency]:
            return f"⚠️ NOTA: Combinación poco común - asegúrate de que evalúe correctamente {competency.value}"

        return ""

    def _get_competency_instructions(self, competency: Competency, question_type: QuestionType, level_info: Dict) -> str:
        """Get competency-specific instructions without literal templates"""

        instructions = {
            Competency.READING: self._get_reading_instructions(question_type, level_info),
            Competency.WRITING: self._get_writing_instructions(question_type, level_info),
            Competency.LISTENING: self._get_listening_instructions(question_type, level_info),
            Competency.SPEAKING: self._get_speaking_instructions(question_type, level_info),
            Competency.GRAMMAR: self._get_grammar_instructions(question_type, level_info),
            Competency.VOCABULARY: self._get_vocabulary_instructions(question_type, level_info)
        }

        return instructions.get(competency, self._get_default_instructions(question_type))

    def _get_reading_instructions(self, question_type: QuestionType, level_info: Dict) -> str:
        if question_type == QuestionType.MULTIPLE_CHOICE:
            return f"""
📚 READING COMPREHENSION - MULTIPLE CHOICE

TASK: Create a short reading comprehension question.

REQUIREMENTS:
1. **TEXT** (60-80 words ONLY):
   - Write brief, original text with {level_info['vocabulary']} vocabulary
   - Include 2-3 specific details (name, place, time, activity)
   - Use {level_info['grammar']} grammar structures

2. **QUESTION**: Ask about one specific detail from the text

3. **OPTIONS**: 4 choices (A, B, C, D) - only one correct

✅ CREATE: Engaging and educational content!"""

        elif question_type == QuestionType.TRUE_FALSE:
            return f"""
📚 TRUE/FALSE - QUICK FORMAT

TASK: Create brief reading with true/false statement.

REQUIREMENTS:
1. **TEXT** (50-70 words): Brief text with clear facts
2. **STATEMENT**: One clear true/false statement about text
3. Use {level_info['vocabulary']} vocabulary

✅ Create engaging content!"""

        elif question_type == QuestionType.OPEN_TEXT:
            return f"""
INSTRUCTIONS - OPEN QUESTION READING COMPREHENSION:
1. Text of 150-400 words
2. Question requiring personal response or analysis
3. Provide keywords for evaluation
4. Question should allow varied but evaluable answers"""

        return self._get_default_instructions(question_type)

    def _get_writing_instructions(self, question_type: QuestionType, level_info: Dict) -> str:
        if question_type == QuestionType.ESSAY:
            return f"""
INSTRUCTIONS - WRITTEN EXPRESSION (ESSAY):
1. Provide a clear and specific writing prompt
2. Indicate expected length (words)
3. Include specific evaluation criteria
4. Topic should allow use of level-appropriate vocabulary and grammar

PROMPT TYPES BY LEVEL:
- A1/A2: Personal description, routines, simple experiences
- B1/B2: Opinions, comparisons, basic arguments
- C1/C2: Critical analysis, complex argumentation, academic texts

EXPECTED VOCABULARY: {level_info['vocabulary']}
REQUIRED GRAMMAR: {level_info['grammar']}"""

        elif question_type == QuestionType.WRITING:
            return f"""
INSTRUCTIONS - WRITTEN EXPRESSION (GENERAL):
1. Specific prompt with realistic situation
2. Register indications (formal/informal)
3. Suggested structure
4. Clear evaluation criteria"""

        return self._get_default_instructions(question_type)

    def _get_listening_instructions(self, question_type: QuestionType, level_info: Dict) -> str:
        return f"""
INSTRUCTIONS - LISTENING COMPREHENSION:
1. Create audio script of 1-3 minutes appropriate to level
2. Script should sound natural and authentic
3. Include specific information and evaluable details
4. Generate question(s) based on the audio

AUDIO TYPES BY LEVEL:
- A1/A2: Simple conversations, basic announcements
- B1/B2: Interviews, news, presentations
- C1/C2: Lectures, debates, academic content

SCRIPT SHOULD INCLUDE:
- Specific information (numbers, names, places)
- Details that allow different types of questions
- Natural speech patterns

VOCABULARY: {level_info['vocabulary']}"""

    def _get_speaking_instructions(self, question_type: QuestionType, level_info: Dict) -> str:
        return f"""
INSTRUCTIONS - ORAL EXPRESSION:
1. Create a realistic communicative situation
2. Provide specific context and clear objective
3. Include detailed evaluation criteria
4. Task should promote use of level-appropriate vocabulary and grammar

TASK TYPES BY LEVEL:
- A1/A2: Personal presentations, simple descriptions
- B1/B2: Opinions, experiences, hypothetical situations
- C1/C2: Formal presentations, debates, critical analysis

ELEMENTS TO INCLUDE:
- Situation context
- Suggested time
- Key points to address
- Specific evaluation criteria"""

    def _get_grammar_instructions(self, question_type: QuestionType, level_info: Dict) -> str:
        if question_type == QuestionType.MULTIPLE_CHOICE:
            return f"""
INSTRUCTIONS - GRAMMAR (MULTIPLE CHOICE):
1. Create a sentence with a specific grammatical element to complete
2. The 4 options should be grammatically possible but only one correct in context
3. The context should be clear and natural

STRUCTURES FOR THIS LEVEL:
{level_info['grammar']}

CONTEXT: Use realistic situations where grammar is used naturally"""

        elif question_type == QuestionType.FILL_BLANKS:
            return f"""
INSTRUCTIONS - FILL IN THE BLANKS (GRAMMAR):
1. Create a short text with 3-5 blank spaces
2. Each space should evaluate a specific structure
3. Provide the correct answers
4. Text should be coherent and natural

STRUCTURES: {level_info['grammar']}"""

        elif question_type == QuestionType.MATCHING:
            return f"""
INSTRUCTIONS - MATCHING (GRAMMAR):
1. Create elements that relate logically (words-definitions, verbs-complements, etc.)
2. Provide 4 elements and their corresponding pairs
3. Relationships should be clear and level-appropriate

STRUCTURES: {level_info['grammar']}"""

        elif question_type == QuestionType.ORDERING:
            return f"""
INSTRUCTIONS - ORDERING (GRAMMAR):
1. Present elements that require logical or grammatical order
2. Can be words to form sentences or process steps
3. Order should be clear and have specific logic

STRUCTURES: {level_info['grammar']}"""

        return self._get_default_instructions(question_type)

    def _get_vocabulary_instructions(self, question_type: QuestionType, level_info: Dict) -> str:
        if question_type == QuestionType.MULTIPLE_CHOICE:
            return f"""
INSTRUCTIONS - VOCABULARY (MULTIPLE CHOICE):
1. Present a word or expression in context
2. Options should be from same semantic field but only one correct
3. Context should provide sufficient clues

TARGET VOCABULARY: {level_info['vocabulary']}

FORMAT: Sentence with underlined/blank word + 4 vocabulary options"""

        elif question_type == QuestionType.MATCHING:
            return f"""
INSTRUCTIONS - VOCABULARY (MATCHING):
1. Create pairs of related elements (word-definition, synonym-antonym, etc.)
2. Include at least 4 pairs
3. Elements should be level-appropriate

PAIR TYPES:
- Words and definitions
- Synonyms
- Words and contextual use

VOCABULARY: {level_info['vocabulary']}"""

        elif question_type == QuestionType.FILL_BLANKS:
            return f"""
INSTRUCTIONS - VOCABULARY (FILL BLANKS):
1. Create a text with 3-4 spaces for specific vocabulary
2. Context should give clues about correct word
3. Words should be level-appropriate

VOCABULARY: {level_info['vocabulary']}"""

        return self._get_default_instructions(question_type)

    def _get_default_instructions(self, question_type: QuestionType) -> str:
        return f"""
GENERAL INSTRUCTIONS:
1. Create authentic and realistic educational content
2. Ensure question effectively evaluates the competency
3. Provide sufficient context to answer
4. Options (if applicable) should be plausible

QUESTION TYPE: {question_type.value}"""


    def _get_output_format(self, question_type: QuestionType) -> str:
        """Return simple text format instead of complex JSON"""

        if question_type == QuestionType.MULTIPLE_CHOICE:
            return """
RESPOND IN THIS EXACT FORMAT:

CONTEXT:
[Write 60-80 words ONLY. Include: original name, place, time/date, activity. Be creative and brief.]

QUESTION:
[Ask about one specific detail from your text]

INSTRUCTIONS:
Read the text and answer the question

OPTIONS:
A) [Incorrect answer]
B) [Correct answer]
C) [Incorrect answer]
D) [Incorrect answer]

CORRECT_ANSWER: B

TOPIC: [Topic name]

Create engaging educational content!
"""

        elif question_type == QuestionType.TRUE_FALSE:
            return """
CONTEXT:
[Write 50-70 words with clear facts]

STATEMENT:
[Write true/false statement about text]

INSTRUCTIONS:
Read the text and decide if the statement is true or false

OPTIONS:
A) True
B) False

CORRECT_ANSWER: A

TOPIC: [topic name]
"""

        else:
            return """
CONTEXT:
[Write relevant context here]

QUESTION:
[Write the question here]

INSTRUCTIONS:
[Write clear instructions]

TOPIC: [topic name]
"""
from typing import Dict, List, Any, Optional
import asyncio
import time
import logging
from statistics import mean, median

from ..schemas.grading import (
    MCERLevel, 
    Competency,
    MCERScoreRequest,
    MCERScoreResponse,
    CompetencyScore,
    ComprehensiveEvaluationRequest,
    ComprehensiveEvaluationResponse
)

logger = logging.getLogger(__name__)

class MCERScoringService:
    """
    Service for MCER-based scoring and level determination
    Implements official MCER guidelines for language assessment
    """
    
    def __init__(self):
        self.level_thresholds = self._initialize_level_thresholds()
        self.competency_weights = self._initialize_competency_weights()
        self.level_descriptors = self._initialize_level_descriptors()
    
    def _initialize_level_thresholds(self) -> Dict[MCERLevel, Dict[str, float]]:
        """Initialize MCER level thresholds based on official guidelines"""
        return {
            MCERLevel.A1: {
                "min_percentage": 0,
                "target_percentage": 40,
                "max_percentage": 49
            },
            MCERLevel.A2: {
                "min_percentage": 40,
                "target_percentage": 50,
                "max_percentage": 59
            },
            MCERLevel.B1: {
                "min_percentage": 50,
                "target_percentage": 65,
                "max_percentage": 69
            },
            MCERLevel.B2: {
                "min_percentage": 65,
                "target_percentage": 75,
                "max_percentage": 79
            },
            MCERLevel.C1: {
                "min_percentage": 75,
                "target_percentage": 85,
                "max_percentage": 89
            },
            MCERLevel.C2: {
                "min_percentage": 85,
                "target_percentage": 95,
                "max_percentage": 100
            }
        }
    
    def _initialize_competency_weights(self) -> Dict[str, float]:
        """Initialize default weights for competencies"""
        return {
            "reading": 0.25,
            "writing": 0.25,
            "listening": 0.25,
            "speaking": 0.25
        }
    
    def _initialize_level_descriptors(self) -> Dict[MCERLevel, Dict[str, str]]:
        """Initialize MCER level descriptors for feedback"""
        return {
            MCERLevel.A1: {
                "description": "Nivel básico - Usuario principiante",
                "can_do": "Puede entender y usar expresiones familiares de uso cotidiano y frases básicas",
                "next_goals": "Desarrollar vocabulario básico y estructuras gramaticales simples"
            },
            MCERLevel.A2: {
                "description": "Nivel básico - Usuario elemental",
                "can_do": "Puede comunicarse en tareas simples y cotidianas que requieren intercambio de información",
                "next_goals": "Ampliar vocabulario y mejorar la fluidez en situaciones conocidas"
            },
            MCERLevel.B1: {
                "description": "Nivel intermedio - Usuario independiente",
                "can_do": "Puede manejar la mayoría de situaciones en países donde se habla el idioma",
                "next_goals": "Desarrollar expresión más compleja y vocabulario académico/profesional"
            },
            MCERLevel.B2: {
                "description": "Nivel intermedio alto - Usuario independiente",
                "can_do": "Puede entender ideas principales de textos complejos y expresarse con fluidez",
                "next_goals": "Refinar precisión gramatical y ampliar registro lingüístico"
            },
            MCERLevel.C1: {
                "description": "Nivel avanzado - Usuario competente",
                "can_do": "Puede expresarse con fluidez y espontaneidad sin esfuerzo aparente",
                "next_goals": "Perfeccionar matices y dominio en contextos académicos/profesionales"
            },
            MCERLevel.C2: {
                "description": "Nivel maestría - Usuario competente",
                "can_do": "Puede entender prácticamente todo y expresarse con precisión y matices",
                "next_goals": "Mantener y perfeccionar el dominio nativo del idioma"
            }
        }
    
    async def calculate_mcer_scores(
        self, 
        request: MCERScoreRequest
    ) -> MCERScoreResponse:
        """
        Calculate MCER scores based on competency results
        """
        start_time = time.time()
        
        try:
            logger.info("📊 Calculando puntajes MCER...")
            
            # Parse competency scores
            competency_results = self._parse_competency_scores(request.competency_scores)
            
            # Apply custom weights if provided
            weights = request.weights or self.competency_weights
            
            # Calculate weighted overall score
            overall_score = self._calculate_weighted_score(competency_results, weights)
            
            # Determine achieved level
            achieved_level = self._determine_level_from_scores(competency_results, overall_score)
            
            # Calculate level breakdown (probability distribution)
            level_breakdown = self._calculate_level_probabilities(competency_results)
            
            # Generate competency scores
            competency_score_objects = self._create_competency_score_objects(competency_results)
            
            # Generate recommendations
            recommendation = self._generate_level_recommendation(achieved_level, competency_results)
            
            # Next level requirements
            next_level_requirements = self._get_next_level_requirements(achieved_level, competency_results)
            
            processing_time = time.time() - start_time
            
            return MCERScoreResponse(
                success=True,
                message="Cálculo de puntajes MCER completado",
                processing_time=processing_time,
                overall_score=overall_score,
                max_score=100.0,
                percentage=overall_score,
                level_achieved=achieved_level,
                competency_scores=competency_score_objects,
                level_breakdown=level_breakdown,
                recommendation=recommendation,
                next_level_requirements=next_level_requirements
            )
            
        except Exception as e:
            logger.error(f"❌ Error calculando puntajes MCER: {e}")
            processing_time = time.time() - start_time
            
            return MCERScoreResponse(
                success=False,
                message=f"Error en cálculo MCER: {str(e)}",
                processing_time=processing_time,
                overall_score=0.0,
                max_score=100.0,
                percentage=0.0,
                level_achieved=MCERLevel.A1,
                competency_scores=[],
                level_breakdown={level: 0.0 for level in MCERLevel},
                recommendation="Error en el procesamiento",
                next_level_requirements=None
            )
    
    async def comprehensive_evaluation(
        self,
        request: ComprehensiveEvaluationRequest
    ) -> ComprehensiveEvaluationResponse:
        """
        Perform comprehensive evaluation combining all competencies
        """
        start_time = time.time()
        
        try:
            logger.info("🎯 Realizando evaluación comprehensiva...")
            
            # Extract scores from individual evaluations
            competency_scores = []
            individual_results = {}
            
            for evaluation in request.evaluations:
                competency = evaluation.get("competency")
                result = evaluation.get("result")
                
                if competency and result:
                    competency_scores.append({
                        competency: result.get("percentage", 0)
                    })
                    individual_results[competency] = result
            
            # Calculate MCER scores
            mcer_request = MCERScoreRequest(
                competency_scores=competency_scores,
                weights=request.weights,
                target_level=request.target_level,
                session_id=request.session_id,
                candidate_id=request.candidate_id
            )
            
            overall_results = await self.calculate_mcer_scores(mcer_request)
            
            # Determine final level and certification eligibility
            final_level = overall_results.level_achieved
            certificate_eligible = self._is_certificate_eligible(
                overall_results,
                request.target_level
            )
            
            # Generate improvement plan
            improvement_plan = self._generate_improvement_plan(
                overall_results.competency_scores,
                final_level
            )
            
            processing_time = time.time() - start_time
            
            return ComprehensiveEvaluationResponse(
                success=True,
                message="Evaluación comprehensiva completada",
                processing_time=processing_time,
                overall_results=overall_results,
                individual_results=individual_results,
                final_level=final_level,
                certificate_eligible=certificate_eligible,
                improvement_plan=improvement_plan
            )
            
        except Exception as e:
            logger.error(f"❌ Error en evaluación comprehensiva: {e}")
            processing_time = time.time() - start_time
            
            return ComprehensiveEvaluationResponse(
                success=False,
                message=f"Error en evaluación: {str(e)}",
                processing_time=processing_time,
                overall_results=None,
                individual_results={},
                final_level=MCERLevel.A1,
                certificate_eligible=False,
                improvement_plan=[]
            )
    
    def _parse_competency_scores(self, scores: List[Dict[str, float]]) -> Dict[str, float]:
        """Parse and normalize competency scores"""
        competency_results = {}
        
        for score_dict in scores:
            for competency, score in score_dict.items():
                # Normalize to 0-100 range
                normalized_score = max(0, min(100, float(score)))
                competency_results[competency.lower()] = normalized_score
        
        return competency_results
    
    def _calculate_weighted_score(
        self, 
        competency_results: Dict[str, float], 
        weights: Dict[str, float]
    ) -> float:
        """Calculate weighted overall score"""
        total_score = 0
        total_weight = 0
        
        for competency, score in competency_results.items():
            weight = weights.get(competency, 0.25)  # Default equal weight
            total_score += score * weight
            total_weight += weight
        
        # Normalize by total weight (in case weights don't sum to 1)
        return total_score / total_weight if total_weight > 0 else 0
    
    def _determine_level_from_scores(
        self, 
        competency_results: Dict[str, float], 
        overall_score: float
    ) -> MCERLevel:
        """
        Determine MCER level based on scores
        Uses both overall score and individual competency analysis
        """
        
        # Primary determination based on overall score
        for level in reversed(list(MCERLevel)):  # Start from C2 down to A1
            thresholds = self.level_thresholds[level]
            if overall_score >= thresholds["min_percentage"]:
                # Additional check: no competency should be more than 2 levels below
                if self._check_competency_balance(competency_results, level):
                    return level
        
        return MCERLevel.A1  # Default fallback
    
    def _check_competency_balance(
        self, 
        competency_results: Dict[str, float], 
        target_level: MCERLevel
    ) -> bool:
        """
        Check if individual competencies are balanced enough for the target level
        """
        level_order = [MCERLevel.A1, MCERLevel.A2, MCERLevel.B1, MCERLevel.B2, MCERLevel.C1, MCERLevel.C2]
        target_index = level_order.index(target_level)
        
        for competency, score in competency_results.items():
            competency_level = self._score_to_level(score)
            competency_index = level_order.index(competency_level)
            
            # No competency should be more than 2 levels below target
            if target_index - competency_index > 2:
                return False
        
        return True
    
    def _score_to_level(self, score: float) -> MCERLevel:
        """Convert a percentage score to MCER level"""
        for level in reversed(list(MCERLevel)):
            thresholds = self.level_thresholds[level]
            if score >= thresholds["min_percentage"]:
                return level
        return MCERLevel.A1
    
    def _calculate_level_probabilities(
        self, 
        competency_results: Dict[str, float]
    ) -> Dict[MCERLevel, float]:
        """
        Calculate probability distribution across MCER levels
        """
        probabilities = {}
        
        for level in MCERLevel:
            # Calculate how well the scores fit this level
            level_scores = []
            
            for competency, score in competency_results.items():
                thresholds = self.level_thresholds[level]
                
                # Distance from ideal score for this level
                ideal_score = thresholds["target_percentage"]
                distance = abs(score - ideal_score) / 100
                
                # Convert distance to probability (closer = higher probability)
                probability = max(0, 1 - distance * 2)
                level_scores.append(probability)
            
            # Average probability across competencies
            probabilities[level] = mean(level_scores) if level_scores else 0
        
        # Normalize probabilities to sum to 1
        total_prob = sum(probabilities.values())
        if total_prob > 0:
            probabilities = {k: v / total_prob for k, v in probabilities.items()}
        
        return probabilities
    
    def _create_competency_score_objects(
        self, 
        competency_results: Dict[str, float]
    ) -> List[CompetencyScore]:
        """Create CompetencyScore objects from results"""
        competency_scores = []
        
        for competency, score in competency_results.items():
            try:
                competency_enum = Competency(competency.lower())
                level = self._score_to_level(score)
                
                feedback = self._generate_competency_feedback(competency, score, level)
                
                competency_scores.append(CompetencyScore(
                    competency=competency_enum,
                    score=score,
                    max_score=100.0,
                    percentage=score,
                    level=level,
                    feedback=feedback
                ))
            except ValueError:
                logger.warning(f"Competencia no reconocida: {competency}")
                continue
        
        return competency_scores
    
    def _generate_competency_feedback(
        self, 
        competency: str, 
        score: float, 
        level: MCERLevel
    ) -> str:
        """Generate specific feedback for a competency"""
        competency_messages = {
            "reading": {
                "strong": "Excelente comprensión lectora. Puedes entender textos complejos con facilidad.",
                "good": "Buena comprensión lectora. Manejas bien la mayoría de textos de tu nivel.",
                "weak": "Necesitas mejorar tu comprensión lectora. Practica con textos más variados."
            },
            "writing": {
                "strong": "Escritura muy competente. Te expresas con claridad y precisión.",
                "good": "Buena habilidad de escritura. Comunicas tus ideas efectivamente.",
                "weak": "Tu escritura necesita desarrollo. Practica estructura y vocabulario."
            },
            "listening": {
                "strong": "Excelente comprensión auditiva. Entiendes conversaciones naturales sin dificultad.",
                "good": "Buena comprensión auditiva. Sigues la mayoría de conversaciones.",
                "weak": "Necesitas mejorar tu comprensión auditiva. Escucha material variado."
            },
            "speaking": {
                "strong": "Expresión oral muy fluida. Hablas con confianza y naturalidad.",
                "good": "Buena expresión oral. Te comunicas efectivamente en la mayoría de situaciones.",
                "weak": "Tu expresión oral necesita práctica. Trabaja en fluidez y pronunciación."
            }
        }
        
        messages = competency_messages.get(competency, {
            "strong": "Buen dominio de esta habilidad",
            "good": "Competencia adecuada en esta área", 
            "weak": "Esta habilidad necesita más práctica"
        })
        
        if score >= 75:
            return messages["strong"]
        elif score >= 55:
            return messages["good"]
        else:
            return messages["weak"]
    
    def _generate_level_recommendation(
        self, 
        achieved_level: MCERLevel, 
        competency_results: Dict[str, float]
    ) -> str:
        """Generate recommendation based on achieved level"""
        descriptor = self.level_descriptors[achieved_level]
        
        # Find weakest competency
        if competency_results:
            weakest_competency = min(competency_results.keys(), key=lambda k: competency_results[k])
            weakest_score = competency_results[weakest_competency]
            
            recommendation = f"Has alcanzado el nivel {achieved_level.value}. {descriptor['description']}. "
            
            if weakest_score < 60:
                recommendation += f"Te recomendamos enfocar tu estudio en {weakest_competency} para fortalecer esta competencia."
            else:
                recommendation += descriptor['can_do']
        else:
            recommendation = f"Nivel determinado: {achieved_level.value}. {descriptor['description']}"
        
        return recommendation
    
    def _get_next_level_requirements(
        self, 
        current_level: MCERLevel, 
        competency_results: Dict[str, float]
    ) -> Optional[Dict[str, str]]:
        """Get requirements for reaching the next level"""
        level_order = [MCERLevel.A1, MCERLevel.A2, MCERLevel.B1, MCERLevel.B2, MCERLevel.C1, MCERLevel.C2]
        
        try:
            current_index = level_order.index(current_level)
            if current_index < len(level_order) - 1:  # Not at highest level
                next_level = level_order[current_index + 1]
                next_thresholds = self.level_thresholds[next_level]
                
                requirements = {}
                for competency, score in competency_results.items():
                    required_score = next_thresholds["min_percentage"]
                    if score < required_score:
                        gap = required_score - score
                        requirements[competency] = f"Necesitas mejorar {gap:.0f} puntos para alcanzar {next_level.value}"
                
                if not requirements:
                    requirements["general"] = f"Estás listo para intentar el nivel {next_level.value}"
                
                return requirements
        except (ValueError, IndexError):
            pass
        
        return None
    
    def _is_certificate_eligible(
        self, 
        results: MCERScoreResponse, 
        target_level: Optional[MCERLevel]
    ) -> bool:
        """Determine if candidate is eligible for certification"""
        if not target_level:
            return results.overall_score >= 60  # General passing score
        
        # Must achieve target level or higher
        level_order = [MCERLevel.A1, MCERLevel.A2, MCERLevel.B1, MCERLevel.B2, MCERLevel.C1, MCERLevel.C2]
        
        try:
            achieved_index = level_order.index(results.level_achieved)
            target_index = level_order.index(target_level)
            
            # Must achieve target level and have minimum scores in all competencies
            if achieved_index >= target_index:
                min_competency_score = min(cs.percentage for cs in results.competency_scores)
                return min_competency_score >= 40  # No competency below 40%
        except (ValueError, IndexError):
            pass
        
        return False
    
    def _generate_improvement_plan(
        self, 
        competency_scores: List[CompetencyScore], 
        current_level: MCERLevel
    ) -> List[str]:
        """Generate personalized improvement plan"""
        plan = []
        
        # Sort competencies by score (weakest first)
        sorted_competencies = sorted(competency_scores, key=lambda x: x.percentage)
        
        # Focus on weakest competencies
        for comp_score in sorted_competencies[:2]:  # Top 2 weakest
            competency = comp_score.competency.value
            
            if comp_score.percentage < 60:
                if competency == "reading":
                    plan.append("Dedica 30 minutos diarios a lectura de textos variados")
                    plan.append("Practica técnicas de lectura rápida y comprensión")
                elif competency == "writing":
                    plan.append("Escribe textos cortos diariamente sobre temas familiares")
                    plan.append("Revisa gramática y conectores para mejorar coherencia")
                elif competency == "listening":
                    plan.append("Escucha podcasts y videos en el idioma objetivo 20 min/día")
                    plan.append("Practica con ejercicios de comprensión auditiva")
                elif competency == "speaking":
                    plan.append("Practica conversación con hablantes nativos o aplicaciones")
                    plan.append("Graba tu voz para autoevaluar pronunciación y fluidez")
        
        # General recommendations based on level
        level_recommendations = {
            MCERLevel.A1: "Enfócate en vocabulario básico y estructuras simples",
            MCERLevel.A2: "Amplía tu vocabulario y practica situaciones cotidianas",
            MCERLevel.B1: "Desarrolla expresión más compleja y vocabulario específico",
            MCERLevel.B2: "Refina precisión gramatical y registro formal/informal",
            MCERLevel.C1: "Perfecciona matices y expresión idiomática",
            MCERLevel.C2: "Mantén y pulimenta tu dominio avanzado"
        }
        
        general_rec = level_recommendations.get(current_level)
        if general_rec:
            plan.append(general_rec)
        
        return plan[:5]  # Limit to 5 recommendations

import { Calendar, Clock, Trophy, TrendingUp, BookOpen, CheckCircle } from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    variant?: 'default' | 'success' | 'warning' | 'info';
}

const StatsCard = ({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatsCardProps) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'success':
                return 'border-green-200 bg-green-50/50';
            case 'warning':
                return 'border-yellow-200 bg-yellow-50/50';
            case 'info':
                return 'border-blue-200 bg-blue-50/50';
            default:
                return 'border-slate-200 bg-white';
        }
    };

    const getIconStyles = () => {
        switch (variant) {
            case 'success':
                return 'text-green-600';
            case 'warning':
                return 'text-yellow-600';
            case 'info':
                return 'text-blue-600';
            default:
                return 'text-slate-600';
        }
    };

    return (
        <div className={`rounded-2xl shadow-sm border p-6 ${getVariantStyles()}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon className={`w-5 h-5 ${getIconStyles()}`} />
                        <span className="text-sm font-medium text-slate-600">{title}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mb-1">
                        {value}
                    </div>
                    {subtitle && (
                        <p className="text-sm text-slate-500">{subtitle}</p>
                    )}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${
                        trend.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                        <TrendingUp className={`w-3 h-3 ${!trend.isPositive ? 'rotate-180' : ''}`} />
                        {trend.value}%
                    </div>
                )}
            </div>
        </div>
    );
};

interface NextExamCardProps {
    exam: {
        id: number;
        name: string;
        date: string;
        time: string;
        duration: string;
        level: string;
    };
    onStartExam: (examId: number) => void;
}

const NextExamCard = ({ exam, onStartExam }: NextExamCardProps) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Próximo Examen
                    </h3>
                    <div className="space-y-1">
                        <p className="font-medium text-slate-800">{exam.name}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {exam.date}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {exam.time}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                                Nivel {exam.level}
                            </span>
                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs">
                                {exam.duration}
                            </span>
                        </div>
                    </div>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <button
                onClick={() => onStartExam(exam.id)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
                Iniciar Examen
            </button>
        </div>
    );
};

interface RecentResultCardProps {
    result: {
        id: number;
        examName: string;
        date: string;
        score: number;
        level: string;
        competencies: {
            listening: number;
            reading: number;
            writing: number;
            speaking: number;
        };
    };
    onViewDetails: (resultId: number) => void;
}

const RecentResultCard = ({ result, onViewDetails }: RecentResultCardProps) => {
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-slate-900">{result.examName}</h3>
                    <p className="text-sm text-slate-600 mt-1">{result.date}</p>
                </div>
                <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(result.score)}`}>
                        {result.score}%
                    </div>
                    <div className="text-sm text-slate-600">Nivel {result.level}</div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
                {Object.entries(result.competencies).map(([skill, score]) => (
                    <div key={skill} className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-600 capitalize mb-1">
                            {skill === 'listening' ? 'Comprensión Auditiva' :
                             skill === 'reading' ? 'Comprensión Lectora' :
                             skill === 'writing' ? 'Expresión Escrita' :
                             'Expresión Oral'}
                        </div>
                        <div className={`font-semibold ${getScoreColor(score)}`}>
                            {score}%
                        </div>
                    </div>
                ))}
            </div>
            
            <button
                onClick={() => onViewDetails(result.id)}
                className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
                Ver Detalles
            </button>
        </div>
    );
};

interface ProgressCardProps {
    currentLevel: string;
    targetLevel: string;
    progress: number;
    completedExams: number;
    totalExams: number;
}

const ProgressCard = ({ currentLevel, targetLevel, progress, completedExams, totalExams }: ProgressCardProps) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Mi Progreso</h3>
                <Trophy className="w-6 h-6 text-yellow-600" />
            </div>
            
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700">Nivel Actual</span>
                        <span className="text-lg font-bold text-blue-600">{currentLevel}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{width: `${progress}%`}}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Progreso hacia {targetLevel}</span>
                        <span>{progress}%</span>
                    </div>
                </div>
                
                <div>
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Exámenes Completados</span>
                        <span>{completedExams}/{totalExams}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                            style={{width: `${(completedExams / totalExams) * 100}%`}}
                        />
                    </div>
                </div>
                
                <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Meta</span>
                        <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Nivel {targetLevel}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export { StatsCard, NextExamCard, RecentResultCard, ProgressCard };
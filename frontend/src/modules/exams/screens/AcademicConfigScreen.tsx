import { MainLayout } from "@/components/layout";
import { Award, BarChart3, BookOpen, ChevronRight, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const configOptions = [
  {
    title: "Niveles MCER",
    description: "Gestionar niveles del Marco Común Europeo de Referencia para lenguas",
    icon: BarChart3,
    path: "/levels",
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    hoverBorder: "hover:border-blue-500/40",
  },
  {
    title: "Rúbricas de Evaluación",
    description: "Crear y gestionar rúbricas de calificación por competencia lingüística",
    icon: Award,
    path: "/rubrics",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
  },
  {
    title: "Banco de Preguntas",
    description: "Administrar preguntas multimodal: audio, texto, imagen y más",
    icon: HelpCircle,
    path: "/questions",
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
  },
  {
    title: "Gestión de Exámenes",
    description: "Configurar exámenes, sesiones y asignación de candidatos",
    icon: BookOpen,
    path: "/exams",
    accent: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    hoverBorder: "hover:border-purple-500/40",
  },
];

const AcademicConfigScreen = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Configuración Académica</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Niveles · Rúbricas · Preguntas · Exámenes
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.path}
                onClick={() => navigate(option.path)}
                className={`group flex items-center gap-4 bg-card border ${option.border} ${option.hoverBorder} rounded-lg p-5 text-left transition-all duration-200 hover:bg-muted/30 hover:shadow-sm`}
              >
                <div className={`shrink-0 p-2.5 rounded-lg ${option.bg} border ${option.border}`}>
                  <Icon className={`h-5 w-5 ${option.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{option.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{option.description}</p>
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:${option.accent} group-hover:translate-x-0.5 transition-all`} />
              </button>
            );
          })}
        </div>

      </div>
    </MainLayout>
  );
};

export default AcademicConfigScreen;

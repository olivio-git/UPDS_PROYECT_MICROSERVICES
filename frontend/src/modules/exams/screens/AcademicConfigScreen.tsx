import GradientWrapper from "@/components/background/GrandWrapperSection";
import { MainLayout } from "@/components/layout";
import { Award, BarChart3, BookOpen, HelpCircle, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AcademicConfigScreen = () => {
  const navigate = useNavigate();

  const configOptions = [
    {
      title: "Niveles MCER",
      description: "Gestionar niveles del Marco Común Europeo de Referencia",
      icon: BarChart3,
      path: "/levels",
      color: " ",
      iconColor: "text-blue-300",
      borderColor: "border-line"
    },
    {
      title: "Rúbricas de Evaluación", 
      description: "Crear y gestionar rúbricas por competencias",
      icon: Award,
      path: "/rubrics",
      color: " ",
      iconColor: "text-green-300",
      borderColor: "border-line"
    },
    {
      title: "Gestión de Preguntas",
      description: "Administrar banco de preguntas y asignaciones",
      icon: HelpCircle,
      path: "/questions",
      color: " ",
      iconColor: "text-orange-300",
      borderColor: "border-line"
    },
    {
      title: "Gestión de Exámenes",
      description: "Configurar y administrar exámenes y sesiones",
      icon: BookOpen,
      path: "/exams",
      color: " ",
      iconColor: "text-purple-300",
      borderColor: "border-line"
    }
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto space-y-8 epilogue-uniquifier">
        <div className="text-center space-y-3 mb-5">
          <div className="flex justify-center">
            <div className="p-2.5 rounded-full bg-gradient-to-br from-indigo-500/15 to-purple-600/15 border border-indigo-500/20">
              <Settings className="h-3.5 w-3.5 text-indigo-300" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-200">Configuración Académica</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Gestiona todos los aspectos académicos del sistema de evaluación lingüística
          </p>
        </div>

        <GradientWrapper
          intensity="low"
          size="xl"
          position="right"
          animate={false}
          variant="cosmic"
        >
          <div className="min-h-screen p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {configOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <div
                    key={option.path}
                    onClick={() => handleNavigate(option.path)}
                    className="group cursor-pointer bg-box/50 backdrop-blur-sm bg-box border border-line hover:border-line/60 rounded-xl p-6 transition-all duration-300   hover:shadow-lg hover:shadow-blue-500/10"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-full bg-gradient-to-br ${option.color} border ${option.borderColor}`}>
                          <IconComponent className={`h-4 w-4 ${option.iconColor}`} />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-200 group-hover:text-white transition-colors">
                          {option.title}
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Estadísticas rápidas */}
            {/* <div className="mt-12 bg-box/30 backdrop-blur-sm border border-line rounded-xl p-6 bg-box">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Resumen del Sistema</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-blue-300">6</div>
                  <div className="text-sm text-gray-400">Niveles MCER</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-green-300">--</div>
                  <div className="text-sm text-gray-400">Rúbricas Activas</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-orange-300">--</div>
                  <div className="text-sm text-gray-400">Preguntas</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-purple-300">--</div>
                  <div className="text-sm text-gray-400">Exámenes</div>
                </div>
              </div>
            </div> */}
          </div>
        </GradientWrapper>
      </div>
    </MainLayout>
  );
};

export default AcademicConfigScreen;
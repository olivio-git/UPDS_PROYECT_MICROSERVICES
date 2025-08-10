import { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  Users, 
  Play,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/atoms/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/select";
import { MainLayout } from "@/components/layout";
import { ContentGradientSection } from "@/components/background";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Exam {
  id: number;
  name: string;
  description: string;
  level: string;
  date: string;
  time: string;
  duration: number;
  maxParticipants: number;
  currentParticipants: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  type: 'placement' | 'progress' | 'final';
  competencies: string[];
  instructions: string;
  isRegistered: boolean;
  registrationDeadline?: string;
}

const StudentExams = () => {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Mock data - En producción vendría de la API
  const [exams] = useState<Exam[]>([
    {
      id: 1,
      name: "Examen de Progreso B1-B2",
      description: "Evaluación integral para verificar el avance del nivel B1 hacia B2",
      level: "B1",
      date: "2025-08-15",
      time: "10:00",
      duration: 120,
      maxParticipants: 25,
      currentParticipants: 18,
      status: 'upcoming',
      type: 'progress',
      competencies: ['Listening', 'Reading', 'Writing', 'Speaking'],
      instructions: "Examen de progreso que evaluará las cuatro competencias del Marco Común Europeo.",
      isRegistered: true,
      registrationDeadline: "2025-08-10"
    },
    {
      id: 2,
      name: "Evaluación Final B1",
      description: "Examen final del nivel B1 con certificación oficial",
      level: "B1",
      date: "2025-08-20",
      time: "14:00",
      duration: 150,
      maxParticipants: 30,
      currentParticipants: 12,
      status: 'upcoming',
      type: 'final',
      competencies: ['Listening', 'Reading', 'Writing', 'Speaking'],
      instructions: "Examen final certificado que determinará la aprobación del nivel B1.",
      isRegistered: false,
      registrationDeadline: "2025-08-15"
    },
    {
      id: 3,
      name: "Test de Ubicación A2-B1",
      description: "Evaluación para determinar el nivel de inglés del estudiante",
      level: "A2",
      date: "2025-08-25",
      time: "09:00",
      duration: 90,
      maxParticipants: 20,
      currentParticipants: 8,
      status: 'upcoming',
      type: 'placement',
      competencies: ['Listening', 'Reading', 'Writing'],
      instructions: "Test de ubicación que determinará tu nivel actual de inglés.",
      isRegistered: false,
      registrationDeadline: "2025-08-20"
    },
    {
      id: 4,
      name: "Evaluación B1 - Sesión 3",
      description: "Evaluación completada del nivel B1",
      level: "B1",
      date: "2025-07-20",
      time: "10:00",
      duration: 120,
      maxParticipants: 25,
      currentParticipants: 22,
      status: 'completed',
      type: 'progress',
      competencies: ['Listening', 'Reading', 'Writing', 'Speaking'],
      instructions: "Evaluación de progreso completada.",
      isRegistered: true
    }
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">Próximo</Badge>;
      case 'ongoing':
        return <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">En Progreso</Badge>;
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">Completado</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'placement':
        return <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">Ubicación</Badge>;
      case 'progress':
        return <Badge variant="secondary" className="bg-orange-500/20 text-orange-300">Progreso</Badge>;
      case 'final':
        return <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300">Final</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Calendar className="h-4 w-4 text-blue-400" />;
      case 'ongoing':
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleStartExam = (exam: Exam) => {
    if (exam.status === 'completed') {
      navigate(`/student/results/${exam.id}`);
    } else if (exam.isRegistered && exam.status === 'upcoming') {
      navigate(`/student/exam/${exam.id}/preparation`);
    } else {
      toast.error("No puedes acceder a este examen en este momento");
    }
  };

  const handleRegisterForExam = (examId: number) => {
    // En producción, esto sería una llamada a la API
    toast.success("Te has registrado exitosamente para el examen");
  };

  const filteredExams = exams.filter(exam => {
    const levelMatch = selectedLevel === "all" || exam.level === selectedLevel;
    const typeMatch = selectedType === "all" || exam.type === selectedType;
    return levelMatch && typeMatch;
  });

  const upcomingExams = filteredExams.filter(exam => exam.status === 'upcoming');
  const completedExams = filteredExams.filter(exam => exam.status === 'completed');
  const ongoingExams = filteredExams.filter(exam => exam.status === 'ongoing');

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <ContentGradientSection variant="secondary" position="top-right" className="mb-8">
          <div className="text-center space-y-6 m-6">
            <div className="space-y-2">
              <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                Mis{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                  Exámenes
                </span>
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto font-portfolio">
                Gestiona tus evaluaciones y ve tu progreso
              </p>
            </div>
          </div>
        </ContentGradientSection>

        {/* Filtros */}
        <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-400" />
              Filtrar Exámenes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Nivel</label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los niveles</SelectItem>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="A2">A2</SelectItem>
                    <SelectItem value="B1">B1</SelectItem>
                    <SelectItem value="B2">B2</SelectItem>
                    <SelectItem value="C1">C1</SelectItem>
                    <SelectItem value="C2">C2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Tipo de Examen</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="placement">Ubicación</SelectItem>
                    <SelectItem value="progress">Progreso</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Exámenes */}
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Próximos ({upcomingExams.length})
            </TabsTrigger>
            <TabsTrigger value="ongoing" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white">
              En Progreso ({ongoingExams.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              Completados ({completedExams.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-6 mt-6">
            {upcomingExams.length === 0 ? (
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No hay exámenes próximos</h3>
                  <p className="text-gray-400">Actualmente no tienes exámenes programados.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {upcomingExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onStartExam={handleStartExam}
                    onRegister={handleRegisterForExam}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    getTypeBadge={getTypeBadge}
                    getStatusIcon={getStatusIcon}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ongoing" className="space-y-6 mt-6">
            {ongoingExams.length === 0 ? (
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No hay exámenes en progreso</h3>
                  <p className="text-gray-400">Actualmente no tienes exámenes en progreso.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {ongoingExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onStartExam={handleStartExam}
                    onRegister={handleRegisterForExam}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    getTypeBadge={getTypeBadge}
                    getStatusIcon={getStatusIcon}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-6 mt-6">
            {completedExams.length === 0 ? (
              <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No hay exámenes completados</h3>
                  <p className="text-gray-400">Aún no has completado ningún examen.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {completedExams.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onStartExam={handleStartExam}
                    onRegister={handleRegisterForExam}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    getTypeBadge={getTypeBadge}
                    getStatusIcon={getStatusIcon}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

// Componente ExamCard separado para mejor organización
interface ExamCardProps {
  exam: Exam;
  onStartExam: (exam: Exam) => void;
  onRegister: (examId: number) => void;
  formatDate: (date: string) => string;
  getStatusBadge: (status: string) => any;
  getTypeBadge: (type: string) => any;
  getStatusIcon: (status: string) => any;
}

const ExamCard = ({ 
  exam, 
  onStartExam, 
  onRegister, 
  formatDate, 
  getStatusBadge, 
  getTypeBadge, 
  getStatusIcon 
}: ExamCardProps) => {
  const getButtonText = () => {
    if (exam.status === 'completed') return 'Ver Resultados';
    if (exam.status === 'ongoing') return 'Continuar Examen';
    if (exam.isRegistered) return 'Iniciar Examen';
    return 'Registrarse';
  };

  const getButtonVariant = () => {
    if (exam.status === 'completed') return 'outline';
    if (exam.isRegistered) return 'default';
    return 'secondary';
  };

  const isRegistrationClosed = exam.registrationDeadline && 
    new Date(exam.registrationDeadline) < new Date();

  return (
    <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-lg mb-2">{exam.name}</CardTitle>
            <CardDescription className="text-gray-300">{exam.description}</CardDescription>
          </div>
          <div className="flex flex-col gap-2">
            {getStatusBadge(exam.status)}
            {getTypeBadge(exam.type)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="h-4 w-4" />
            {formatDate(exam.date)}
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="h-4 w-4" />
            {exam.time} - {exam.duration} min
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Users className="h-4 w-4" />
            {exam.currentParticipants}/{exam.maxParticipants} inscritos
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(exam.status)}
            <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Nivel {exam.level}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-300">Competencias:</p>
          <div className="flex flex-wrap gap-1">
            {exam.competencies.map((competency, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="bg-gray-700/50 text-gray-300 text-xs"
              >
                {competency}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-300">Instrucciones:</p>
          <p className="text-sm text-gray-400">{exam.instructions}</p>
        </div>

        {exam.registrationDeadline && exam.status === 'upcoming' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-sm text-yellow-300">
              <strong>Fecha límite de registro:</strong> {formatDate(exam.registrationDeadline)}
            </p>
          </div>
        )}

        <div className="pt-4">
          {exam.status === 'upcoming' && !exam.isRegistered && !isRegistrationClosed ? (
            <Button
              onClick={() => onRegister(exam.id)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              Registrarse para el Examen
            </Button>
          ) : exam.status === 'upcoming' && !exam.isRegistered && isRegistrationClosed ? (
            <Button disabled className="w-full">
              Registro Cerrado
            </Button>
          ) : (
            <Button
              onClick={() => onStartExam(exam)}
              variant={getButtonVariant()}
              className={`w-full ${
                exam.status === 'completed' 
                  ? 'border-green-500/30 text-green-300 hover:bg-green-500/20'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
              }`}
            >
              <Play className="h-4 w-4 mr-2" />
              {getButtonText()}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentExams;
import { useState } from "react";
import { 
  User, 
  Mail, 
  Calendar,
  MapPin,
  Phone,
  BookOpen,
  Target,
  Award,
  Edit,
  Save,
  X,
  Camera
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { Input } from "@/components/atoms/input";
import { Textarea } from "@/components/atoms/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/select";
import { MainLayout } from "@/components/layout";
import { ContentGradientSection } from "@/components/background";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { toast } from "sonner";

interface StudentProfile {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    birthDate: string;
    nationality: string;
    address: string;
    city: string;
    country: string;
  };
  academicInfo: {
    currentLevel: string;
    targetLevel: string;
    enrollmentDate: string;
    studyGoals: string;
    previousExperience: string;
    motivations: string;
  };
  preferences: {
    preferredStudyTime: string;
    learningStyle: string;
    interests: string[];
    notifications: {
      email: boolean;
      sms: boolean;
      examReminders: boolean;
      progressUpdates: boolean;
    };
  };
}

const StudentProfile = () => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  
  // Mock data - En producción vendría de la API
  const [profile, setProfile] = useState<StudentProfile>({
    personalInfo: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: '+591 123 456 789',
      birthDate: '1995-03-15',
      nationality: 'Boliviana',
      address: 'Av. Principal 123',
      city: 'Tarija',
      country: 'Bolivia'
    },
    academicInfo: {
      currentLevel: 'B1',
      targetLevel: 'B2',
      enrollmentDate: '2025-01-15',
      studyGoals: 'Obtener certificación B2 para estudios universitarios en el extranjero',
      previousExperience: 'Estudié inglés básico en secundaria. He tomado algunos cursos online.',
      motivations: 'Quiero estudiar una maestría en Estados Unidos y necesito mejorar mi nivel de inglés académico.'
    },
    preferences: {
      preferredStudyTime: 'evening',
      learningStyle: 'visual',
      interests: ['tecnología', 'ciencia', 'viajes', 'música'],
      notifications: {
        email: true,
        sms: false,
        examReminders: true,
        progressUpdates: true
      }
    }
  });

  const [editedProfile, setEditedProfile] = useState<StudentProfile>(profile);

  const handleSave = () => {
    // En producción, esto enviaría los datos a la API
    setProfile(editedProfile);
    setIsEditing(false);
    toast.success("Perfil actualizado exitosamente");
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const updatePersonalInfo = (field: string, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value
      }
    }));
  };

  const updateAcademicInfo = (field: string, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      academicInfo: {
        ...prev.academicInfo,
        [field]: value
      }
    }));
  };

  const updatePreferences = (field: string, value: any) => {
    setEditedProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value
      }
    }));
  };

  const updateNotifications = (field: string, value: boolean) => {
    setEditedProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        notifications: {
          ...prev.preferences.notifications,
          [field]: value
        }
      }
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStudyTimeLabel = (time: string) => {
    const times = {
      morning: 'Mañana',
      afternoon: 'Tarde',
      evening: 'Noche',
      flexible: 'Flexible'
    };
    return times[time as keyof typeof times] || time;
  };

  const getLearningStyleLabel = (style: string) => {
    const styles = {
      visual: 'Visual',
      auditory: 'Auditivo',
      kinesthetic: 'Kinestésico',
      mixed: 'Mixto'
    };
    return styles[style as keyof typeof styles] || style;
  };

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <ContentGradientSection variant="secondary" position="top-right" className="mb-8">
          <div className="text-center space-y-6 m-6">
            <div className="space-y-2">
              <h1 className="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                Mi{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                  Perfil
                </span>
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto font-portfolio">
                Información personal y preferencias académicas
              </p>
            </div>
          </div>
        </ContentGradientSection>

        {/* Información Principal */}
        <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                    {profile.personalInfo.firstName.charAt(0)}
                    {profile.personalInfo.lastName.charAt(0)}
                  </div>
                  <Button
                    size="sm"
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0 bg-gray-600 hover:bg-gray-500"
                  >
                    <Camera className="h-3 w-3" />
                  </Button>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {profile.personalInfo.firstName} {profile.personalInfo.lastName}
                  </h2>
                  <p className="text-gray-300">{profile.personalInfo.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Nivel Actual: {profile.academicInfo.currentLevel}
                    </Badge>
                    <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                      Meta: {profile.academicInfo.targetLevel}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleSave}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </Button>
                    <Button
                      onClick={handleCancel}
                      variant="outline"
                      className="border-gray-600 text-gray-300"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Perfil
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs de Navegación */}
        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'personal'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            Información Personal
          </button>
          <button
            onClick={() => setActiveTab('academic')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'academic'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <BookOpen className="h-4 w-4 inline mr-2" />
            Información Académica
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'preferences'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Target className="h-4 w-4 inline mr-2" />
            Preferencias
          </button>
        </div>

        {/* Contenido de las Tabs */}
        {activeTab === 'personal' && (
          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-blue-400" />
                Información Personal
              </CardTitle>
              <CardDescription className="text-gray-300">
                Datos personales y de contacto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nombre</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.personalInfo.firstName}
                      onChange={(e) => updatePersonalInfo('firstName', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  ) : (
                    <p className="text-white">{profile.personalInfo.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Apellido</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.personalInfo.lastName}
                      onChange={(e) => updatePersonalInfo('lastName', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  ) : (
                    <p className="text-white">{profile.personalInfo.lastName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-400" />
                    <p className="text-white">{profile.personalInfo.email}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Teléfono</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.personalInfo.phone}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-green-400" />
                      <p className="text-white">{profile.personalInfo.phone}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Fecha de Nacimiento</label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editedProfile.personalInfo.birthDate}
                      onChange={(e) => updatePersonalInfo('birthDate', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-400" />
                      <p className="text-white">{formatDate(profile.personalInfo.birthDate)}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nacionalidad</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.personalInfo.nationality}
                      onChange={(e) => updatePersonalInfo('nationality', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  ) : (
                    <p className="text-white">{profile.personalInfo.nationality}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white">Dirección</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Dirección</label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.personalInfo.address}
                        onChange={(e) => updatePersonalInfo('address', e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    ) : (
                      <p className="text-white">{profile.personalInfo.address}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Ciudad</label>
                    {isEditing ? (
                      <Input
                        value={editedProfile.personalInfo.city}
                        onChange={(e) => updatePersonalInfo('city', e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-red-400" />
                        <p className="text-white">{profile.personalInfo.city}, {profile.personalInfo.country}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'academic' && (
          <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-400" />
                Información Académica
              </CardTitle>
              <CardDescription className="text-gray-300">
                Nivel actual, objetivos y experiencia previa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nivel Actual</label>
                  {isEditing ? (
                    <Select
                      value={editedProfile.academicInfo.currentLevel}
                      onValueChange={(value) => updateAcademicInfo('currentLevel', value)}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="A2">A2</SelectItem>
                        <SelectItem value="B1">B1</SelectItem>
                        <SelectItem value="B2">B2</SelectItem>
                        <SelectItem value="C1">C1</SelectItem>
                        <SelectItem value="C2">C2</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {profile.academicInfo.currentLevel}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Nivel Objetivo</label>
                  {isEditing ? (
                    <Select
                      value={editedProfile.academicInfo.targetLevel}
                      onValueChange={(value) => updateAcademicInfo('targetLevel', value)}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A2">A2</SelectItem>
                        <SelectItem value="B1">B1</SelectItem>
                        <SelectItem value="B2">B2</SelectItem>
                        <SelectItem value="C1">C1</SelectItem>
                        <SelectItem value="C2">C2</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                      {profile.academicInfo.targetLevel}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Fecha de Inscripción</label>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-400" />
                    <p className="text-white">{formatDate(profile.academicInfo.enrollmentDate)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Objetivos de Estudio</label>
                  {isEditing ? (
                    <Textarea
                      value={editedProfile.academicInfo.studyGoals}
                      onChange={(e) => updateAcademicInfo('studyGoals', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                      rows={3}
                    />
                  ) : (
                    <p className="text-white bg-gray-800/50 p-3 rounded-lg">
                      {profile.academicInfo.studyGoals}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Experiencia Previa</label>
                  {isEditing ? (
                    <Textarea
                      value={editedProfile.academicInfo.previousExperience}
                      onChange={(e) => updateAcademicInfo('previousExperience', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                      rows={3}
                    />
                  ) : (
                    <p className="text-white bg-gray-800/50 p-3 rounded-lg">
                      {profile.academicInfo.previousExperience}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Motivaciones</label>
                  {isEditing ? (
                    <Textarea
                      value={editedProfile.academicInfo.motivations}
                      onChange={(e) => updateAcademicInfo('motivations', e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white"
                      rows={3}
                    />
                  ) : (
                    <p className="text-white bg-gray-800/50 p-3 rounded-lg">
                      {profile.academicInfo.motivations}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  Preferencias de Estudio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Horario Preferido</label>
                    {isEditing ? (
                      <Select
                        value={editedProfile.preferences.preferredStudyTime}
                        onValueChange={(value) => updatePreferences('preferredStudyTime', value)}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Mañana</SelectItem>
                          <SelectItem value="afternoon">Tarde</SelectItem>
                          <SelectItem value="evening">Noche</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-white">{getStudyTimeLabel(profile.preferences.preferredStudyTime)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Estilo de Aprendizaje</label>
                    {isEditing ? (
                      <Select
                        value={editedProfile.preferences.learningStyle}
                        onValueChange={(value) => updatePreferences('learningStyle', value)}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visual">Visual</SelectItem>
                          <SelectItem value="auditory">Auditivo</SelectItem>
                          <SelectItem value="kinesthetic">Kinestésico</SelectItem>
                          <SelectItem value="mixed">Mixto</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-white">{getLearningStyleLabel(profile.preferences.learningStyle)}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Intereses</label>
                  <div className="flex flex-wrap gap-2">
                    {profile.preferences.interests.map((interest, index) => (
                      <Badge key={index} variant="secondary" className="bg-purple-500/20 text-purple-300">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#0B1422] backdrop-blur-sm border border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Preferencias de Notificaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Notificaciones por Email</p>
                      <p className="text-sm text-gray-400">Recibir actualizaciones por correo electrónico</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEditing ? editedProfile.preferences.notifications.email : profile.preferences.notifications.email}
                      onChange={(e) => isEditing && updateNotifications('email', e.target.checked)}
                      disabled={!isEditing}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Recordatorios de Exámenes</p>
                      <p className="text-sm text-gray-400">Recibir recordatorios antes de los exámenes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEditing ? editedProfile.preferences.notifications.examReminders : profile.preferences.notifications.examReminders}
                      onChange={(e) => isEditing && updateNotifications('examReminders', e.target.checked)}
                      disabled={!isEditing}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Actualizaciones de Progreso</p>
                      <p className="text-sm text-gray-400">Recibir reportes de progreso académico</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEditing ? editedProfile.preferences.notifications.progressUpdates : profile.preferences.notifications.progressUpdates}
                      onChange={(e) => isEditing && updateNotifications('progressUpdates', e.target.checked)}
                      disabled={!isEditing}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default StudentProfile;
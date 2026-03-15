import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/card";
import { Input } from "@/components/atoms/input";
import { MainLayout } from "@/components/layout";
import { useAuthStore } from "@/modules/auth/services/authStore";
import {
  Bell,
  Camera,
  Edit,
  KeyRound,
  Mail,
  Phone,
  Save,
  Shield,
  Target,
  User,
  X
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ChangePasswordFlow } from "../components/ChangePasswordFlow";

interface NotificationPrefs {
  email: boolean;
  examReminders: boolean;
  progressUpdates: boolean;
}

interface PersonalInfo {
  phone: string;
  nationality: string;
}

const tabs = [
  { id: "personal", label: "Personal", icon: User },
  { id: "preferences", label: "Preferencias", icon: Target },
  { id: "security", label: "Seguridad", icon: Shield },
];

const StudentProfile = () => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    phone: user?.profile?.phone || "",
    nationality: "Boliviana",
  });
  const [editedInfo, setEditedInfo] = useState<PersonalInfo>(personalInfo);

  const [notifications, setNotifications] = useState<NotificationPrefs>({
    email: true,
    examReminders: true,
    progressUpdates: true,
  });

  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const email = user?.email || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleSave = () => {
    setPersonalInfo(editedInfo);
    setIsEditing(false);
    toast.success("Perfil actualizado");
  };

  const handleCancel = () => {
    setEditedInfo(personalInfo);
    setIsEditing(false);
  };

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        {/* Page title */}
        <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* ── Left: Profile card ── */}
          <div className="w-full md:w-64 shrink-0">
            <Card className="bg-card border border-border">
              <CardContent className="pt-6 pb-5 px-5 space-y-4">
                {/* Avatar */}
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="relative">
                    <div className="w-18 h-18 w-[72px] h-[72px] bg-[#F0003C] rounded-full flex items-center justify-center text-xl font-bold text-white select-none">
                      {initials || <User className="h-7 w-7" />}
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors">
                      <Camera className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground leading-tight">
                      {firstName} {lastName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                      {email}
                    </p>
                  </div>

                  <Badge variant="secondary" className="text-xs">
                    Estudiante
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{personalInfo.phone || "Sin teléfono"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-border pt-3 space-y-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleSave}
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Guardar cambios
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={handleCancel}
                      >
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => { setActiveTab("personal"); setIsEditing(true); }}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Editar perfil
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => { setActiveTab("security"); setShowChangePassword(true); }}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                        Cambiar contraseña
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Tabbed content ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                    activeTab === id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: Personal ── */}
            {activeTab === "personal" && (
              <Card className="bg-card border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <span className="icon-wrap-blue p-1.5 rounded-md">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    Información Personal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Nombre — readonly (viene de auth) */}
                    <InfoRow
                      label="Nombre"
                      value={firstName}
                      readonly
                    />
                    <InfoRow
                      label="Apellido"
                      value={lastName}
                      readonly
                    />
                    <InfoRow
                      label="Email"
                      value={email}
                      readonly
                    />

                    {/* Teléfono — editable */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      {isEditing ? (
                        <Input
                          value={editedInfo.phone}
                          onChange={(e) =>
                            setEditedInfo((p) => ({ ...p, phone: e.target.value }))
                          }
                          placeholder="Ej. +591 7xxxxxxx"
                          className="h-8 text-sm"
                        />
                      ) : (
                        <p className="text-sm text-foreground">
                          {personalInfo.phone || (
                            <span className="text-muted-foreground italic">Sin teléfono</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Nacionalidad — editable */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Nacionalidad</p>
                      {isEditing ? (
                        <Input
                          value={editedInfo.nationality}
                          onChange={(e) =>
                            setEditedInfo((p) => ({ ...p, nationality: e.target.value }))
                          }
                          className="h-8 text-sm"
                          disabled
                        />
                      ) : (
                        <p className="text-sm text-foreground">{personalInfo.nationality}</p>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="pt-2 border-t border-border">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                      >
                        Editar información →
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Tab: Preferences ── */}
            {activeTab === "preferences" && (
              <Card className="bg-card border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <span className="icon-wrap-purple p-1.5 rounded-md">
                      <Bell className="h-3.5 w-3.5" />
                    </span>
                    Notificaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    {
                      key: "email" as keyof NotificationPrefs,
                      label: "Notificaciones por Email",
                      desc: "Recibir actualizaciones en tu correo",
                    },
                    {
                      key: "examReminders" as keyof NotificationPrefs,
                      label: "Recordatorios de Exámenes",
                      desc: "Alerta antes de cada examen programado",
                    },
                    {
                      key: "progressUpdates" as keyof NotificationPrefs,
                      label: "Actualizaciones de Progreso",
                      desc: "Reportes periódicos de tu avance",
                    },
                  ].map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <button
                        onClick={() =>
                          setNotifications((p) => ({ ...p, [key]: !p[key] }))
                        }
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          notifications[key] ? "bg-blue-600" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            notifications[key] ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ── Tab: Security ── */}
            {activeTab === "security" && (
              <Card className="bg-card border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <span className="icon-wrap-red p-1.5 rounded-md">
                      <Shield className="h-3.5 w-3.5" />
                    </span>
                    Seguridad de la Cuenta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Contraseña */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <span className="icon-wrap-blue p-2 rounded-md">
                        <KeyRound className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Contraseña</p>
                        <p className="text-xs text-muted-foreground">
                          Última actualización: {new Date().toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowChangePassword(true)}
                    >
                      Cambiar
                    </Button>
                  </div>

                  {/* Email verificado */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <span className="icon-wrap-green p-2 rounded-md">
                        <Mail className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Email verificado</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {email}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 text-xs">
                      Verificado
                    </Badge>
                  </div>

                  {/* 2FA */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <span className="icon-wrap-blue p-2 rounded-md">
                        <Shield className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Autenticación de dos factores
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Verificación OTP por email
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 text-xs">
                      Activo
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ChangePasswordFlow
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSuccess={() => {
          toast.success("Contraseña actualizada exitosamente");
          setShowChangePassword(false);
        }}
      />
    </MainLayout>
  );
};

// Small helper to render a readonly info row
const InfoRow = ({
  label,
  value,
  readonly = false,
}: {
  label: string;
  value: string;
  readonly?: boolean;
}) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-sm text-foreground ${readonly ? "opacity-70" : ""}`}>
      {value || <span className="italic text-muted-foreground">—</span>}
    </p>
  </div>
);

export default StudentProfile;

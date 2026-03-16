import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/card";
import { Input } from "@/components/atoms/input";
import { UserAvatar } from "@/components/atoms/UserAvatar";
import { MainLayout } from "@/components/layout";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { userManagementService } from "@/services/userManagementService";
import {
  Bell,
  BookOpen,
  Camera,
  Edit,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Target,
  User,
  X
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChangePasswordFlow } from "../components/ChangePasswordFlow";


interface PersonalInfo {
  phone: string;
  address: string;
  dateOfBirth: string;
  bio: string;
}

const tabs = [
  { id: "personal", label: "Personal", icon: User },
  { id: "preferences", label: "Preferencias", icon: Target },
  { id: "security", label: "Seguridad", icon: Shield },
];

const StudentProfile = () => {
  const { user, patchLocalUser } = useAuthStore();
  // console.log(user)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const rawPhone = user?.profile?.phone || "";
  const phoneNumber = rawPhone.startsWith("+591") ? rawPhone.slice(4) : rawPhone;

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    phone: phoneNumber,
    address: (user?.profile as any)?.address || "",
    dateOfBirth: (user?.profile as any)?.dateOfBirth
      ? new Date((user.profile as any).dateOfBirth).toISOString().split("T")[0]
      : "",
    bio: (user?.profile as any)?.bio || "",
  });
  const [editedInfo, setEditedInfo] = useState<PersonalInfo>(personalInfo);

  const [emailNotif, setEmailNotif] = useState<boolean>(
    user?.profile?.preferences?.notifications?.email ?? true
  );
  const [savingNotif, setSavingNotif] = useState(false);

  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const email = user?.email || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleSave = async () => {
    setIsSaving(true);
    const result = await userManagementService.updateProfile({
      profile: {
        phone: editedInfo.phone ? `+591${editedInfo.phone}` : "",
        address: editedInfo.address,
        dateOfBirth: editedInfo.dateOfBirth || undefined,
        bio: editedInfo.bio,
      },
    });
    setIsSaving(false);
    if (result.success) {
      setPersonalInfo(editedInfo);
      patchLocalUser({
        profile: {
          phone: editedInfo.phone ? `+591${editedInfo.phone}` : "",
          address: editedInfo.address,
          dateOfBirth: editedInfo.dateOfBirth || undefined,
          bio: editedInfo.bio,
        },
      });
      setIsEditing(false);
      toast.success("Perfil actualizado");
    }
  };

  const handleCancel = () => {
    setEditedInfo(personalInfo);
    setIsEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setIsUploadingAvatar(true);
    const result = await userManagementService.uploadAvatar(user.id, file);
    setIsUploadingAvatar(false);
    if (result.success && result.data?.avatarUrl) {
      patchLocalUser({ profile: { ...user.profile, avatarUrl: result.data.avatarUrl } });
      toast.success('Foto de perfil actualizada');
    }
  };

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        {/* Page title */}
        <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>

        <div className="flex flex-col md:flex-row gap-6 md:items-start">
          {/* ── Left: Profile card ── */}
          <div className="w-full md:w-64 shrink-0">
            <Card className="bg-card border border-border shadow-none">
              <CardContent className="pt-6 pb-5 px-5 space-y-4">
                {/* Avatar */}
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="relative">
                    <UserAvatar
                      avatarUrl={user?.profile?.avatarUrl}
                      firstName={firstName}
                      lastName={lastName}
                      size="lg"
                    />
                    <button
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center hover:bg-muted/80 transition-colors disabled:opacity-50"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      title="Cambiar foto de perfil"
                    >
                      <Camera className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
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
                    {{ admin: 'Administrador', teacher: 'Profesor', proctor: 'Supervisor', student: 'Estudiante' }[user?.role as 'admin' | 'teacher' | 'proctor' | 'student' ?? 'student'] ?? 'Estudiante'}
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
                    <span>
                      {personalInfo.phone
                        ? `+591 ${personalInfo.phone}`
                        : "Sin teléfono"}
                    </span>
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
                        disabled={isSaving}
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {isSaving ? "Guardando..." : "Guardar cambios"}
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
              <Card className="bg-card border border-border shadow-none">
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
                    {/* Nombre — readonly */}
                    <InfoRow label="Nombre" value={firstName} readonly />
                    <InfoRow label="Apellido" value={lastName} readonly />
                    <InfoRow label="Email" value={email} readonly />

                    {/* Teléfono — editable con prefijo +591 */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        Teléfono
                      </p>
                      {isEditing ? (
                        <div className="flex h-8 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 bg-background">
                          <div className="flex items-center px-2.5 bg-muted border-r border-input shrink-0">
                            <span className="text-xs font-semibold text-muted-foreground select-none">+591</span>
                          </div>
                          <input
                            type="tel"
                            value={editedInfo.phone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                              setEditedInfo((p) => ({ ...p, phone: val }));
                            }}
                            placeholder="7xxxxxxx"
                            maxLength={8}
                            className="flex-1 px-2.5 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">
                          {personalInfo.phone ? (
                            <span className="font-medium">+591 {personalInfo.phone}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Sin teléfono</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Fecha de nacimiento — editable */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Fecha de nacimiento</p>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedInfo.dateOfBirth}
                          onChange={(e) =>
                            setEditedInfo((p) => ({ ...p, dateOfBirth: e.target.value }))
                          }
                          className="h-8 text-sm"
                        />
                      ) : (
                        <p className="text-sm text-foreground">
                          {personalInfo.dateOfBirth
                            ? new Date(personalInfo.dateOfBirth).toLocaleDateString("es-BO", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })
                            : <span className="text-muted-foreground italic">No especificada</span>}
                        </p>
                      )}
                    </div>

                    {/* Dirección — editable, ocupa columna completa */}
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        Dirección
                      </p>
                      {isEditing ? (
                        <Input
                          value={editedInfo.address}
                          onChange={(e) =>
                            setEditedInfo((p) => ({ ...p, address: e.target.value }))
                          }
                          placeholder="Ej. Av. Busch #123, La Paz"
                          className="h-8 text-sm"
                        />
                      ) : (
                        <p className="text-sm text-foreground">
                          {personalInfo.address || (
                            <span className="text-muted-foreground italic">Sin dirección</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Bio — editable, ocupa columna completa */}
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3 w-3" />
                        Sobre mí
                      </p>
                      {isEditing ? (
                        <textarea
                          value={editedInfo.bio}
                          onChange={(e) =>
                            setEditedInfo((p) => ({ ...p, bio: e.target.value }))
                          }
                          placeholder="Cuéntanos un poco sobre ti..."
                          maxLength={300}
                          rows={3}
                          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
                        />
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed">
                          {personalInfo.bio || (
                            <span className="text-muted-foreground italic">Sin descripción</span>
                          )}
                        </p>
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
              <Card className="bg-card border border-border shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <span className="icon-wrap-purple p-1.5 rounded-md">
                      <Bell className="h-3.5 w-3.5" />
                    </span>
                    Notificaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Notificaciones por Email</p>
                      <p className="text-xs text-muted-foreground">
                        Recibir resultados de exámenes en tu correo
                      </p>
                    </div>
                    <button
                      disabled={savingNotif}
                      onClick={async () => {
                        const next = !emailNotif;
                        setSavingNotif(true);
                        const result = await userManagementService.updateProfile({
                          profile: { preferences: { notifications: { email: next } } },
                        });
                        setSavingNotif(false);
                        if (result.success) {
                          setEmailNotif(next);
                          patchLocalUser({ profile: { preferences: { notifications: { email: next } } } });
                          toast.success(next ? "Notificaciones activadas" : "Notificaciones desactivadas");
                        }
                      }}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        savingNotif ? "opacity-50 cursor-not-allowed" : ""
                      } ${emailNotif ? "bg-blue-600" : "bg-muted"}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          emailNotif ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Tab: Security ── */}
            {activeTab === "security" && (
              <Card className="bg-card border border-border shadow-none">
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

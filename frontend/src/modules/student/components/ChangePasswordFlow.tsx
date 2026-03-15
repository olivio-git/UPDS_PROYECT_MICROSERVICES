import { Button } from "@/components/atoms/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card";
import { Input } from "@/components/atoms/input";
import { authService } from "@/modules/auth/services/authService";
import { Eye, EyeOff, KeyRound, Lock, Mail, Shield, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ChangePasswordFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FlowStep = 'initial' | 'otp_verification' | 'success';

interface FormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otpCode: string;
}

export const ChangePasswordFlow: React.FC<ChangePasswordFlowProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<FlowStep>('initial');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    otpCode: ''
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  if (!isOpen) return null;

  const validateInitialForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Ingresa tu contraseña actual';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'Ingresa una nueva contraseña';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'La contraseña debe tener al menos 8 caracteres';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu nueva contraseña';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'La nueva contraseña debe ser diferente a la actual';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInitialSubmit = async () => {
    if (!validateInitialForm()) return;

    setLoading(true);
    try {
      const result = await authService.initiatePasswordChange(formData.currentPassword);

      if (result.success) {
        setStep('otp_verification');
        toast.success('Código OTP enviado a tu email');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Error al iniciar cambio de contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!formData.otpCode.trim()) {
      setErrors({ otpCode: 'Ingresa el código OTP' });
      return;
    }

    setLoading(true);
    try {
      const result = await authService.completePasswordChange(formData.otpCode, formData.currentPassword, formData.newPassword);

      if (result.success) {
        setStep('success');
        toast.success('Contraseña cambiada exitosamente');
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        toast.error(result.message);
        setErrors({ otpCode: result.message });
      }
    } catch (error) {
      toast.error('Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('initial');
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      otpCode: ''
    });
    setErrors({});
    onClose();
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md bg-card border border-border shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-foreground">
                {step === 'initial' && 'Cambiar Contraseña'}
                {step === 'otp_verification' && 'Verificación OTP'}
                {step === 'success' && 'Contraseña Actualizada'}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-muted-foreground">
            {step === 'initial' && 'Ingresa tu contraseña actual y define una nueva'}
            {step === 'otp_verification' && 'Revisa tu email e ingresa el código de 6 dígitos'}
            {step === 'success' && 'Tu contraseña ha sido actualizada correctamente'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 'initial' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={(e) => updateFormData('currentPassword', e.target.value)}
                    className="bg-muted border-border text-foreground pr-10"
                    placeholder="Ingresa tu contraseña actual"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.currentPassword && (
                  <p className="text-red-400 text-sm">{errors.currentPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={(e) => updateFormData('newPassword', e.target.value)}
                    className="bg-muted border-border text-foreground pr-10"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.newPassword && (
                  <p className="text-red-400 text-sm">{errors.newPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  Confirmar Nueva Contraseña
                </label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                  className="bg-muted border-border text-foreground"
                  placeholder="Repite tu nueva contraseña"
                />
                {errors.confirmPassword && (
                  <p className="text-red-400 text-sm">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size={"sm"}
                  className="flex-1 bg-card hover:bg-muted border border-line text-foreground/80"
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
                <Button
                  size={"sm"}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleInitialSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Validando...
                    </div>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Continuar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'otp_verification' && (
            <>
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Mail className="h-8 w-8 text-blue-400" />
                </div>
                <div>
                  <p className="text-foreground font-medium">Código enviado</p>
                  <p className="text-muted-foreground text-sm">
                    Hemos enviado un código de 6 dígitos a tu email registrado
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">
                  Código de Verificación
                </label>
                <Input
                  type="text"
                  value={formData.otpCode}
                  onChange={(e) => updateFormData('otpCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="bg-muted border-border text-foreground text-center text-xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
                {errors.otpCode && (
                  <p className="text-red-400 text-sm">{errors.otpCode}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size={"sm"}
                  className="flex-1 bg-card hover:bg-muted border border-line text-foreground/80"
                  onClick={() => setStep('initial')}
                >
                  Volver
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleOtpSubmit}
                  size={"sm"}
                  disabled={loading || formData.otpCode.length !== 6}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verificando...
                    </div>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Cambiar Contraseña
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <Shield className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <p className="text-foreground font-medium">¡Contraseña actualizada!</p>
                <p className="text-muted-foreground text-sm">
                  Tu contraseña ha sido cambiada exitosamente
                </p>
              </div>
              <Button
                size={"sm"}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={handleClose}
              >
                Continuar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { useAuthStore } from '@/modules/auth/services/authStore';
import GradientBackground from '@/modules/home/screens/GradientBackground';
import { KeyRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ResetPasswordScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Get email from navigation state
  const email = location.state?.email;

  // Clear error on component mount and focus input
  useEffect(() => {
    clearError();

    // Verificar que tenemos email del estado de navegación
    if (!email) {
      toast.error('Acceso no autorizado');
      navigate('/');
      return;
    }

    // Focus the password input after component mounts
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [clearError, email, navigate]);

  const validatePasswords = () => {
    if (!newPassword) {
      toast.error('Por favor ingresa una nueva contraseña');
      return false;
    }

    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    if (!confirmPassword) {
      toast.error('Por favor confirma tu nueva contraseña');
      return false;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswords()) {
      return;
    }

    try {
      console.log('🔐 Restableciendo contraseña para:', email);
      const success = await resetPassword(email, newPassword);

      if (success) {
        console.log('✅ Contraseña restablecida exitosamente');
        toast.success('Contraseña restablecida exitosamente');

        // Redirigir al login después de un breve delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        console.log('❌ Error restableciendo contraseña');
      }
    } catch (error) {
      console.error('❌ Error inesperado restableciendo contraseña:', error);
      toast.error('Error inesperado. Por favor intenta de nuevo.');
    }
  };

  return (
    <>
      <GradientBackground grid={false} objs={false} lights={true} size="sm" />

      <div className="min-h-screen flex items-center justify-center p-4 epilogue-uniquifier">
        <Card className="w-full max-w-md bg-transparent shadow-none">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center border border-border justify-center w-12 h-12 bg-muted rounded-full mx-auto mb-4">
              <KeyRound className="h-6 w-6 text-foreground" />
            </div>
            <CardTitle className="text-3xl font-medium text-card-foreground">
              Nueva Contraseña
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Ingresa tu nueva contraseña para restablecer tu cuenta
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <GradientWrapper
              variant="cosmic"
              intensity="low"
              size="xl"
              animate={false}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="newPassword"
                    className="text-card-foreground font-medium"
                  >
                    Nueva Contraseña
                  </Label>
                  <Input
                    ref={passwordInputRef}
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Ingresa tu nueva contraseña"
                    disabled={isLoading}
                    required
                    autoFocus={true}
                    className="input-no-bg epilogue-uniquifier block w-full px-0 py-2 border-0 border-b border-border
                    focus:outline-none focus:border-b-blue-500 pl-2 focus:ring-0 rounded-none font-medium text-card-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-card-foreground font-medium"
                  >
                    Confirmar Contraseña
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirma tu nueva contraseña"
                    disabled={isLoading}
                    required
                    className="input-no-bg epilogue-uniquifier block w-full px-0 py-2 border-0 border-b border-border
                    focus:outline-none focus:border-b-blue-500 pl-2 focus:ring-0 rounded-none font-medium text-card-foreground"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-brand-blue hover:bg-primary/90 text-white font-medium disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Restableciendo...' : 'Restablecer Contraseña'}
                </Button>
              </form>
            </GradientWrapper>

            <div className="text-center space-y-2">
              <Button
                variant="link"
                className="text-muted-foreground hover:text-card-foreground p-0 h-auto font-normal text-sm"
                disabled={isLoading}
                onClick={() => navigate('/')}
              >
                ← Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ResetPasswordScreen;
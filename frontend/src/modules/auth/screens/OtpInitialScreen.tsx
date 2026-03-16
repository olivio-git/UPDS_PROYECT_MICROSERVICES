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
import { Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const OtpInitialScreen = () => {
  const navigate = useNavigate();
  const { generateOTP, isLoading, error, clearError, otp } = useAuthStore();
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);

  // Clear error on component mount and focus input
  useEffect(() => {
    clearError();
    // Focus the email input after component mounts
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [clearError]);

  // Redirect to OTP verification when OTP is generated
  useEffect(() => {
    if (otp.isOTPRequired && (otp.otpPurpose === 'login' || otp.otpPurpose === 'password_reset')) {
      console.log('📧 [OtpInitialScreen] Redirigiendo a verificación OTP:', {
        email: otp.otpEmail,
        purpose: otp.otpPurpose,
        isResetMode
      });

      navigate('/otp-verification', {
        state: {
          email: otp.otpEmail,
          purpose: otp.otpPurpose,
        },
      });
    }
  }, [otp.isOTPRequired, otp.otpPurpose, navigate, isResetMode]);

  const validateEmail = () => {
    if (!email) {
      toast.error('Por favor ingresa tu email');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Por favor ingresa un email válido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail()) {
      return;
    }

    try {
      const purpose = isResetMode ? 'password_reset' : 'login';
      console.log('📧 Generando OTP inicial para:', email, 'propósito:', purpose);
      const success = await generateOTP(email, purpose);

      if (success) {
        console.log('✅ OTP inicial generado');
        const message = isResetMode ? 'Código de recuperación enviado a tu email' : 'Código OTP enviado a tu email';
        toast.success(message);
        // La redirección se maneja automáticamente via useEffect
      } else {
        console.log('❌ Error generando OTP inicial');
      }
    } catch (error) {
      console.error('❌ Error inesperado generando OTP:', error);
      toast.error('Error inesperado. Por favor intenta de nuevo.');
    }
  };

  return (
    <>
      <GradientBackground grid={false} objs={false} lights={true} size="sm" />
      {/* <div className="fixed top-4 left-4 z-50">
        <div className="flex items-center space-x-2">
          <img className="h-8" src={ImageLogo} alt="Logo" />
        </div>
      </div> */}

      <div className="min-h-screen flex items-center justify-center p-4 epilogue-uniquifier">
        <Card className="w-full max-w-md bg-transparent shadow-none">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center border border-border justify-center w-12 h-12 bg-muted rounded-full mx-auto mb-4">
              <Mail className="h-6 w-6 text-foreground" />
            </div>
            <CardTitle className="text-3xl font-medium text-card-foreground">
              {isResetMode ? 'Recuperar Contraseña' : 'Verificación OTP'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isResetMode
                ? 'Ingresa tu email para recibir el código de recuperación'
                : 'Ingresa tu email para recibir el código de verificación'
              }
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
                    htmlFor="email"
                    className="text-card-foreground font-medium"
                  >
                    Email
                  </Label>
                  <Input
                    ref={emailInputRef}
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    disabled={isLoading}
                    required
                    autoFocus={true}
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
                  {isLoading
                    ? 'Enviando...'
                    : isResetMode
                    ? 'Enviar Código de Recuperación'
                    : 'Enviar Código OTP'
                  }
                </Button>
              </form>
            </GradientWrapper>

            <div className="text-center space-y-2">
              <Button
                variant="link"
                className="text-muted-foreground hover:text-card-foreground p-0 h-auto font-normal text-sm"
                disabled={isLoading}
                onClick={() => setIsResetMode(!isResetMode)}
              >
                {isResetMode ? '← Volver al login' : '¿Olvidaste tu contraseña?'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default OtpInitialScreen;

import { useState, useEffect } from "react"
import { ArrowLeft, Mail, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/atoms/input-otp"
import { Button } from "@/components/atoms/button"
import { Alert, AlertDescription } from "@/components/atoms/alert"
import { useAuthStore } from "@/modules/auth/services/authStore"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import GradientBackground from "@/modules/home/screens/GradientBackground"
import ImageLogo from "@/assets/images/logo.webp"

interface OTPVerificationProps {
  email?: string
  purpose?: "login" | "password_reset" | "email_verification"
  onBack?: () => void
  onVerify?: (code: string) => void
  isModal?: boolean
}

const OtpVerificator = ({
  email: propEmail,
  purpose: propPurpose = "login",
  onBack,
  isModal = false,
}: OTPVerificationProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const {  
    verifyOTP, 
    generateOTP, 
    isLoading, 
    error, 
    clearError,
    otp, 
    clearOTP,
  } = useAuthStore()

  const [otpCode, setOtpCode] = useState("")
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes
  const [canResend, setCanResend] = useState(false)

  // Get email and purpose from props, location state, or store
  const email = propEmail || location.state?.email || otp.otpEmail
  const purpose = propPurpose || location.state?.purpose || otp.otpPurpose

  // Redirect if no email 
  useEffect(() => {
    if (!email) {
      toast.error("No se proporcionó un email para verificación")
      navigate("/")
      return
    }
  }, [email, navigate])

  // Handle countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [timeLeft])

  // Set initial timer from OTP expiration
  useEffect(() => {
    if (otp.otpExpiresAt) {
      const remaining = Math.max(0, Math.floor((otp.otpExpiresAt.getTime() - Date.now()) / 1000))
      setTimeLeft(remaining)
      setCanResend(remaining === 0)
    }
  }, [otp.otpExpiresAt])

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      toast.error("Por favor ingresa un código de 6 dígitos")
      return
    }

    try {
      console.log(`🔍 Verificando OTP para propósito: ${purpose}`)
      
      const success = await verifyOTP(otpCode)
      
      if (success) {
        toast.success("¡Código verificado exitosamente!")
        
        // Según el propósito, redirigir apropiadamente
        if (purpose === "login") {
          console.log("🔑 OTP verificado para login, redirigiendo a formulario de credenciales")
          navigate('/login', {
            state: {
              verifiedEmail: email
            }
          })
        } else {
          // Para otros propósitos (password_reset, email_verification)
          console.log(`✅ OTP verificado para ${purpose}`)
        }
      }
    } catch (error) {
      console.error("Error verifying OTP:", error)
      toast.error("Error inesperado al verificar el código")
    }
  }

  const handleResend = async () => {
    if (!canResend) return

    try {
      const success = await generateOTP(email, purpose)
      
      if (success) {
        toast.success("¡Código reenviado exitosamente!")
        setTimeLeft(600) // Reset to 10 minutes
        setCanResend(false)
        setOtpCode("")
        clearError()
      }
    } catch (error) {
      console.error("Error resending OTP:", error)
      toast.error("Error al reenviar el código")
    }
  }

  const handleBack = () => {
    clearOTP()
    clearError()
    
    if (onBack) {
      onBack()
    } else {
      navigate("/")
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getPurposeText = () => {
    switch (purpose) {
      case "login":
        return "continuar con el inicio de sesión"
      case "password_reset":
        return "restablecer tu contraseña"
      case "email_verification":
        return "verificar tu email"
      default:
        return "verificar tu cuenta"
    }
  }

  const getActionText = () => {
    switch (purpose) {
      case "login":
        return "Una vez verificado, podrás ingresar tu contraseña para completar el inicio de sesión"
      case "password_reset":
        return "Una vez verificado, podrás cambiar tu contraseña"
      case "email_verification":
        return "Una vez verificado, tu email estará confirmado"
      default:
        return "Verifica el código para continuar"
    }
  }

  return (
    <>
      <GradientBackground grid={false} objs={false} lights={true} size="2xl" />
      
      {/* Logo en la esquina superior izquierda */}
      {/* <div className="fixed top-4 left-4 z-50">
        <div className="flex items-center space-x-2">
          <img className="h-8" src={ImageLogo} alt="Logo" />
        </div>
      </div> */}

      <div className="min-h-screen flex items-center justify-center p-4 epilogue-uniquifier">
        <Card className="w-full max-w-md bg-transparent shadow-none">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4">
              <Mail className="h-6 w-6 text-black" />
            </div>
            <CardTitle className="text-3xl font-medium text-card-foreground">
              Verificar Código
            </CardTitle>
            <CardDescription className="text-gray-400">
              Hemos enviado un código de 6 dígitos para {getPurposeText()} a
              <br />
              <span className="font-medium text-card-foreground">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Alertas de error */}
            {error && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Alerta de intentos restantes */}
            {otp.attemptsRemaining < 3 && (
              <Alert className="border-yellow-500/50 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-600">
                  Te quedan {otp.attemptsRemaining} intento(s)
                </AlertDescription>
              </Alert>
            )}

            {/* Información sobre el propósito */}
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <AlertCircle className="h-5 w-5 text-blue-600" /> 
              <AlertDescription className="text-blue-600">
                {getActionText()}
              </AlertDescription>
            </Alert>

            <div className="space-y-6">
              {/* Input OTP estilizado */}
              <div className="flex justify-center">
                <InputOTP 
                  maxLength={6} 
                  value={otpCode} 
                  onChange={setOtpCode} 
                  className="gap-3"
                  disabled={isLoading}
                >
                  <InputOTPGroup className="gap-2">  
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="focus:border-b-blue-500 focus:outline-none focus:ring-0"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Botón de verificar estilizado */}
              <Button
                onClick={handleVerify}
                disabled={otpCode.length !== 6 || isLoading || otp.attemptsRemaining === 0}
                className="w-full bg-white hover:bg-gray-100 text-black font-medium disabled:opacity-50"
              >
                {isLoading ? "Verificando..." : 
                  purpose === "login" ? "Verificar y Continuar al Login" :
                  purpose === "password_reset" ? "Verificar y Cambiar Contraseña" :
                  "Verificar Código"
                }
              </Button>
            </div>

            {/* Sección de reenvío */}
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-400">¿No recibiste el código?</p>

              {timeLeft > 0 ? (
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>Reenviar en {formatTime(timeLeft)}</span>
                </div>
              ) : (
                <Button
                  variant="link"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-card-foreground hover:text-gray-300 p-0 h-auto font-normal"
                >
                  Reenviar código
                </Button>
              )}
            </div>

            {/* Botón de volver estilizado */}
            {(onBack || !isModal) && (
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="text-gray-400 hover:text-card-foreground p-0 h-auto font-normal text-sm inline-flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default OtpVerificator
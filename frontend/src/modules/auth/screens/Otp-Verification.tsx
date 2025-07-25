import { useState, useEffect } from "react"
import { ArrowLeft, Mail, Clock, AlertCircle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/atoms/input-otp"
import { Button } from "@/components/atoms/button"
import { Alert, AlertDescription } from "@/components/atoms/alert"
import { useAuthStore } from "@/modules/auth/services/authStore"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

interface OTPVerificationProps {
  email?: string
  purpose?: "login" | "password_reset" | "email_verification"
  pendingAction?: "login" | "register" | null
  onBack?: () => void
  onVerify?: (code: string) => void
  isModal?: boolean
}

const OtpVerificator = ({
  email: propEmail,
  purpose: propPurpose = "email_verification",
  pendingAction: propPendingAction = null,
  onBack,
  onVerify,
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
    isAuthenticated,
    clearOTP,
    checkOTPStatus
  } = useAuthStore()

  const [otpCode, setOtpCode] = useState("")
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes
  const [canResend, setCanResend] = useState(false)

  // Get email, purpose and pendingAction from props, location state, or store
  const email = propEmail || location.state?.email || otp.otpEmail
  const purpose = propPurpose || location.state?.purpose || otp.otpPurpose
  const pendingAction = propPendingAction || location.state?.pendingAction || otp.pendingAction

  // Redirect if no email or purpose
  useEffect(() => {
    if (!email) {
      toast.error("No se proporcionó un email para verificación")
      navigate("/")
      return
    }

    // Check OTP status on mount
    if (email && purpose) {
      checkOTPStatus(email, purpose)
    }
  }, [email, purpose, navigate, checkOTPStatus])

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard")
    }
  }, [isAuthenticated, navigate])

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
      const success = await verifyOTP(otpCode)
      
      if (success) {
        toast.success("¡Código verificado exitosamente!")
        
        if (onVerify) {
          onVerify(otpCode)
        } else {
          // El AuthStore se encargará de completar la acción pendiente
          // Si no hay acción pendiente, usar comportamiento por defecto
          if (!pendingAction) {
            switch (purpose) {
              case "email_verification":
                toast.info("Email verificado. Puedes iniciar sesión ahora.")
                navigate("/")
                break
              case "login":
                navigate("/dashboard")
                break
              case "password_reset":
                navigate("/reset-password", { state: { email, verified: true } })
                break
              default:
                navigate("/dashboard")
            }
          }
          // Si hay pendingAction, el store redirigirá automáticamente al dashboard
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
    if (pendingAction === "login") {
      return "iniciar sesión"
    } else if (pendingAction === "register") {
      return "completar tu registro"
    }
    
    switch (purpose) {
      case "login":
        return "verificar tu identidad"
      case "password_reset":
        return "restablecer tu contraseña"
      case "email_verification":
        return "verificar tu email"
      default:
        return "verificar tu cuenta"
    }
  }

  const getActionText = () => {
    if (pendingAction === "login") {
      return "Una vez verificado, iniciarás sesión automáticamente"
    } else if (pendingAction === "register") {
      return "Una vez verificado, tu cuenta será creada y accederás al sistema"
    }
    return "Verifica el código para continuar"
  }

  const containerClass = isModal
    ? "w-full max-w-md mx-auto"
    : "min-h-screen flex items-center justify-center bg-gray-50 px-4"

  const cardClass = isModal ? "border-0 shadow-none" : "border-0 shadow-lg"

  return (
    <div className={containerClass}>
      <Card className={`w-full max-w-md ${cardClass}`}>
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4">
            <Mail className="h-6 w-6 text-black" />
          </div>
          <CardTitle className="text-2xl font-light text-black">
            Verificar Código
          </CardTitle>
          <CardDescription className="text-gray-600">
            Hemos enviado un código de 6 dígitos para {getPurposeText()} a
            <br />
            <span className="font-medium text-black">{email}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {otp.attemptsRemaining < 3 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Te quedan {otp.attemptsRemaining} intento(s)
              </AlertDescription>
            </Alert>
          )}

          {/* Información sobre la acción pendiente */}
          {pendingAction && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                ℹ️ {getActionText()}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP 
                maxLength={6} 
                value={otpCode} 
                onChange={setOtpCode} 
                className="gap-2"
                disabled={isLoading}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="w-12 h-12 text-lg font-medium border-gray-300 focus:border-black focus:ring-black disabled:bg-gray-100"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerify}
              disabled={otpCode.length !== 6 || isLoading || otp.attemptsRemaining === 0}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium disabled:bg-gray-300"
            >
              {isLoading ? "Verificando..." : 
                pendingAction === "login" ? "Verificar e Iniciar Sesión" :
                pendingAction === "register" ? "Verificar y Completar Registro" :
                "Verificar Código"
              }
            </Button>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">¿No recibiste el código?</p>

            {timeLeft > 0 ? (
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Reenviar en {formatTime(timeLeft)}</span>
              </div>
            ) : (
              <Button
                variant="link"
                onClick={handleResend}
                disabled={isLoading}
                className="text-black hover:text-gray-600 p-0 h-auto font-normal"
              >
                Reenviar código
              </Button>
            )}
          </div>

          {(onBack || !isModal) && (
            <div className="text-center">
              <Button
                variant="link"
                onClick={handleBack}
                disabled={isLoading}
                className="text-gray-500 hover:text-black p-0 h-auto font-normal inline-flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver al {pendingAction === "register" ? "registro" : "inicio"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default OtpVerificator
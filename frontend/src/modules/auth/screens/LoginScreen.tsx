import { Alert, AlertDescription } from "@/components/atoms/alert"
import { Button } from "@/components/keel/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/keel/card"
import { Field, FieldLabel } from "@/components/keel/field"
import { Input } from "@/components/keel/input"
import { AuthHeader } from "@/modules/auth/components/AuthHeader"
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/modules/auth/components/authStyles"
import { useAuthStore } from "@/modules/auth/services/authStore"
import GradientBackground from "@/modules/home/screens/GradientBackground"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

const LoginScreen = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    login,
    isLoading,
    error,
    clearError,
    isAuthenticated
  } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)

  // Get verified email from location state or redirect to OTP
  const verifiedEmail = location.state?.verifiedEmail

  // Form data
  const [formData, setFormData] = useState({
    email: verifiedEmail || "",
    password: "",
  })

  // Redirect if no verified email
  useEffect(() => {
    if (!verifiedEmail) {
      navigate('/')
      return
    }
  }, [verifiedEmail, navigate])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // Clear error on component mount
  useEffect(() => {
    clearError()
  }, [clearError])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = () => {
    if (!formData.email) {
      toast.error("Email no verificado")
      navigate('/')
      return false
    }

    if (!formData.password) {
      toast.error("Por favor ingresa tu contraseña")
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      console.log("❌ Validación fallida")
      return
    }

    try {
      console.log("🔑 Intentando LOGIN DIRECTO...")
      const success = await login(formData.email, formData.password)

      if (success) {
        console.log("✅ Login exitoso")
        // El dashboard ya confirma la entrada; no hace falta un aviso.
        // La redirección se maneja automáticamente por el estado de autenticación
      } else {
        console.log("❌ Error en login")

        // The backend requires a fresh login OTP verification right before
        // /auth/login (case: user landed on /login directly, or the OTP
        // marker expired while they were typing their password). Send them
        // back to the OTP step instead of showing a generic error here.
        if (useAuthStore.getState().lastLoginErrorCode === 'OTP_REQUIRED') {
          toast.error("Verifica el código enviado a tu correo antes de iniciar sesión.")
          navigate('/', { state: { email: formData.email } })
        }
      }
    } catch (error) {
      console.error("❌ Error inesperado en login:", error)
      toast.error("Credenciales incorrectas")
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  return (
    <>
      <GradientBackground grid={false} objs={false} lights={true} size="xl" />
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-transparent shadow-none">
          <CardHeader className="space-y-1">
            <AuthHeader step={2} />
            <CardTitle className="text-3xl font-medium text-card-foreground epilogue-uniquifier text-center">
              Iniciar Sesión
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field — shown once, read-only: it was already verified in the OTP step. */}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="tu@email.com"
                  disabled={true}
                  required
                />
              </Field>

              {/* Password field */}
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    disabled={isLoading}
                    required
                    className="pr-9"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-0.5 top-0.5 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </Field>

              <Button
                type="submit"
                size={'sm'}
                className={AUTH_PRIMARY_BUTTON_CLASS}
                disabled={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>

            <div className="text-center space-y-4 flex flex-col items-center">
              <Button
                variant="link"
                className="text-muted-foreground hover:text-card-foreground p-0 h-auto font-normal text-sm"
                disabled={isLoading}
                onClick={() => toast.info("Próximamente disponible - Recuperación via OTP")}
              >
                ¿Olvidaste tu contraseña?
              </Button>

              <Button
                variant="link"
                className="text-muted-foreground hover:text-foreground p-0 h-auto font-normal inline-flex items-center"
                onClick={handleBack}
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Usar otro email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default LoginScreen

import { useState, useEffect } from "react"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/card"
import { Label } from "@/components/atoms/label"
import { Input } from "@/components/atoms/input"
import { Button } from "@/components/atoms/button" 
import { Alert, AlertDescription } from "@/components/atoms/alert"
import { useAuthStore } from "@/modules/auth/services/authStore"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"
import GradientBackground from "@/modules/home/screens/GradientBackground"  
import ImageLogo from "@/assets/images/logo.webp"

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
        toast.success("¡Bienvenido!")
        // La redirección se maneja automáticamente por el estado de autenticación
      } else {
        console.log("❌ Error en login")
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
      <div className="fixed top-4 left-4 z-50">
        <div className="flex items-center space-x-2">
          <img className="h-8" src={ImageLogo} alt="Logo" />
        </div>
      </div>

      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-transparent shadow-none">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-medium text-card-foreground epilogue-uniquifier">
              Iniciar Sesión
            </CardTitle>
            <p className="text-gray-400 text-sm">
              Email verificado: <span className="font-medium text-white">{verifiedEmail}</span>
            </p>
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
              {/* Email field (read-only/disabled) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-card-foreground font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="tu@email.com"
                  disabled={true}
                  required
                  className="block w-full bg-transparent epilogue-uniquifier px-0 py-2 border-0 border-b border-gray-300 focus:outline-none focus:border-b-blue-500 focus:ring-0 rounded-none opacity-70"
                />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground font-medium">
                  Contraseña
                </Label>
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
                    className="block w-full bg-transparent epilogue-uniquifier px-0 py-2 border-0 border-b border-gray-300 focus:outline-none focus:border-b-blue-500 focus:ring-0 rounded-none"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
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
              </div>

              <Button 
                type="submit" 
                className="w-full bg-white hover:bg-primary/90 text-black font-medium disabled:opacity-50"
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
                className="text-gray-500 hover:text-white p-0 h-auto font-normal inline-flex items-center"
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
import { useState, useEffect } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/atoms/card";
import { Label } from "@/components/atoms/label";
import { Input } from "@/components/atoms/input";
import { Button } from "@/components/atoms/button";
import { Alert, AlertDescription } from "@/components/atoms/alert";
import { useAuthStore } from "@/modules/auth/services/authStore";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GradientBackground from "@/modules/home/screens/GradientBackground";
import ImageLogo from "@/assets/images/logo.webp";

const OtpInitialScreen = () => {
  const navigate = useNavigate();
  const { generateOTP, isLoading, error, clearError, otp } = useAuthStore();

  const [email, setEmail] = useState("");

  // Clear error on component mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Redirect to OTP verification when OTP is generated
  useEffect(() => {
    if (otp.isOTPRequired && otp.otpPurpose === "login") {
      navigate("/otp-verification", {
        state: {
          email: otp.otpEmail,
          purpose: "login",
        },
      });
    }
  }, [otp.isOTPRequired, otp.otpPurpose, navigate]);

  const validateEmail = () => {
    if (!email) {
      toast.error("Por favor ingresa tu email");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Por favor ingresa un email válido");
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
      console.log("📧 Generando OTP inicial para:", email);
      const success = await generateOTP(email, "login");

      if (success) {
        console.log("✅ OTP inicial generado");
        toast.success("Código OTP enviado a tu email");
        // La redirección se maneja automáticamente via useEffect
      } else {
        console.log("❌ Error generando OTP inicial");
      }
    } catch (error) {
      console.error("❌ Error inesperado generando OTP:", error);
      toast.error("Error inesperado. Por favor intenta de nuevo.");
    }
  };

  return (
    <>
      <GradientBackground grid={false} objs={false} lights={true} size="2xl" />
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
              Verificación OTP
            </CardTitle>
            <CardDescription className="text-gray-400">
              Ingresa tu email para recibir el código de verificación
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-card-foreground font-medium"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  disabled={isLoading}
                  required
                  className="block w-full bg-transparent epilogue-uniquifier px-0 py-2 border-0 border-b 
                  border-gray-300 focus:outline-none focus:border-b-blue-500 pl-2 focus:ring-0 rounded-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-white hover:bg-primary/90 text-black font-medium disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar Código OTP"}
              </Button>
            </form>

            {/* <div className="text-center">
              <Button 
                variant="link" 
                className="text-muted-foreground hover:text-card-foreground p-0 h-auto font-normal text-sm inline-flex items-center"
                disabled={isLoading}
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver
              </Button>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default OtpInitialScreen;

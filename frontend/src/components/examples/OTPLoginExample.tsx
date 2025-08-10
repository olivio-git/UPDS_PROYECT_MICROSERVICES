// 🔐 EJEMPLO DE USO: Login con OTP
// Este archivo muestra cómo usar los nuevos métodos implementados

import { useAuthStore } from '@/modules/auth/services/authStore'
import { toast } from 'sonner'

export const ExampleOTPLoginUsage = () => {
  const { 
    loginWithOTP, 
    verifyOTPAndCompleteLogin, 
    otp, 
    isLoading,
    error 
  } = useAuthStore()

  // 📧 EJEMPLO 1: Iniciar login con OTP
  const handleLoginWithOTP = async () => {
    const email = "usuario@ejemplo.com"
    const password = "mipassword123"
    
    console.log('🔄 Iniciando login con OTP...')
    
    const success = await loginWithOTP(email, password)
    
    if (success) {
      console.log('✅ OTP enviado exitosamente')
      toast.success('Código OTP enviado a tu email')
      // La redirección a /otp-verification se maneja automáticamente
    } else {
      console.log('❌ Error en login con OTP')
      toast.error('Error al enviar código OTP')
    }
  }

  // ✅ EJEMPLO 2: Verificar OTP y completar login
  const handleVerifyAndCompleteLogin = async (otpCode: string) => {
    console.log('🔍 Verificando OTP y completando login...')
    
    const success = await verifyOTPAndCompleteLogin(otpCode)
    
    if (success) {
      console.log('🎉 Login completado exitosamente')
      toast.success('¡Bienvenido! Login completado')
      // La redirección al dashboard se maneja automáticamente
    } else {
      console.log('❌ Error verificando OTP o completando login')
      toast.error('Código OTP incorrecto o error en login')
    }
  }

  // 📊 EJEMPLO 3: Verificar estado del OTP
  const checkOTPStatus = () => {
    console.log('📊 Estado actual del OTP:', {
      isRequired: otp.isOTPRequired,
      email: otp.otpEmail,
      purpose: otp.otpPurpose,
      attemptsRemaining: otp.attemptsRemaining,
      hasPendingCredentials: !!otp.pendingLoginCredentials
    })
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Ejemplo de Login con OTP</h2>
      
      {/* Estado actual */}
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-semibold">Estado Actual:</h3>
        <p>OTP Requerido: {otp.isOTPRequired ? 'Sí' : 'No'}</p>
        <p>Email: {otp.otpEmail || 'N/A'}</p>
        <p>Propósito: {otp.otpPurpose}</p>
        <p>Intentos restantes: {otp.attemptsRemaining}</p>
        <p>Credenciales guardadas: {otp.pendingLoginCredentials ? 'Sí' : 'No'}</p>
        <p>Loading: {isLoading ? 'Sí' : 'No'}</p>
        <p>Error: {error || 'Ninguno'}</p>
      </div>

      {/* Botones de ejemplo */}
      <div className="space-y-2">
        <button 
          onClick={handleLoginWithOTP}
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isLoading ? 'Enviando...' : 'Probar Login con OTP'}
        </button>

        <button 
          onClick={() => handleVerifyAndCompleteLogin('123456')}
          disabled={!otp.isOTPRequired || isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isLoading ? 'Verificando...' : 'Verificar OTP (123456)'}
        </button>

        <button 
          onClick={checkOTPStatus}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Ver Estado en Consola
        </button>
      </div>

      {/* Información de desarrollo */}
      <div className="bg-yellow-100 p-4 rounded text-sm">
        <h4 className="font-semibold">Notas para Desarrollo:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>El flujo real se maneja en LoginScreen.tsx</li>
          <li>Las credenciales se guardan temporalmente en otp.pendingLoginCredentials</li>
          <li>Solo se hace login con el SDK DESPUÉS de verificar el OTP</li>
          <li>La redirección automática se maneja con useEffect en las pantallas</li>
          <li>El estado se limpia automáticamente en caso de error o logout</li>
        </ul>
      </div>
    </div>
  )
}

// 🎯 FLUJO COMPLETO DE INTEGRACIÓN:

/*
1. USUARIO ELIGE LOGIN CON OTP:
   - En LoginScreen, activa el toggle 2FA
   - Ingresa email y password
   - Se ejecuta loginWithOTP(email, password)

2. BACKEND PROCESA:
   - Se guardan credenciales temporalmente en el store
   - Se genera OTP y envía por email
   - Se actualiza estado: otp.isOTPRequired = true

3. REDIRECCIÓN AUTOMÁTICA:
   - useEffect en LoginScreen detecta otp.isOTPRequired
   - Redirige a /otp-verification con datos del estado

4. VERIFICACIÓN OTP:
   - Usuario ingresa código de 6 dígitos
   - Se ejecuta verifyOTPAndCompleteLogin(code)
   - Se verifica OTP primero, luego se hace login con SDK

5. LOGIN COMPLETADO:
   - authSDK.login() se ejecuta con credenciales guardadas
   - Se actualiza estado: isAuthenticated = true
   - Se limpia estado OTP
   - Redirección al dashboard

6. LIMPIEZA:
   - otp.pendingLoginCredentials = undefined
   - otp.isOTPRequired = false
   - Estado listo para nuevo flujo
*/

export default ExampleOTPLoginUsage

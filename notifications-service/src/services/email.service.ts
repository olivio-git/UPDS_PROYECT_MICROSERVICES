import { Resend } from 'resend';
import { config } from '../config';
import { EmailSendResult } from '../types';

export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(config.resend.apiKey);
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent?: string,
    from?: string,
    attachments?: Array<{ filename: string; content: Buffer }>
  ): Promise<EmailSendResult> {
    try {
      const fromAddress = from || `${config.resend.fromName} <${config.resend.fromEmail}>`;

      const emailData: any = {
        from: fromAddress,
        to: [to],
        subject,
        html: htmlContent
      };

      if (textContent) {
        emailData.text = textContent;
      }

      if (attachments && attachments.length > 0) {
        emailData.attachments = attachments;
      }

      console.log(`📧 Enviando email a ${to}: ${subject}`);

      const response = await this.resend.emails.send(emailData);

      if (response.error) {
        console.error('❌ Error enviando email:', response.error);
        return {
          success: false,
          error: response.error.message || 'Error enviando email'
        };
      }

      console.log(`✅ Email enviado exitosamente. ID: ${response.data?.id}`);

      return {
        success: true,
        messageId: response.data?.id
      };

    } catch (error: any) {
      console.error('❌ Error enviando email:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido enviando email'
      };
    }
  }

  async sendBulkEmails(emails: Array<{
    to: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
  }>): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    // Procesar en lotes para evitar rate limiting
    const batchSize = config.email.batchSize;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const batchPromises = batch.map(async (email) => {
        return await this.sendEmail(
          email.to,
          email.subject,
          email.htmlContent,
          email.textContent
        );
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Pausa entre lotes si no es el último
      if (i + batchSize < emails.length) {
        await this.delay(1000); // 1 segundo entre lotes
      }
    }

    return results;
  }

  async sendOtpEmail(
    to: string,
    otpCode: string,
    purpose: string,
    expiryMinutes: number
  ): Promise<EmailSendResult> {
    const subject = `Código de verificación - CBA Platform`;

    const htmlContent = this.generateOtpEmailHtml(otpCode, purpose, expiryMinutes);
    const textContent = this.generateOtpEmailText(otpCode, purpose, expiryMinutes);

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  async sendWelcomeEmail(
    to: string,
    firstName: string,
    lastName: string
  ): Promise<EmailSendResult> {
    const subject = `¡Bienvenido a CBA Platform!`;

    const htmlContent = this.generateWelcomeEmailHtml(firstName, lastName);
    const textContent = this.generateWelcomeEmailText(firstName, lastName);

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    firstName: string
  ): Promise<EmailSendResult> {
    const subject = `Restablecimiento de contraseña - CBA Platform`;

    const htmlContent = this.generatePasswordResetEmailHtml(resetToken, firstName);
    const textContent = this.generatePasswordResetEmailText(resetToken, firstName);

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  async sendExamGradedEmail(
    to: string,
    firstName: string,
    lastName: string,
    examName: string,
    score: number,
    maxScore: number,
    percentage: number,
    status: string,
    pdfBase64?: string,
    pdfFilename?: string
  ): Promise<EmailSendResult> {
    const passed = status === 'completed' && percentage >= 60;
    const subject = passed
      ? `✅ Resultado de tu examen: ${examName}`
      : `📋 Resultado de tu examen: ${examName}`;

    const htmlContent = this.generateExamGradedEmailHtml(firstName, lastName, examName, score, maxScore, percentage, passed, !!pdfBase64);
    const textContent = this.generateExamGradedEmailText(firstName, examName, score, maxScore, percentage, passed);

    const attachments: Array<{ filename: string; content: Buffer }> = [];
    if (pdfBase64) {
      attachments.push({
        filename: pdfFilename || `Resultado_${examName.replace(/\s+/g, '_')}.pdf`,
        content: Buffer.from(pdfBase64, 'base64'),
      });
    }

    return await this.sendEmail(to, subject, htmlContent, textContent, undefined, attachments.length > 0 ? attachments : undefined);
  }

  async sendNewUserCredentialsEmail(
    to: string,
    firstName: string,
    lastName: string,
    tempPassword: string
  ): Promise<EmailSendResult> {
    const subject = `Credenciales de acceso - CBA Platform`;

    const htmlContent = this.generateNewUserCredentialsEmailHtml(firstName, lastName, to, tempPassword);
    const textContent = this.generateNewUserCredentialsEmailText(firstName, lastName, to, tempPassword);

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  // HTML Email Templates
  private generateOtpEmailHtml(otpCode: string, purpose: string, expiryMinutes: number): string {
    return `
    <!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu Código de Verificación</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f7;
            color: #1d1d1f;
        }

        .email-container {
            max-width: 500px;
            margin: 40px auto;
            padding: 40px;
            background-color: #ffffff;
            border-radius: 20px;
            border: 1px solid #e8e8e8;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo {
            max-width: 120px;
            margin-bottom: 25px;
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            color: #001E41; /* <<< CBA Azul */
            margin: 0 0 10px 0;
        }

        .subtitle {
            font-size: 17px;
            line-height: 1.5;
            color: #5a5a5f;
            margin: 0;
        }

        .otp-code-wrapper {
            text-align: center;
            margin: 40px 0;
        }

        .otp-code {
            font-size: 48px;
            font-weight: 700;
            color: #001E41; /* <<< CBA Azul */
            letter-spacing: 10px;
            margin: 0;
            font-family: 'SF Mono', 'Courier New', Courier, monospace;
        }

        .instructions {
            font-size: 17px;
            line-height: 1.5;
            color: #5a5a5f;
            text-align: center;
        }
        
        .instructions strong {
            color: #F0003C; /* <<< CBA Rojo para acento de urgencia */
            font-weight: 600;
        }

        .security-note {
            text-align: center;
            font-size: 14px;
            color: #86868b;
            margin-top: 30px;
        }

        .footer-divider {
            border: none;
            height: 1px;
            background-color: #e8e8e8;
            margin: 40px 0;
        }

        .footer {
            text-align: center;
            font-size: 12px;
            color: #86868b;
        }
        .footer strong {
            color: #5a5a5f;
        }
        .footer a {
            color: #001E41; /* <<< CBA Azul */
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="email-container">

        <div class="header">
            <h1 class="title">Tu Código de Verificación</h1>
            <p class="subtitle">Ingresa este código para completar el ${purpose}.</p>
        </div>

        <div class="otp-code-wrapper">
            <p class="otp-code">${otpCode}</p>
        </div>

        <p class="instructions">
            Este código de un solo uso expirará en <strong>${expiryMinutes} minutos</strong>.
        </p>

        <p class="security-note">
            Si no solicitaste este código, puedes ignorar este mensaje de forma segura.
        </p>

        <hr class="footer-divider">

        <div class="footer">
            <p><strong>Centro Boliviano Americano - Tarija</strong></p>
            <p>Este es un mensaje automático, no respondas a este correo.</p>
        </div>

    </div>
</body>
</html>`;
  }

  private generateWelcomeEmailHtml(firstName: string, lastName: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a CBA Platform!</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 40px; border-radius: 0 0 10px 10px; }
            .welcome-box { background: white; padding: 30px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .button { display: inline-block; background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 ¡Bienvenido/a!</h1>
                <p>Centro Boliviano Americano - Tarija</p>
            </div>
            <div class="content">
                <div class="welcome-box">
                    <h2>¡Hola ${firstName} ${lastName}!</h2>
                    <p>Te damos la bienvenida a <strong>CBA Platform</strong>, tu nueva plataforma de evaluación lingüística.</p>
                    
                    <h3>¿Qué puedes hacer ahora?</h3>
                    <ul>
                        <li>📚 Acceder a evaluaciones personalizadas</li>
                        <li>📊 Ver tus resultados y progreso</li>
                        <li>🎯 Recibir retroalimentación detallada</li>
                        <li>📈 Seguir tu desarrollo lingüístico</li>
                    </ul>
                    
                    <p>Estamos emocionados de acompañarte en tu camino hacia el dominio del inglés.</p>
                </div>
                
                <p><strong>¿Necesitas ayuda?</strong><br>
                Nuestro equipo de soporte está aquí para ayudarte en cada paso del camino.</p>
            </div>
            <div class="footer">
                <p>© 2025 Centro Boliviano Americano - Tarija<br>
                Este email fue enviado automáticamente, no respondas a este mensaje.</p>
            </div>
        </div>
    </body>
    </html>`;
  }

  private generatePasswordResetEmailHtml(resetToken: string, firstName: string): string {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecimiento de Contraseña - CBA Platform</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 40px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; text-align: center; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔑 Restablecimiento de Contraseña</h1>
                <p>Centro Boliviano Americano - Tarija</p>
            </div>
            <div class="content">
                <h2>Hola ${firstName},</h2>
                <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en CBA Platform.</p>
                
                <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
                
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
                
                <p>O copia y pega este enlace en tu navegador:</p>
                <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${resetUrl}</p>
                
                <div class="warning">
                    <strong>⚠️ Importante:</strong>
                    <ul>
                        <li>Este enlace expira en 1 hora</li>
                        <li>Solo puede ser usado una vez</li>
                        <li>Si no solicitaste este cambio, ignora este email</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>© 2025 Centro Boliviano Americano - Tarija<br>
                Este email fue enviado automáticamente, no respondas a este mensaje.</p>
            </div>
        </div>
    </body>
    </html>`;
  }

  private generateNewUserCredentialsEmailHtml(
    firstName: string,
    lastName: string,
    email: string,
    tempPassword: string
  ): string {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

    return `
    <!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a la Plataforma CBA</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f7;
            color: #1d1d1f;
        }

        .email-container {
            max-width: 550px;
            margin: 40px auto;
            padding: 40px;
            background-color: #ffffff;
            border-radius: 20px;
            border: 1px solid #e8e8e8;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .title {
            font-size: 28px;
            font-weight: 700;
            color: #001E41; /* <<< CBA Azul */
            margin: 0 0 10px 0;
        }

        .subtitle {
            font-size: 18px;
            line-height: 1.5;
            color: #5a5a5f;
            margin: 0;
        }

        .content-section {
            margin-top: 30px;
            padding-top: 30px;
            border-top: 1px solid #e8e8e8;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #1d1d1f;
            margin-bottom: 20px;
        }

        .credentials-box {
            margin-bottom: 30px;
        }
        
        .credential-item {
            margin-bottom: 15px;
        }
        
        .credential-label {
            font-size: 14px;
            color: #86868b;
            margin-bottom: 5px;
        }
        
        .credential-value {
            font-size: 16px;
            font-family: 'SF Mono', 'Courier New', Courier, monospace;
            padding: 12px;
            background-color: #f5f5f7;
            border-radius: 8px;
            word-break: break-all;
        }

        .cta-button {
            display: block;
            width: fit-content;
            margin: 30px auto;
            padding: 15px 35px;
            background-color: #001E41; /* <<< CBA Azul */
            color: #ffffff;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            border-radius: 12px;
            text-align: center;
        }
        
        .steps-list {
            list-style: none;
            padding-left: 0;
            color: #5a5a5f;
        }
        
        .steps-list li {
            position: relative;
            padding-left: 30px;
            margin-bottom: 15px;
            line-height: 1.5;
        }
        
        .steps-list li::before {
            content: counter(list-item);
            counter-increment: list-item;
            position: absolute;
            left: 0;
            top: 0;
            width: 20px;
            height: 20px;
            line-height: 20px;
            text-align: center;
            background-color: #f5f5f7;
            color: #001E41; /* <<< CBA Azul */
            border-radius: 50%;
            font-size: 12px;
            font-weight: 700;
        }

        .security-note {
            font-size: 14px;
            color: #86868b;
            background-color: #f5f5f7;
            padding: 15px;
            border-radius: 8px;
            line-height: 1.6;
        }
        .security-note strong {
             color: #5a5a5f;
        }

        .footer {
            text-align: center;
            font-size: 12px;
            color: #86868b;
            padding-top: 30px;
            border-top: 1px solid #e8e8e8;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="email-container">

        <div class="header">
            <h1 class="title">¡Bienvenido a la Plataforma CBA!</h1>
            <p class="subtitle">Hola ${firstName} ${lastName}, tu cuenta ha sido creada exitosamente.</p>
        </div>

        <div class="credentials-box">
            <div class="credential-item">
                <div class="credential-label">Tu Usuario (Email)</div>
                <div class="credential-value" style="font-family: Inter, sans-serif;">${email}</div>
            </div>
            <div class="credential-item">
                <div class="credential-label">Tu Contraseña Temporal</div>
                <div class="credential-value">${tempPassword}</div>
            </div>
        </div>

        <a href="${loginUrl}" class="cta-button">Ir a Iniciar Sesión</a>
        
        <div class="content-section">
            <h2 class="section-title">Primeros Pasos Recomendados</h2>
            <ol class="steps-list">
                <li>Usa el botón de arriba para ir a la página de inicio de sesión.</li>
                <li>Ingresa tus credenciales para acceder por primera vez.</li>
                <li>Se te pedirá que establezcas una nueva contraseña personal.</li>
                <li>¡Explora la plataforma!</li>
            </ol>
        </div>

        <div class="content-section">
             <div class="security-note">
                <strong>Nota de Seguridad:</strong> Por tu protección, es fundamental que cambies tu contraseña temporal inmediatamente. Nunca compartas tus credenciales de acceso.
             </div>
        </div>

        <div class="footer">
            <p>© 2025 Centro Boliviano Americano - Tarija</p>
        </div>

    </div>
</body>
</html>`;
  }

  private generateExamGradedEmailHtml(
    firstName: string,
    lastName: string,
    examName: string,
    score: number,
    maxScore: number,
    percentage: number,
    passed: boolean,
    hasPdf: boolean = false
  ): string {
    const resultColor = passed ? '#16a34a' : '#dc2626';
    const resultBg = passed ? '#f0fdf4' : '#fef2f2';
    const resultBorder = passed ? '#86efac' : '#fca5a5';
    const resultText = passed ? '¡Aprobado!' : 'No Aprobado';
    const resultIcon = passed ? '✅' : '📋';
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/results`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultado de tu examen - CBA Platform</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0; padding: 0; background-color: #f5f5f7; color: #1d1d1f;
            -webkit-font-smoothing: antialiased;
        }
        .email-container {
            max-width: 540px; margin: 40px auto; padding: 40px;
            background-color: #ffffff; border-radius: 20px; border: 1px solid #e8e8e8;
        }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 26px; font-weight: 700; color: #001E41; margin: 0 0 8px 0; }
        .subtitle { font-size: 16px; color: #5a5a5f; margin: 0; }
        .result-box {
            background-color: ${resultBg}; border: 1px solid ${resultBorder};
            border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;
        }
        .result-icon { font-size: 40px; margin-bottom: 8px; }
        .result-label { font-size: 22px; font-weight: 700; color: ${resultColor}; margin: 0 0 4px 0; }
        .exam-name { font-size: 15px; color: #5a5a5f; margin: 0; }
        .score-grid {
            display: flex; gap: 16px; margin: 24px 0;
        }
        .score-card {
            flex: 1; background-color: #f5f5f7; border-radius: 10px;
            padding: 16px; text-align: center;
        }
        .score-value { font-size: 28px; font-weight: 700; color: #001E41; margin: 0; }
        .score-label { font-size: 12px; color: #86868b; margin: 4px 0 0 0; }
        .progress-bar-track {
            background-color: #e8e8e8; border-radius: 99px; height: 10px; margin: 20px 0 8px;
        }
        .progress-bar-fill {
            background-color: ${resultColor}; border-radius: 99px; height: 10px;
            width: ${Math.min(percentage, 100).toFixed(0)}%;
        }
        .progress-label { font-size: 13px; color: #86868b; text-align: right; margin: 0; }
        .cta-button {
            display: block; width: fit-content; margin: 28px auto;
            padding: 14px 32px; background-color: #001E41; color: #ffffff;
            font-size: 15px; font-weight: 600; text-decoration: none;
            border-radius: 10px; text-align: center;
        }
        .footer {
            text-align: center; font-size: 12px; color: #86868b;
            padding-top: 28px; border-top: 1px solid #e8e8e8; margin-top: 36px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1 class="title">${resultIcon} Resultado de tu Examen</h1>
            <p class="subtitle">Hola ${firstName} ${lastName}, tu evaluación ha sido calificada.</p>
        </div>

        <div class="result-box">
            <p class="exam-name" style="font-size:17px; font-weight:600; color:#1d1d1f; margin:0;">${examName}</p>
        </div>

        <div class="score-grid">
            <div class="score-card">
                <p class="score-value">${score}/${maxScore}</p>
                <p class="score-label">Puntaje Obtenido</p>
            </div>
            <div class="score-card">
                <p class="score-value" style="color: ${resultColor};">${percentage.toFixed(1)}%</p>
                <p class="score-label">Porcentaje</p>
            </div>
        </div>

        <div class="progress-bar-track">
            <div class="progress-bar-fill"></div>
        </div>
        <p class="progress-label">${percentage.toFixed(1)}% completado</p>

        ${hasPdf
          ? `<p style="text-align:center; font-size:14px; color:#5a5a5f; margin: 20px 0;">📎 Tu resultado detallado está adjunto en este correo como PDF.</p>`
          : `<a href="${loginUrl}" class="cta-button">Ver Resultados Detallados</a>`
        }

        <div class="footer">
            <p><strong>Centro Boliviano Americano - Tarija</strong></p>
            <p>Este es un mensaje automático, no respondas a este correo.</p>
            <p>© 2025 CBA Platform</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Text Email Templates
  private generateExamGradedEmailText(
    firstName: string,
    examName: string,
    score: number,
    maxScore: number,
    percentage: number,
    passed: boolean
  ): string {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/results`;
    return `
CBA Platform - Resultado de tu Examen

Hola ${firstName},

Tu examen ha sido calificado.

Examen: ${examName}
Puntaje: ${score}/${maxScore}
Porcentaje: ${percentage.toFixed(1)}%

Para ver tus resultados detallados, visita:
${loginUrl}

© 2025 Centro Boliviano Americano - Tarija
Este email fue enviado automáticamente, no respondas a este mensaje.
    `;
  }

  private generateOtpEmailText(otpCode: string, purpose: string, expiryMinutes: number): string {
    return `
CBA Platform - Código de Verificación

Tu código de verificación: ${otpCode}

Hemos recibido una solicitud de ${purpose} para tu cuenta.

Instrucciones:
- Ingresa este código en la aplicación
- El código expira en ${expiryMinutes} minutos
- No compartas este código con nadie

⚠️ IMPORTANTE: Si no solicitaste este código, ignora este email o contacta a soporte inmediatamente.

© 2025 Centro Boliviano Americano - Tarija
Este email fue enviado automáticamente, no respondas a este mensaje.
    `;
  }

  private generateWelcomeEmailText(firstName: string, lastName: string): string {
    return `
CBA Platform - ¡Bienvenido/a!

¡Hola ${firstName} ${lastName}!

Te damos la bienvenida a CBA Platform, tu nueva plataforma de evaluación lingüística.

¿Qué puedes hacer ahora?
- Acceder a evaluaciones personalizadas
- Ver tus resultados y progreso
- Recibir retroalimentación detallada
- Seguir tu desarrollo lingüístico

Estamos emocionados de acompañarte en tu camino hacia el dominio del inglés.

¿Necesitas ayuda?
Nuestro equipo de soporte está aquí para ayudarte en cada paso del camino.

© 2025 Centro Boliviano Americano - Tarija
Este email fue enviado automáticamente, no respondas a este mensaje.
    `;
  }

  private generatePasswordResetEmailText(resetToken: string, firstName: string): string {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    return `
CBA Platform - Restablecimiento de Contraseña

Hola ${firstName},

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en CBA Platform.

Para crear una nueva contraseña, visita este enlace:
${resetUrl}

⚠️ IMPORTANTE:
- Este enlace expira en 1 hora
- Solo puede ser usado una vez
- Si no solicitaste este cambio, ignora este email

© 2025 Centro Boliviano Americano - Tarija
Este email fue enviado automáticamente, no respondas a este mensaje.
    `;
  }

  private generateNewUserCredentialsEmailText(
    firstName: string,
    lastName: string,
    email: string,
    tempPassword: string
  ): string {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

    return `
CBA Platform - Credenciales de Acceso

¡Hola ${firstName} ${lastName}!

Te damos la bienvenida a CBA Platform. Tu cuenta ha sido creada exitosamente.

Tus credenciales de acceso:
- Usuario (Email): ${email}
- Contraseña temporal: ${tempPassword}

Primeros pasos:
1. Inicia sesión con las credenciales de arriba
2. Cambia tu contraseña temporal por una personal
3. Completa tu perfil si es necesario
4. ¡Comienza a usar la plataforma!

Enlace de acceso: ${loginUrl}

⚠️ IMPORTANTE:
- Cambia tu contraseña temporal en el primer inicio de sesión
- No compartas estas credenciales con nadie
- Guarda esta información en un lugar seguro

Estamos emocionados de tenerte en nuestro equipo. ¡Bienvenido a bordo!

© 2025 Centro Boliviano Americano - Tarija
Este email fue enviado automáticamente, no respondas a este mensaje.
    `;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

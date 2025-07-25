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
    from?: string
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

  // HTML Email Templates
  private generateOtpEmailHtml(otpCode: string, purpose: string, expiryMinutes: number): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de Verificación - CBA Platform</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 40px; border-radius: 0 0 10px 10px; }
            .otp-code { background: #007bff; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 30px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Código de Verificación</h1>
                <p>Centro Boliviano Americano - Tarija</p>
            </div>
            <div class="content">
                <h2>Tu código de verificación</h2>
                <p>Hemos recibido una solicitud de <strong>${purpose}</strong> para tu cuenta.</p>
                
                <div class="otp-code">${otpCode}</div>
                
                <p><strong>Instrucciones:</strong></p>
                <ul>
                    <li>Ingresa este código en la aplicación</li>
                    <li>El código expira en <strong>${expiryMinutes} minutos</strong></li>
                    <li>No compartas este código con nadie</li>
                </ul>
                
                <div class="warning">
                    <strong>⚠️ Importante:</strong> Si no solicitaste este código, ignora este email o contacta a soporte inmediatamente.
                </div>
                
                <p>Gracias por usar CBA Platform.</p>
            </div>
            <div class="footer">
                <p>© 2025 Centro Boliviano Americano - Tarija<br>
                Este email fue enviado automáticamente, no respondas a este mensaje.</p>
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

  // Text Email Templates
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

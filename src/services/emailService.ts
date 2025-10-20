import { sendEmail } from '../utils/email';

export class EmailService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmail(email: string, token: string, userName?: string): Promise<void> {
    const verifyUrl = `${this.baseUrl}/profile?verify_token=${encodeURIComponent(token)}`;
    const displayName = userName || email;

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Подтверждение email</h2>
        <p>Здравствуйте, ${displayName}!</p>
        <p>Для завершения регистрации подтвердите вашу почту, нажав на кнопку ниже.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2d7; color:#fff; text-decoration:none; border-radius:6px;">Подтвердить email</a>
        </p>
        <p>Если кнопка не работает, перейдите по ссылке: <br/> ${verifyUrl}</p>
      </div>
    `;

    await sendEmail(email, 'Подтверждение email — Хронониндзя', html);
  }

  /**
   * Send password reset email to user
   */
  async sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const displayName = userName || email;

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Восстановление пароля</h2>
        <p>Здравствуйте, ${displayName}!</p>
        <p>Вы запросили сброс пароля. Нажмите на кнопку ниже, чтобы установить новый пароль.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#d44; color:#fff; text-decoration:none; border-radius:6px;">Сбросить пароль</a>
        </p>
        <p>Если кнопка не работает, перейдите по ссылке: <br/> ${resetUrl}</p>
        <p style="color:#666; font-size:0.9em; margin-top:20px;">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
      </div>
    `;

    await sendEmail(email, 'Восстановление пароля — Хронониндзя', html);
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    const displayName = userName || email;

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Добро пожаловать в Хронониндзя!</h2>
        <p>Здравствуйте, ${displayName}!</p>
        <p>Ваш email успешно подтвержден. Теперь вы можете в полной мере пользоваться всеми возможностями сервиса:</p>
        <ul>
          <li>Изучать исторические личности</li>
          <li>Проходить викторины</li>
          <li>Участвовать в рейтинге</li>
          <li>Добавлять новые личности и достижения</li>
        </ul>
        <p>
          <a href="${this.baseUrl}/menu" style="display:inline-block;padding:10px 16px;background:#2d7; color:#fff; text-decoration:none; border-radius:6px;">Перейти в приложение</a>
        </p>
      </div>
    `;

    await sendEmail(email, 'Добро пожаловать — Хронониндзя', html);
  }
}

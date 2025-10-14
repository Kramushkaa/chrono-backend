import TelegramBot from 'node-telegram-bot-api';

export class TelegramService {
  private bot: TelegramBot | null = null;
  private adminChatId: string;
  private isEnabled: boolean = false;

  constructor(botToken?: string, adminChatId?: string) {
    this.adminChatId = adminChatId || '';

    if (botToken && adminChatId) {
      try {
        this.bot = new TelegramBot(botToken, { polling: false });
        this.isEnabled = true;
        console.log('✅ Telegram notifications service initialized');
      } catch (error) {
        console.warn('⚠️  Telegram service initialization failed:', error);
        this.isEnabled = false;
      }
    } else {
      console.warn('⚠️  Telegram notifications disabled: missing token or chat ID');
    }
  }

  /**
   * Отправка уведомления о регистрации нового пользователя
   */
  async notifyNewRegistration(userEmail: string, username?: string, fullName?: string): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const displayName = fullName || username || userEmail;
    const usernameText = username ? `\n👤 Username: ${username}` : '';
    const fullNameText = fullName ? `\n📝 Имя: ${fullName}` : '';

    const message = `
🎉 <b>Новая регистрация!</b>

📧 Email: ${userEmail}${usernameText}${fullNameText}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: new registration (${userEmail})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (registration):', error);
    }
  }

  /**
   * Отправка уведомления об отправке письма подтверждения email
   */
  async notifyVerificationEmailSent(userEmail: string, isResend: boolean = false): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const action = isResend ? 'Повторная отправка' : 'Отправка';
    const emoji = isResend ? '🔄' : '📨';

    const message = `
${emoji} <b>${action} письма подтверждения</b>

📧 Email: ${userEmail}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: verification email (${userEmail})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (verification email):', error);
    }
  }

  /**
   * Отправка уведомления о подтверждении email
   */
  async notifyEmailVerified(userEmail: string, username?: string): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const displayName = username || userEmail;
    const usernameText = username ? `\n👤 Username: ${username}` : '';

    const message = `
✅ <b>Email подтверждён!</b>

📧 Email: ${userEmail}${usernameText}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: email verified (${userEmail})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (email verified):', error);
    }
  }

  /**
   * Отправка тестового сообщения
   */
  async sendTestMessage(): Promise<void> {
    if (!this.isEnabled || !this.bot) {
      console.warn('⚠️  Telegram service is not enabled');
      return;
    }

    const message = `
🤖 <b>Тестовое сообщение</b>

Telegram notifications работают корректно!

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log('✅ Test Telegram message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send test Telegram message:', error);
      throw error;
    }
  }
}


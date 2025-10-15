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
  async notifyNewRegistration(
    userEmail: string,
    username?: string,
    fullName?: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const _displayName = fullName || username || userEmail;
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

    const _displayName = username || userEmail;
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
   * Отправка уведомления о создании новой личности
   */
  async notifyPersonCreated(
    personName: string,
    creatorEmail: string,
    status: 'pending' | 'approved',
    personId: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = status === 'approved' ? '✅' : '⏳';
    const statusText = status === 'approved' ? 'создана и одобрена' : 'отправлена на модерацию';

    const message = `
${emoji} <b>Новая личность ${statusText}</b>

👤 Имя: ${personName}
📧 Автор: ${creatorEmail}
🆔 ID: ${personId}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: person created (${personName})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (person created):', error);
    }
  }

  /**
   * Отправка уведомления о предложении изменений в личности
   */
  async notifyPersonEditProposed(
    personName: string,
    proposerEmail: string,
    personId: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const message = `
✏️ <b>Предложены изменения в личности</b>

👤 Личность: ${personName}
📧 Автор правок: ${proposerEmail}
🆔 ID: ${personId}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: person edit proposed (${personName})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (person edit):', error);
    }
  }

  /**
   * Отправка уведомления о решении модератора по личности
   */
  async notifyPersonReviewed(
    personName: string,
    action: 'approve' | 'reject',
    reviewerEmail: string,
    personId: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = action === 'approve' ? '✅' : '❌';
    const actionText = action === 'approve' ? 'одобрена' : 'отклонена';

    const message = `
${emoji} <b>Личность ${actionText}</b>

👤 Имя: ${personName}
👨‍⚖️ Модератор: ${reviewerEmail}
🆔 ID: ${personId}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: person ${action} (${personName})`);
    } catch (error) {
      console.error(`❌ Failed to send Telegram notification (person ${action}):`, error);
    }
  }

  /**
   * Отправка уведомления о создании достижения
   */
  async notifyAchievementCreated(
    description: string,
    year: number,
    creatorEmail: string,
    status: 'pending' | 'approved',
    personName?: string,
    countryName?: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = status === 'approved' ? '✅' : '⏳';
    const statusText = status === 'approved' ? 'создано и одобрено' : 'отправлено на модерацию';
    const contextLine = personName
      ? `\n👤 Личность: ${personName}`
      : countryName
        ? `\n🌍 Страна: ${countryName}`
        : '';

    const message = `
${emoji} <b>Новое достижение ${statusText}</b>

📅 Год: ${year}
📝 ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}${contextLine}
📧 Автор: ${creatorEmail}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: achievement created (${year})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (achievement created):', error);
    }
  }

  /**
   * Отправка уведомления о решении модератора по достижению
   */
  async notifyAchievementReviewed(
    description: string,
    year: number,
    action: 'approve' | 'reject',
    reviewerEmail: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = action === 'approve' ? '✅' : '❌';
    const actionText = action === 'approve' ? 'одобрено' : 'отклонено';

    const message = `
${emoji} <b>Достижение ${actionText}</b>

📅 Год: ${year}
📝 ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}
👨‍⚖️ Модератор: ${reviewerEmail}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: achievement ${action} (${year})`);
    } catch (error) {
      console.error(`❌ Failed to send Telegram notification (achievement ${action}):`, error);
    }
  }

  /**
   * Отправка уведомления о создании периода
   */
  async notifyPeriodCreated(
    periodType: string,
    startYear: number,
    endYear: number,
    creatorEmail: string,
    status: 'pending' | 'approved',
    personName?: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = status === 'approved' ? '✅' : '⏳';
    const statusText = status === 'approved' ? 'создан и одобрен' : 'отправлен на модерацию';
    const personLine = personName ? `\n👤 Личность: ${personName}` : '';

    const message = `
${emoji} <b>Новый период ${statusText}</b>

📊 Тип: ${periodType}
📅 Годы: ${startYear}–${endYear}${personLine}
📧 Автор: ${creatorEmail}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: period created (${startYear}-${endYear})`);
    } catch (error) {
      console.error('❌ Failed to send Telegram notification (period created):', error);
    }
  }

  /**
   * Отправка уведомления о решении модератора по периоду
   */
  async notifyPeriodReviewed(
    periodType: string,
    startYear: number,
    endYear: number,
    action: 'approve' | 'reject',
    reviewerEmail: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = action === 'approve' ? '✅' : '❌';
    const actionText = action === 'approve' ? 'одобрен' : 'отклонен';

    const message = `
${emoji} <b>Период ${actionText}</b>

📊 Тип: ${periodType}
📅 Годы: ${startYear}–${endYear}
👨‍⚖️ Модератор: ${reviewerEmail}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      console.log(`✅ Telegram notification sent: period ${action} (${startYear}-${endYear})`);
    } catch (error) {
      console.error(`❌ Failed to send Telegram notification (period ${action}):`, error);
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

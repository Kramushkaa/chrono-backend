import { Telegraf } from 'telegraf';
import { logger } from '../utils/logger';

export class TelegramService {
  private bot: Telegraf | null = null;
  private adminChatId: string;
  private isEnabled: boolean = false;

  constructor(botToken?: string, adminChatId?: string) {
    this.adminChatId = adminChatId || '';

    if (botToken && adminChatId) {
      try {
        this.bot = new Telegraf(botToken);
        this.isEnabled = true;
        logger.info('Telegram notifications service initialized (Telegraf)');
      } catch (error) {
        logger.error('Telegram service initialization failed', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.isEnabled = false;
      }
    } else {
      logger.warn('Telegram notifications disabled: missing token or chat ID');
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: new registration', { userEmail });
    } catch (error) {
      logger.error('Failed to send Telegram notification (registration)', {
        error: error instanceof Error ? error : new Error(String(error)),
        userEmail,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: verification email', { userEmail, isResend });
    } catch (error) {
      logger.error('Failed to send Telegram notification (verification email)', {
        error: error instanceof Error ? error : new Error(String(error)),
        userEmail,
        isResend,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: email verified', { userEmail, username });
    } catch (error) {
      logger.error('Failed to send Telegram notification (email verified)', {
        error: error instanceof Error ? error : new Error(String(error)),
        userEmail,
        username,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: person created', {
        personName,
        creatorEmail,
        status,
        personId,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (person created)', {
        error: error instanceof Error ? error : new Error(String(error)),
        personName,
        creatorEmail,
        status,
        personId,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: person edit proposed', {
        personName,
        proposerEmail,
        personId,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (person edit)', {
        error: error instanceof Error ? error : new Error(String(error)),
        personName,
        proposerEmail,
        personId,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: person reviewed', {
        personName,
        action,
        reviewerEmail,
        personId,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (person reviewed)', {
        error: error instanceof Error ? error : new Error(String(error)),
        personName,
        action,
        reviewerEmail,
        personId,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: achievement created', {
        description,
        year,
        creatorEmail,
        status,
        personName,
        countryName,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (achievement created)', {
        error: error instanceof Error ? error : new Error(String(error)),
        description,
        year,
        creatorEmail,
        status,
        personName,
        countryName,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: achievement reviewed', {
        description,
        year,
        action,
        reviewerEmail,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (achievement reviewed)', {
        error: error instanceof Error ? error : new Error(String(error)),
        description,
        year,
        action,
        reviewerEmail,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: period created', {
        periodType,
        startYear,
        endYear,
        creatorEmail,
        status,
        personName,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (period created)', {
        error: error instanceof Error ? error : new Error(String(error)),
        periodType,
        startYear,
        endYear,
        creatorEmail,
        status,
        personName,
      });
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
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: period reviewed', {
        periodType,
        startYear,
        endYear,
        action,
        reviewerEmail,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (period reviewed)', {
        error: error instanceof Error ? error : new Error(String(error)),
        periodType,
        startYear,
        endYear,
        action,
        reviewerEmail,
      });
    }
  }

  /**
   * Отправка уведомления о запросе публикации списка
   */
  async notifyListPublicationRequested(
    listTitle: string,
    ownerEmail: string,
    listId: number,
    itemsCount: number
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const message = `
⏳ <b>Список отправлен на модерацию</b>

📋 Название: ${listTitle}
📧 Владелец: ${ownerEmail}
📊 Элементов: ${itemsCount}
🆔 ID: ${listId}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: list publication requested', {
        listTitle,
        ownerEmail,
        listId,
        itemsCount,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (list publication requested)', {
        error: error instanceof Error ? error : new Error(String(error)),
        listTitle,
        ownerEmail,
        listId,
      });
    }
  }

  /**
   * Отправка уведомления о решении модератора по списку
   */
  async notifyListReviewed(
    listTitle: string,
    action: 'approve' | 'reject',
    moderatorEmail: string,
    listId: number,
    slug?: string
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emoji = action === 'approve' ? '✅' : '❌';
    const actionText = action === 'approve' ? 'опубликован' : 'отклонён';
    const slugLine = slug && action === 'approve' ? `\n🔗 Slug: ${slug}` : '';

    const message = `
${emoji} <b>Список ${actionText}</b>

📋 Название: ${listTitle}
👨‍⚖️ Модератор: ${moderatorEmail}
🆔 ID: ${listId}${slugLine}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram notification sent: list reviewed', {
        listTitle,
        action,
        moderatorEmail,
        listId,
        slug,
      });
    } catch (error) {
      logger.error('Failed to send Telegram notification (list reviewed)', {
        error: error instanceof Error ? error : new Error(String(error)),
        listTitle,
        action,
        moderatorEmail,
        listId,
      });
    }
  }

  /**
   * Отправка security alert
   */
  async sendSecurityAlert(
    event: string,
    details: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const emojiMap = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };

    const emoji = emojiMap[severity];
    const detailsText = Object.entries(details)
      .map(([key, value]) => `  • ${key}: ${String(value)}`)
      .join('\n');

    const message = `
${emoji} <b>Security Alert [${severity.toUpperCase()}]</b>

📢 Event: ${event}

${detailsText}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram security alert sent', { event, severity });
    } catch (error) {
      logger.error('Failed to send Telegram security alert', {
        error: error instanceof Error ? error : new Error(String(error)),
        event,
        severity,
      });
    }
  }

  /**
   * Отправка error alert
   */
  async sendErrorAlert(error: Error, context: Record<string, unknown>): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const contextText = Object.entries(context)
      .map(([key, value]) => `  • ${key}: ${String(value)}`)
      .join('\n');

    const errorMessage = error.message.substring(0, 200);
    const stackPreview = error.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace';

    const message = `
🔴 <b>Error Alert</b>

❌ Error: ${errorMessage}

Context:
${contextText}

Stack:
<code>${stackPreview.substring(0, 200)}</code>

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram error alert sent', { errorMessage: error.message });
    } catch (sendError) {
      logger.error('Failed to send Telegram error alert', {
        error: sendError instanceof Error ? sendError : new Error(String(sendError)),
        originalError: error.message,
      });
    }
  }

  /**
   * Отправка performance alert
   */
  async sendPerformanceAlert(
    metric: string,
    value: number,
    threshold: number,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isEnabled || !this.bot) return;

    const contextText = context
      ? '\n\nContext:\n' +
        Object.entries(context)
          .map(([key, val]) => `  • ${key}: ${String(val)}`)
          .join('\n')
      : '';

    const message = `
⚡ <b>Performance Alert</b>

📊 Metric: ${metric}
📈 Value: ${value}
⚠️ Threshold: ${threshold}${contextText}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Telegram performance alert sent', { metric, value, threshold });
    } catch (error) {
      logger.error('Failed to send Telegram performance alert', {
        error: error instanceof Error ? error : new Error(String(error)),
        metric,
        value,
        threshold,
      });
    }
  }

  /**
   * Отправка тестового сообщения
   */
  async sendTestMessage(): Promise<void> {
    if (!this.isEnabled || !this.bot) {
      logger.warn('Telegram service is not enabled');
      return;
    }

    const message = `
🤖 <b>Тестовое сообщение</b>

Telegram notifications работают корректно!

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
`.trim();

    try {
      await this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'HTML' });
      logger.info('Test Telegram message sent successfully');
    } catch (error) {
      logger.error('Failed to send test Telegram message', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }
}

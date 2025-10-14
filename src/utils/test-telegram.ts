import dotenv from 'dotenv';
import { TelegramService } from '../services/telegramService';
import { config } from '../config';

// Загрузка переменных окружения
dotenv.config();

async function testTelegramNotifications() {
  console.log('🤖 Testing Telegram notifications...\n');

  const telegramService = new TelegramService(
    config.telegram.botToken,
    config.telegram.adminChatId
  );

  try {
    // Тест 1: Отправка тестового сообщения
    console.log('📨 Test 1: Sending test message...');
    await telegramService.sendTestMessage();
    console.log('✅ Test message sent successfully!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 2: Уведомление о регистрации
    console.log('📨 Test 2: Testing registration notification...');
    await telegramService.notifyNewRegistration(
      'test@example.com',
      'testuser',
      'Test User'
    );
    console.log('✅ Registration notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 3: Уведомление об отправке письма подтверждения
    console.log('📨 Test 3: Testing verification email notification...');
    await telegramService.notifyVerificationEmailSent('test@example.com', false);
    console.log('✅ Verification email notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 4: Уведомление о подтверждении email
    console.log('📨 Test 4: Testing email verified notification...');
    await telegramService.notifyEmailVerified('test@example.com', 'testuser');
    console.log('✅ Email verified notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 5: Повторная отправка письма подтверждения
    console.log('📨 Test 5: Testing resend verification notification...');
    await telegramService.notifyVerificationEmailSent('test@example.com', true);
    console.log('✅ Resend verification notification sent!\n');

    console.log('🎉 All tests completed successfully!');
    console.log(`\n📱 Check your Telegram chat (ID: ${config.telegram.adminChatId}) for notifications.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testTelegramNotifications();


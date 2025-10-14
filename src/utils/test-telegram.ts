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

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 6: Создание личности (pending)
    console.log('📨 Test 6: Testing person created notification (pending)...');
    await telegramService.notifyPersonCreated('Тестовая Личность', 'user@test.com', 'pending', 'test-person-id');
    console.log('✅ Person created notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 7: Создание личности модератором (approved)
    console.log('📨 Test 7: Testing person created notification (approved)...');
    await telegramService.notifyPersonCreated('Другая Личность', 'moderator@test.com', 'approved', 'test-person-2');
    console.log('✅ Person approved notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 8: Предложение изменений в личности
    console.log('📨 Test 8: Testing person edit proposed notification...');
    await telegramService.notifyPersonEditProposed('Известная Личность', 'editor@test.com', 'existing-person-id');
    console.log('✅ Person edit proposed notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 9: Принятие личности модератором
    console.log('📨 Test 9: Testing person approved notification...');
    await telegramService.notifyPersonReviewed('Тестовая Личность', 'approve', 'moderator@test.com', 'test-person-id');
    console.log('✅ Person approved notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 10: Отклонение личности модератором
    console.log('📨 Test 10: Testing person rejected notification...');
    await telegramService.notifyPersonReviewed('Плохая Личность', 'reject', 'moderator@test.com', 'bad-person-id');
    console.log('✅ Person rejected notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 11: Создание достижения
    console.log('📨 Test 11: Testing achievement created notification...');
    await telegramService.notifyAchievementCreated('Изобрел электричество', 1879, 'user@test.com', 'pending', 'Томас Эдисон');
    console.log('✅ Achievement created notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 12: Принятие достижения модератором
    console.log('📨 Test 12: Testing achievement approved notification...');
    await telegramService.notifyAchievementReviewed('Открыл Америку', 1492, 'approve', 'moderator@test.com');
    console.log('✅ Achievement approved notification sent!\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 13: Создание периода
    console.log('📨 Test 13: Testing period created notification...');
    await telegramService.notifyPeriodCreated('ruler', 1533, 1584, 'user@test.com', 'pending', 'Иван Грозный');
    console.log('✅ Period created notification sent!\n');

    console.log('🎉 All tests completed successfully!');
    console.log(`\n📱 Check your Telegram chat (ID: ${config.telegram.adminChatId}) for 13 notifications.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testTelegramNotifications();


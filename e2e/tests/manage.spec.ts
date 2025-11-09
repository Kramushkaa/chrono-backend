import { test, expect } from '../fixtures/auth-fixtures';
import { ManagePage } from '../pages/ManagePage';
import { createTestPerson, createTestAchievement, createTestPeriod } from '../utils/test-data-factory';

test.describe('Управление контентом', () => {
  test('создание новой личности', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const person = createTestPerson();
    
    await managePage.goto();
    await managePage.createPerson(person);
    
    await managePage.expectPersonInList(person.name);
  });

  test('создание достижения', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const achievement = createTestAchievement();
    
    await managePage.goto();
    await managePage.createAchievement(achievement);
  });

  test('создание периода жизни', async ({ authenticatedPage }) => {
    const managePage = new ManagePage(authenticatedPage);
    const period = createTestPeriod();
    
    await managePage.goto();
    await managePage.createPeriod(period);
  });
});


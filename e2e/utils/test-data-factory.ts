import { TestUser, TestPerson, TestAchievement, TestPeriod, TestList } from '../types';

/**
 * Фабрики для создания тестовых данных
 */

let userCounter = 0;
let personCounter = 0;
let achievementCounter = 0;
let periodCounter = 0;
let listCounter = 0;

/**
 * Создание уникального тестового пользователя
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  userCounter++;
  const timestamp = Date.now();
  
  return {
    username: `testuser${userCounter}_${timestamp}`,
    email: `testuser${userCounter}_${timestamp}@test.com`,
    password: 'Test123!',
    role: 'user',
    ...overrides,
  };
}

/**
 * Создание тестового администратора
 */
export function createTestAdmin(overrides?: Partial<TestUser>): TestUser {
  return createTestUser({ role: 'admin', ...overrides });
}

/**
 * Создание тестового модератора
 */
export function createTestModerator(overrides?: Partial<TestUser>): TestUser {
  return createTestUser({ role: 'moderator', ...overrides });
}

/**
 * Создание тестовой личности
 */
export function createTestPerson(overrides?: Partial<TestPerson>): TestPerson {
  personCounter++;
  const timestamp = Date.now();
  
  const categories = ['scientists', 'politicians', 'writers', 'artists', 'entrepreneurs'];
  const countries = ['Россия', 'США', 'Германия', 'Великобритания', 'Франция'];
  const occupations = ['Учёный', 'Политик', 'Писатель', 'Художник', 'Предприниматель'];
  
  const category = categories[personCounter % categories.length];
  const country = countries[personCounter % countries.length];
  const occupation = occupations[personCounter % occupations.length];
  
  return {
    id: `test-person-${personCounter}-${timestamp}`,
    name: `Тестовая Личность ${personCounter}`,
    birth_year: 1800 + (personCounter % 200),
    death_year: 1850 + (personCounter % 200),
    category,
    country,
    occupation,
    bio: `Биография тестовой личности ${personCounter}`,
    wiki_link: `https://ru.wikipedia.org/wiki/Test_Person_${personCounter}`,
    ...overrides,
  };
}

/**
 * Создание тестового достижения
 */
export function createTestAchievement(overrides?: Partial<TestAchievement>): TestAchievement {
  achievementCounter++;
  
  return {
    year: 1900 + (achievementCounter % 120),
    title: `Тестовое достижение ${achievementCounter}`,
    description: `Описание тестового достижения ${achievementCounter}`,
    ...overrides,
  };
}

/**
 * Создание тестового периода жизни
 */
export function createTestPeriod(overrides?: Partial<TestPeriod>): TestPeriod {
  periodCounter++;
  
  const startYear = 1900 + (periodCounter * 5);
  
  return {
    start_year: startYear,
    end_year: startYear + 5,
    title: `Тестовый период ${periodCounter}`,
    description: `Описание тестового периода ${periodCounter}`,
    location: `Тестовая локация ${periodCounter}`,
    ...overrides,
  };
}

/**
 * Создание тестового списка
 */
export function createTestList(overrides?: Partial<TestList>): TestList {
  listCounter++;
  const timestamp = Date.now();
  
  return {
    title: `Тестовый список ${listCounter} ${timestamp}`,
    moderation_status: 'draft',
    ...overrides,
  };
}

/**
 * Создание набора связанных данных (личность + достижения + периоды)
 */
export function createPersonWithRelations(overrides?: {
  person?: Partial<TestPerson>;
  achievementsCount?: number;
  periodsCount?: number;
}) {
  const person = createTestPerson(overrides?.person);
  
  const achievements = Array.from(
    { length: overrides?.achievementsCount || 2 },
    () => createTestAchievement({ person_id: person.id })
  );
  
  const periods = Array.from(
    { length: overrides?.periodsCount || 2 },
    () => createTestPeriod({ person_id: person.id })
  );
  
  return { person, achievements, periods };
}

/**
 * Сброс счётчиков (для изоляции тестов)
 */
export function resetCounters(): void {
  userCounter = 0;
  personCounter = 0;
  achievementCounter = 0;
  periodCounter = 0;
  listCounter = 0;
}


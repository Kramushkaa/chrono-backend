import { getAuthHeaders } from '../helpers/auth-helper';
import { TestPerson, TestAchievement, TestPeriod, TestList, TestListItem } from '../types';

/**
 * API клиент для взаимодействия с бэкендом в E2E тестах
 */

const DEFAULT_API_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export class ApiClient {
  private apiUrl: string;
  private accessToken?: string;

  constructor(apiUrl: string = DEFAULT_API_URL, accessToken?: string) {
    this.apiUrl = apiUrl;
    this.accessToken = accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private getHeaders(): Record<string, string> {
    if (this.accessToken) {
      return getAuthHeaders(this.accessToken);
    }
    return { 'Content-Type': 'application/json' };
  }

  // ============================================================================
  // Persons API
  // ============================================================================

  async createPerson(person: TestPerson): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/persons`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(person),
    });
    return response.json();
  }

  async getPersons(params?: { category?: string; country?: string }): Promise<any> {
    const queryParams = new URLSearchParams(params as any);
    const response = await fetch(`${this.apiUrl}/api/persons?${queryParams}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async getPerson(id: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/persons/${id}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async updatePerson(id: string, updates: Partial<TestPerson>): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/persons/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    return response.json();
  }

  async deletePerson(id: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/persons/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async submitPersonForModeration(id: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/persons/${id}/submit`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  // ============================================================================
  // Achievements API
  // ============================================================================

  async createAchievement(achievement: TestAchievement): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/achievements`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(achievement),
    });
    return response.json();
  }

  async getAchievements(personId?: string): Promise<any> {
    const url = personId
      ? `${this.apiUrl}/api/achievements?person_id=${personId}`
      : `${this.apiUrl}/api/achievements`;
    const response = await fetch(url, { headers: this.getHeaders() });
    return response.json();
  }

  async updateAchievement(id: number, updates: Partial<TestAchievement>): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/achievements/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    return response.json();
  }

  async deleteAchievement(id: number): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/achievements/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  // ============================================================================
  // Periods API
  // ============================================================================

  async createPeriod(period: TestPeriod): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/periods`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(period),
    });
    return response.json();
  }

  async getPeriods(personId?: string): Promise<any> {
    const url = personId
      ? `${this.apiUrl}/api/periods?person_id=${personId}`
      : `${this.apiUrl}/api/periods`;
    const response = await fetch(url, { headers: this.getHeaders() });
    return response.json();
  }

  async updatePeriod(id: number, updates: Partial<TestPeriod>): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/periods/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    return response.json();
  }

  async deletePeriod(id: number): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/periods/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  // ============================================================================
  // Lists API
  // ============================================================================

  async createList(title: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title }),
    });
    return response.json();
  }

  async getLists(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async getListItems(listId: number): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists/${listId}/items`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async addListItem(listId: number, item: TestListItem): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists/${listId}/items`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(item),
    });
    return response.json();
  }

  async deleteListItem(listId: number, itemId: number): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async deleteList(listId: number): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists/${listId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async shareList(listId: number): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists/${listId}/share`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async requestPublication(listId: number, description?: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/lists/${listId}/publish-request`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ description }),
    });
    return response.json();
  }

  async getPublicLists(limit: number = 20, offset: number = 0): Promise<any> {
    const response = await fetch(
      `${this.apiUrl}/api/public/lists?limit=${limit}&offset=${offset}`
    );
    return response.json();
  }

  async getPublicList(slug: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/public/lists/${slug}`);
    return response.json();
  }

  // ============================================================================
  // Moderation API (Admin/Moderator)
  // ============================================================================

  async getModerationQueue(status: string = 'pending', limit: number = 50): Promise<any> {
    const response = await fetch(
      `${this.apiUrl}/api/admin/lists/moderation?status=${status}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return response.json();
  }

  async reviewList(
    listId: number,
    action: 'approve' | 'reject',
    options?: { comment?: string; slug?: string }
  ): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/admin/lists/${listId}/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ action, ...options }),
    });
    return response.json();
  }

  // ============================================================================
  // Quiz API
  // ============================================================================

  async saveQuizAttempt(attemptData: any): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/quiz/save-result`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(attemptData),
    });
    return response.json();
  }

  async getLeaderboard(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/quiz/leaderboard`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async getUserStats(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/quiz/leaderboard/me`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async getUserHistory(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/quiz/history`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async createSharedQuiz(quizData: any): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/quiz/share`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(quizData),
    });
    return response.json();
  }
}


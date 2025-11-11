import { Page, Locator, expect } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly emailDisplay: Locator;
  readonly oldPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly saveButton: Locator;
  readonly changePasswordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.emailDisplay = page.locator('[data-testid="email"], .email');
    this.oldPasswordInput = page.locator('input[name="oldPassword"]');
    this.newPasswordInput = page.locator('input[name="newPassword"]');
    this.saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Save")');
    this.changePasswordButton = page.locator('button:has-text("Сменить пароль"), button:has-text("Change password")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/profile');
  }

  async updateProfile(data: { username?: string }): Promise<void> {
    if (data.username) {
      await this.usernameInput.fill(data.username);
    }
    await this.saveButton.click();
    await this.page.waitForTimeout(500);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.changePasswordButton.click();
    await this.oldPasswordInput.fill(oldPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.saveButton.click();
  }

  async expectProfileData(data: { username?: string; email?: string }): Promise<void> {
    if (data.username) {
      await expect(this.usernameInput).toHaveValue(data.username);
    }
    if (data.email) {
      await expect(this.emailDisplay).toContainText(data.email);
    }
  }
}





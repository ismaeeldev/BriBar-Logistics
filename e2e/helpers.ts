/**
 * Shared actions for the e2e suite (SRS 17.1, 8.3).
 *
 * Each helper drives the UI the way a person would — filling the real sign-in
 * form, clicking the real sign-out button — rather than injecting a session
 * directly. SRS 8.3's route protection and SRS 17.1's redirect rules are
 * exactly what a shortcut here would stop exercising.
 */
import { type Page } from '@playwright/test';

import { ADMIN_LOGIN, ADMIN_PASSWORD, DRIVER_LOGIN, DRIVER_PASSWORD } from './env';

async function login(page: Page, loginIdentifier: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill(loginIdentifier);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Signs in as the bootstrap administrator and waits for the admin panel. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_LOGIN, ADMIN_PASSWORD);
  await page.waitForURL('**/admin');
}

/** Signs in as `conductor1`, the fully-configured demo driver, and waits for the driver panel. */
export async function loginAsDriver(page: Page): Promise<void> {
  await login(page, DRIVER_LOGIN, DRIVER_PASSWORD);
  await page.waitForURL('**/driver');
}

/** Signs out via the real sign-out control and waits for `/login`. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
}

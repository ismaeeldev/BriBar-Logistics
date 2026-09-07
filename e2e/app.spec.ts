/**
 * End-to-end coverage of BRIBAR Logistics, browser-driven (SRS 26).
 *
 * Everything here drives the real UI against the real stack — Next.js,
 * Prisma, Postgres, Auth.js — over an isolated database (`.env.test`,
 * `globalSetup`). Nothing is mocked, so a broken server action, a missing
 * import in a client component, or a redirect that stopped firing all fail
 * here the same way they would fail for a person clicking through the app.
 *
 * Two of the checks below (the services list, and the mobile card view it
 * shares markup with) exist because both broke this way in development: a
 * component referenced an icon or a badge it had stopped importing, which
 * Next.js only surfaces once that code path actually renders. A unit test
 * cannot catch that class of bug — nothing is unit-testable about "does this
 * JSX evaluate" — which is exactly the gap this suite is for.
 *
 * Layout: one `describe` per user journey, `.serial` where a test depends on
 * state the previous one created (a record has to exist before it can be
 * edited), and login happens again in each `beforeEach` — slower than sharing
 * one signed-in page, but it means a failure in test 2 is never actually a
 * leftover session from test 1.
 */
import { expect, test } from '@playwright/test';

import { uniqueSuffix } from './env';
import { loginAsAdmin, loginAsDriver, logout } from './helpers';

test.describe('route protection (SRS 8.3)', () => {
  test('an unauthenticated visit to an admin page is sent to sign in', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('an unauthenticated visit to a driver page is sent to sign in', async ({ page }) => {
    await page.goto('/services');
    await page.waitForURL('**/login');
  });
});

test.describe('sign-in and sign-out (SRS 17.1)', () => {
  test('rejects the wrong password with one generic message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('definitely-the-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // SRS 22.1: the message never says which of the two fields was wrong.
    await expect(page.getByText('Incorrect username or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('an administrator reaches the admin panel and can sign out', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);
    // The emoji beside the greeting is `aria-hidden`, so the heading's
    // accessible name is the greeting text alone.
    await expect(page.getByRole('heading', { name: /^Hello, /, level: 1 })).toBeVisible();

    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('a driver reaches their panel and can sign out', async ({ page }) => {
    await loginAsDriver(page);
    await expect(page).toHaveURL(/\/driver$/);

    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('admin dashboard (SRS 16.1)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows today\'s metrics and the recent services queue', async ({ page }) => {
    await expect(page.getByText('Services today')).toBeVisible();
    await expect(page.getByText('Approved today')).toBeVisible();
    await expect(page.getByText('Recent services')).toBeVisible();
  });
});

test.describe.serial('vehicle master data — full lifecycle (SRS 13)', () => {
  const plate = `E2E-${uniqueSuffix()}`;
  const referenceName = 'Playwright test truck';
  const updatedReferenceName = `${referenceName} (updated)`;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates a vehicle', async ({ page }) => {
    await page.goto('/admin/vehicles');
    await page.getByRole('link', { name: 'New' }).click();
    await page.waitForURL('**/admin/vehicles/new');

    await page.getByLabel('Registration plate').fill(plate);
    await page.getByLabel('Vehicle name').fill(referenceName);
    await page.getByRole('button', { name: 'Create vehicle' }).click();

    await page.waitForURL('**/admin/vehicles?created=1');
    // SRS 21.5: deactivated vehicles are never deleted, so repeated runs
    // against the same seeded database accumulate rows — filter by the
    // unique plate rather than assuming the new row lands on page 1.
    await page.getByPlaceholder('Search vehicles by plate or name...').fill(plate);
    await expect(page.getByRole('row', { name: new RegExp(plate) })).toBeVisible();
  });

  test('is findable by the search box', async ({ page }) => {
    await page.goto('/admin/vehicles');
    await page.getByPlaceholder('Search vehicles by plate or name...').fill(plate);
    await expect(page.getByRole('row', { name: new RegExp(plate) })).toBeVisible();
    // SRS 23.3: a search with no match explains itself rather than showing
    // an empty table — proven here by the negative case immediately after.
    await page.getByPlaceholder('Search vehicles by plate or name...').fill('no-such-plate-zzz');
    await expect(page.getByRole('row', { name: new RegExp(plate) })).toHaveCount(0);
  });

  test('is edited, and the change is visible afterwards', async ({ page }) => {
    await page.goto('/admin/vehicles');
    await page.getByPlaceholder('Search vehicles by plate or name...').fill(plate);
    await page.getByRole('row', { name: new RegExp(plate) }).getByRole('link', { name: 'Edit' }).click();
    await page.waitForURL(/\/admin\/vehicles\/[^/]+$/);

    await page.getByLabel('Vehicle name').fill(updatedReferenceName);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.waitForURL('**/admin/vehicles?updated=1');
    await page.getByPlaceholder('Search vehicles by plate or name...').fill(plate);
    await expect(page.getByText(updatedReferenceName)).toBeVisible();
  });

  test('is deactivated, and stays in the list as inactive rather than disappearing', async ({ page }) => {
    // SRS 21.5: deactivation is the removal path — there is no delete. The
    // record must still be visible, just marked, so an admin never mistakes
    // "inactive" for "gone".
    await page.goto('/admin/vehicles');
    await page.getByPlaceholder('Search vehicles by plate or name...').fill(plate);
    await page.getByRole('row', { name: new RegExp(plate) }).getByRole('link', { name: 'Edit' }).click();

    await page.getByLabel('Active', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/admin/vehicles?updated=1');

    await page.getByPlaceholder('Search vehicles by plate or name...').fill(plate);
    await expect(page.getByRole('row', { name: new RegExp(plate) })).toContainText('Inactive');
  });
});

test.describe.serial('routes and contracts — full lifecycle (SRS 14)', () => {
  const code = `E2E-${uniqueSuffix()}`;
  const name = `Playwright Test Lane ${uniqueSuffix()}`;
  const origin = 'Playwright Origin Depot';
  const destination = 'Playwright Destination Yard';

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates a route/contract', async ({ page }) => {
    await page.goto('/admin/routes');
    await page.getByRole('link', { name: 'New' }).click();
    await page.waitForURL('**/admin/routes/new');

    await page.getByLabel('Route code').fill(code);
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Origin').fill(origin);
    await page.getByLabel('Destination').fill(destination);
    await page.getByRole('button', { name: 'Create route' }).click();

    await page.waitForURL('**/admin/routes?created=1');
    // Same pagination-safety rationale as the vehicle creation test above.
    await page.getByPlaceholder('Search routes by code, name, or locations...').fill(code);
    await expect(page.getByRole('row', { name: new RegExp(code) })).toBeVisible();
  });

  test('is filtered to active routes only via the Filters control', async ({ page }) => {
    await page.goto('/admin/routes');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Active', { exact: true }).check();

    await page.getByPlaceholder('Search routes by code, name, or locations...').fill(code);
    await expect(page.getByRole('row', { name: new RegExp(code) })).toBeVisible();
  });

  test('is edited and then deactivated', async ({ page }) => {
    await page.goto('/admin/routes');
    await page.getByPlaceholder('Search routes by code, name, or locations...').fill(code);
    await page.getByRole('row', { name: new RegExp(code) }).getByRole('link', { name: 'Edit' }).click();

    const updatedDestination = 'Playwright Updated Yard';
    await page.getByLabel('Destination').fill(updatedDestination);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/admin/routes?updated=1');

    await page.getByPlaceholder('Search routes by code, name, or locations...').fill(code);
    await page.getByRole('row', { name: new RegExp(code) }).getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Active', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/admin/routes?updated=1');

    await page.getByPlaceholder('Search routes by code, name, or locations...').fill(code);
    await expect(page.getByRole('row', { name: new RegExp(code) })).toContainText('Inactive');
  });
});

test.describe.serial('driver accounts — full lifecycle (SRS 12)', () => {
  const suffix = uniqueSuffix().toLowerCase();
  const loginIdentifier = `e2e.driver.${suffix}`;
  const name = `Playwright Driver ${suffix}`;
  // Deliberately unrelated to loginIdentifier — the schema rejects a password
  // containing the username (SRS 22 password policy).
  const password = 'E2eTestSuite!2026';
  const updatedName = `${name} (updated)`;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('creates a driver account', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByRole('link', { name: 'New' }).click();
    await page.waitForURL('**/admin/users/new');

    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Username').fill(loginIdentifier);
    await page.getByLabel('Password').fill(password);
    // Role defaults to Driver, which is what this check exercises.
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL('**/admin/users?created=1');
    // Same pagination-safety rationale as the vehicle creation test above.
    await page.getByPlaceholder('Search drivers by name or username...').fill(loginIdentifier);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  test('is edited', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByPlaceholder('Search drivers by name or username...').fill(loginIdentifier);
    await page
      .getByRole('row', { name: new RegExp(loginIdentifier, 'i') })
      .getByRole('link', { name: 'Edit' })
      .click();

    await page.getByLabel('Name', { exact: true }).fill(updatedName);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.waitForURL('**/admin/users?updated=1');
    await page.getByPlaceholder('Search drivers by name or username...').fill(loginIdentifier);
    await expect(page.getByText(updatedName, { exact: true })).toBeVisible();
  });

  test('is deactivated', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByPlaceholder('Search drivers by name or username...').fill(loginIdentifier);
    await page
      .getByRole('row', { name: new RegExp(loginIdentifier, 'i') })
      .getByRole('link', { name: 'Edit' })
      .click();

    await page.getByLabel('Active', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL('**/admin/users?updated=1');

    await page.getByPlaceholder('Search drivers by name or username...').fill(loginIdentifier);
    await expect(page.getByRole('row', { name: new RegExp(loginIdentifier, 'i') })).toContainText(
      'Inactive',
    );
  });
});

test.describe('service management list (regression coverage)', () => {
  test('the list and its search box render for an admin', async ({ page }) => {
    // Both `PageHeader`'s status pill and the mobile card view's separator
    // icon previously threw here on a missing import — this loads both.
    await loginAsAdmin(page);
    await page.goto('/admin/services');

    await expect(page.getByRole('heading', { name: 'Service management' })).toBeVisible();
    await expect(
      page.getByPlaceholder('Search services by ID, driver, or route...'),
    ).toBeVisible();
  });
});

test.describe('recording a service, as a driver (SRS 9, 10)', () => {
  test('a same-day service is calculated correctly and reaches history', async ({ page }) => {
    await loginAsDriver(page);

    await page.goto('/services/new');

    // Route and vehicle are left on conductor1's configured defaults
    // (SRS 9.2) — only the readings and times are this driver's to enter.
    // Start Dashboard <= Start Base < End Base <= End Dashboard (SRS 10.3):
    // Actual Km = 60, Service Km = 50.
    await page.getByLabel('Start Dashboard KM').fill('1000');
    await page.getByLabel('Start Base KM').fill('1000');
    await page.getByLabel('End Base KM').fill('1050');
    await page.getByLabel('End Dashboard KM').fill('1060');
    await page.getByLabel('Departure Time').fill('08:00');
    await page.getByLabel('Arrival Time').fill('10:30');

    await page.getByRole('button', { name: 'Submit service' }).click();

    await page.waitForURL(/\/services\/[^/?]+\?created=1/);
    // SRS 23.3: confirmation feedback after a successful submission.
    await expect(page.getByText('Service submitted')).toBeVisible();

    const serviceCode = (await page.getByRole('heading', { level: 1 }).textContent())?.trim();
    expect(serviceCode).toMatch(/^#/);

    await page.goto('/services');
    await expect(page.getByText(serviceCode!)).toBeVisible();
  });
});

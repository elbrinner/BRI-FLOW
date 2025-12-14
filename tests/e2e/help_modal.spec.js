// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Help Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // Evita redirecciones/autotest automático al cargar
      localStorage.setItem('bri_autotest_once', 'done');
    });

    page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER] ERROR: ${err.message}`));

    await page.goto('http://localhost:8081');
    await page.waitForTimeout(800);

    // Cerrar modal de flujos si aparece
    const flowsModalClose = page.locator('#flowsModalClose');
    if (await flowsModalClose.isVisible()) await flowsModalClose.click();
  });

  test('opens and shows quick sections', async ({ page }) => {
    await page.locator('#btnHelpDoc').click();

    const dialog = page.locator('#helpModal');
    await expect(dialog).toBeVisible();

    await expect(dialog).toContainText(/Contar elementos/i);
    await expect(dialog).toContainText(/expresiones/i);

    // Secciones específicas
    await expect(dialog.locator('#quick_count')).toBeVisible();
    await expect(dialog.locator('#quick_expr')).toBeVisible();
  });
});

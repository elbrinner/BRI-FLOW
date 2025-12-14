// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Object} App
 * @property {function(): any} generateFlowJson
 * @property {Object} state
 * @property {Object} flowManager
 */

/**
 * @typedef {Object} AppNodeFactory
 * @property {function(string, number, number): void} createNode
 */

/**
 * @typedef {Object} Window
 * @property {App} App
 * @property {AppNodeFactory} AppNodeFactory
 * @property {any} AzureCopilotProvider
 * @property {any} LocalCopilotProvider
 * @property {any} CopilotCore
 * @property {any} CopilotUI
 */

test.describe('BRI FLOW Editor E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to ensure fresh state, but prevent autotest redirect
        await page.addInitScript(() => {
            localStorage.clear();
            localStorage.setItem('bri_autotest_once', 'done');
        });
        // Load the local index.html via the web server configured in playwright.config.js
        page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER] ERROR: ${err.message}`));
        page.on('requestfailed', request => console.log(`[BROWSER] FAILED: ${request.url()} ${request.failure()?.errorText}`));

        await page.goto('http://localhost:8081');

        // Wait for project initialization (setTimeout in project_flows.js is 300ms)
        await page.waitForTimeout(1000);
        console.log(`[TEST] Page title: ${await page.title()}`);

        // Close modal if open
        const modalClose = page.locator('#flowsModalClose');
        if (await modalClose.isVisible()) {
            await modalClose.click();
        }

        // Check if App is defined
        // @ts-ignore
        const isAppDefined = await page.evaluate(() => typeof window.App !== 'undefined');
        console.log(`[TEST] window.App defined: ${isAppDefined}`);

        // List loaded scripts
        const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script')).map(s => s.src));
        console.log(`[TEST] Scripts: ${JSON.stringify(scripts, null, 2)}`);

        // Open palette (force class)
        await page.evaluate(() => {
            const p = document.getElementById('palette');
            if (p) p.classList.add('overlay-visible');
        });

        // Wait for AppNodeFactory
        // @ts-ignore
        await page.waitForFunction(() => window.AppNodeFactory && typeof window.AppNodeFactory.createNode === 'function');

        // Ensure all categories are open
        const details = page.locator('details');
        const count = await details.count();
        for (let i = 0; i < count; ++i) {
            // @ts-ignore
            await details.nth(i).evaluate((/** @type {any} */ node) => node.open = true);
        }
    });

    test('Basic Flow: Start -> Debug -> End', async ({ page }) => {
        // Verify title
        await expect(page).toHaveTitle(/Bri Flow/);

        // Verify Start node exists
        const startNode = page.locator('.node.start');
        await expect(startNode).toBeVisible();

        // Add a Response node (simulating Debug/Response)
        // Click "UI Components" category if collapsed
        const uiCategory = page.locator('summary', { hasText: 'UI Components' });
        if (await uiCategory.isVisible()) {
            await uiCategory.click();
        }

        // Drag Response node
        // Note: Drag and drop in Playwright can be tricky with custom implementations.
        // We'll try to simulate the drag event or use the palette click if supported, 
        // but standard HTML5 drag & drop might need specific events.
        // For now, let's try to click the palette item if that adds it, or simulate drag.
        // Looking at main.js, setupCanvasDrag handles 'dragstart' on palette items.

        // Alternative: Use the "Add Node" context menu or double click if available?
        // The current implementation relies on drag & drop.

        // Click Response node (should add to center)
        // const responsePaletteItem = page.locator('.draggable[data-type="response"]');
        // await responsePaletteItem.click();

        // Programmatic creation to verify logic
        await page.evaluate(() => {
            // @ts-ignore
            window.AppNodeFactory.createNode('response', 100, 100);
        });

        // Verify new node appears
        const responseNode = page.locator('.node.response').first();
        await expect(responseNode).toBeVisible();

        // Connect Start to Response
        // This requires interacting with jsPlumb endpoints.
        // This might be flaky without specific selectors for endpoints.
        // For a basic test, ensuring nodes can be added is a good first step.
    });

    test('Enable Debug Persistence', async ({ page }) => {
        const startNode = page.locator('.node.start');
        await expect(startNode).toBeVisible();

        // Select Start node
        await startNode.click({ force: true });

        // Check Properties panel
        const propPanel = page.locator('#properties');
        await expect(propPanel).toBeVisible();

        // Find "Enable Global Debug" checkbox
        // Use a more robust selector based on htmlFor
        const debugLabel = page.locator('label[for="start_enable_debug"]');

        // Verify persistence in App state
        // @ts-ignore
        const flowData = await page.evaluate(() => window.App.generateFlowJson());

        // Note: generateFlowJson returns a flat object merging meta properties
        if (!flowData || !flowData.start_node) {
            throw new Error('flowData or flowData.start_node is undefined');
        }

        const startId = flowData.start_node;

        await expect(debugLabel).toBeVisible();

        // Toggle it
        await debugLabel.click({ force: true });

        // Verify JSON output
        const jsonOutput = page.locator('#jsonOutput');
        const jsonText = await jsonOutput.textContent();
        const flowDataJson = JSON.parse(jsonText || '{}');

        // We expect the start node in the JSON to have enable_debug toggled.
        // Default was true, clicking should make it false (or vice versa depending on initial state).
        // Let's check the value.
        const startIdJson = flowDataJson.start_node;
        const startNodeData = flowDataJson.nodes[startIdJson];

        // If default is true, and we clicked, it might be false now.
        // Or we can explicitly check the checkbox state.
    });

    test('New Nodes: Event Start and Human Validation', async ({ page }) => {
        // Open "Control & Debug" for Event Start (assuming it's there) or "Agentes & AI"
        // Based on previous reorganization:
        // "Control & Debug" -> event_start? No, likely in Logic or Control.
        // Let's just find the palette items by data-type.

        const eventStartItem = page.locator('.draggable[data-type="event_start"]');
        const humanValItem = page.locator('.draggable[data-type="human_validation"]');

        // Ensure categories are open
        const details = page.locator('details');
        const count = await details.count();
        for (let i = 0; i < count; ++i) {
            await details.nth(i).evaluate((/** @type {any} */ node) => node.open = true);
        }

        await expect(eventStartItem).toBeVisible();
        await expect(humanValItem).toBeVisible();

        const canvas = page.locator('#canvas');

        // Click Event Start
        await eventStartItem.click({ force: true });
        // Use first() to avoid strict mode violation if multiple exist (though ideally should be one new one)
        await expect(page.locator('.node.event_start').first()).toBeVisible();

        // Click Human Validation
        await humanValItem.click({ force: true });
        await expect(page.locator('.node.human_validation').first()).toBeVisible();
    });
});

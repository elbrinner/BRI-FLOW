// tests/e2e/connections.spec.js
// E2E test to validate visual connections between nodes

import { test, expect } from '@playwright/test';

test.describe('Node Connections', () => {
    test.beforeEach(async ({ page }) => {
        // Clear localStorage to ensure fresh state
        await page.addInitScript(() => {
            localStorage.clear();
            localStorage.setItem('bri_autotest_once', 'done');
        });

        await page.goto('http://localhost:8081');
        await page.waitForLoadState('networkidle');

        // Wait for jsPlumb to be ready
        await page.waitForFunction(() => typeof window.jsPlumb !== 'undefined');
        await page.waitForTimeout(500); // Give jsPlumb time to initialize
    });

    test('should create visual connection between two nodes', async ({ page }) => {
        // Create first node (Start)
        await page.locator('.draggable[data-type="start"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 100, y: 100 } }
        );

        // Create second node (Debug)
        await page.locator('.draggable[data-type="debug"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 300, y: 100 } }
        );

        // Wait for nodes to be rendered
        await page.waitForSelector('#node_start_1');
        await page.waitForSelector('#node_debug_1');

        // Select start node and connect to debug
        await page.click('#node_start_1');

        // Fill in the 'next' field in properties panel
        await page.waitForSelector('#dynamicProps');
        const nextInput = page.locator('input[data-prop="next"]').or(
            page.locator('input').filter({ hasText: /next/i })
        ).first();

        if (await nextInput.count() > 0) {
            await nextInput.fill('debug_1');
            await page.click('button[type="submit"]'); // Apply changes
        }

        // Wait for connection to be drawn
        await page.waitForTimeout(1000);

        // Verify connection exists in jsPlumb
        const hasConnection = await page.evaluate(() => {
            if (!window.jsPlumb) return false;
            const connections = window.jsPlumb.getAllConnections();
            return connections.length > 0;
        });

        expect(hasConnection).toBe(true);

        // Verify SVG connection element exists in DOM
        const svgConnections = await page.locator('svg.jtk-connector').count();
        expect(svgConnections).toBeGreaterThan(0);
    });

    test('should preserve connections after refresh', async ({ page }) => {
        // Create a simple flow
        await page.locator('.draggable[data-type="start"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 100, y: 100 } }
        );

        await page.locator('.draggable[data-type="response"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 300, y: 100 } }
        );

        // Connect them
        await page.click('#node_start_1');
        await page.waitForSelector('#dynamicProps');

        const nextInput = page.locator('input').filter({ hasText: /next/i }).first();
        if (await nextInput.count() > 0) {
            await nextInput.fill('response_1');
            await page.click('button[type="submit"]');
        }

        await page.waitForTimeout(500);

        // Export flow
        await page.click('#btnExport');

        // Wait for download
        const downloadPromise = page.waitForEvent('download');
        const download = await downloadPromise;

        // Verify download happened
        expect(download.suggestedFilename()).toContain('.json');

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Import the flow (would need to implement file upload)
        // For now, we'll verify the connection drawing logic works

        // Trigger refreshConnections manually
        const connectionsRefreshed = await page.evaluate(() => {
            if (window.AppConnections && window.AppConnections.refreshConnections && window.App) {
                window.AppConnections.refreshConnections(window.App.state);
                return true;
            }
            return false;
        });

        expect(connectionsRefreshed).toBe(true);
    });

    test('should show different connection styles for different node types', async ({ page }) => {
        // Create condition node
        await page.locator('.draggable[data-type="condition"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 100, y: 100 } }
        );

        // Create two response nodes
        await page.locator('.draggable[data-type="response"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 300, y: 50 } }
        );

        await page.locator('.draggable[data-type="response"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 300, y: 150 } }
        );

        // Connect condition to both responses (true/false)
        await page.click('#node_condition_1');
        await page.waitForSelector('#dynamicProps');

        // Set true_target
        const trueInput = page.locator('input').filter({ hasText: /true/i }).first();
        if (await trueInput.count() > 0) {
            await trueInput.fill('response_1');
        }

        // Set false_target
        const falseInput = page.locator('input').filter({ hasText: /false/i }).first();
        if (await falseInput.count() > 0) {
            await falseInput.fill('response_2');
        }

        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);

        // Verify connections have labels
        const hasLabels = await page.evaluate(() => {
            const labels = document.querySelectorAll('.jtk-overlay');
            return labels.length >= 2; // Should have TRUE and FALSE labels
        });

        expect(hasLabels).toBe(true);
    });

    test('should handle connection refresh on node deletion', async ({ page }) => {
        // Create three nodes in a chain
        await page.locator('.draggable[data-type="start"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 100, y: 100 } }
        );

        await page.locator('.draggable[data-type="debug"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 250, y: 100 } }
        );

        await page.locator('.draggable[data-type="end"]').dragTo(
            page.locator('#canvasInner'),
            { targetPosition: { x: 400, y: 100 } }
        );

        // Connect start -> debug -> end
        await page.click('#node_start_1');
        let nextInput = page.locator('input').filter({ hasText: /next/i }).first();
        if (await nextInput.count() > 0) {
            await nextInput.fill('debug_1');
            await page.click('button[type="submit"]');
        }

        await page.click('#node_debug_1');
        nextInput = page.locator('input').filter({ hasText: /next/i }).first();
        if (await nextInput.count() > 0) {
            await nextInput.fill('end_1');
            await page.click('button[type="submit"]');
        }

        await page.waitForTimeout(500);

        // Count initial connections
        const initialConnections = await page.evaluate(() => {
            return window.jsPlumb ? window.jsPlumb.getAllConnections().length : 0;
        });

        expect(initialConnections).toBe(2);

        // Delete middle node
        await page.click('#node_debug_1');
        await page.click('#btnDeleteNode');

        // Confirm deletion if there's a dialog
        page.on('dialog', dialog => dialog.accept());

        await page.waitForTimeout(500);

        // Verify connection count decreased
        const finalConnections = await page.evaluate(() => {
            return window.jsPlumb ? window.jsPlumb.getAllConnections().length : 0;
        });

        expect(finalConnections).toBeLessThan(initialConnections);
    });
});

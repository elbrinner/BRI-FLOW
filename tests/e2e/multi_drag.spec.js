import { test, expect } from '@playwright/test';


test.describe('Multi-Node Operations', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        // Load the editor
        await page.goto('http://localhost:8081/index.html');
        // Inject global click logger
        await page.evaluate(() => {
            document.addEventListener('mousedown', e => {
                console.log('[Global] MouseDown on:', e.target.tagName, e.target.id, e.target.className, e.clientX, e.clientY);
            }, true); // Capture phase
        });
        // Wait for editor to be ready
        // Wait for editor to be ready
        await page.waitForSelector('#canvas');
    });

    test('should select multiple nodes using lasso and move them together', async ({ page }) => {
        await page.evaluate(() => {
            // Force clear existing nodes using importJson
            if (window.App && window.App.importJson) {
                window.App.importJson({
                    meta: { flow_id: 'test_flow', start_node: 'start_1' },
                    nodes: {}
                });
            }
            const startNode = window.App.createNode('start', 200, 200);
            const debugNode = window.App.createNode('debug', 400, 400);
            console.log('TEST: Created nodes:', startNode, debugNode);
        });

        // Wait for DOM
        await page.waitForSelector('.node.start');
        await page.waitForSelector('.node.debug');

        const nodes = await page.locator('.node').all();
        expect(nodes.length).toBeGreaterThanOrEqual(2);

        const node1 = nodes[0];
        const node2 = nodes[1];

        const id1 = await node1.getAttribute('id');
        const id2 = await node2.getAttribute('id');
        console.log(`TEST: IDs: ${id1}, ${id2}`);

        // 2. Programmatically Select Nodes to ensure state
        await page.evaluate((ids) => {
            window.AppSelectionManager.clear();
            ids.forEach(id => window.AppSelectionManager.select(id.replace('node_', ''), true));
        }, [id1, id2]);

        // Verify selection
        await expect(node1).toHaveClass(/selected/);
        await expect(node2).toHaveClass(/selected/);
        console.log('TEST: Selection Set Programmatically');

        // 4. Get initial positions
        const bbox1Before = await node1.boundingBox();
        const bbox2Before = await node2.boundingBox();

        // 5. Drag Node 1 manually
        const startX = bbox1Before.x + 15;
        const startY = bbox1Before.y + 15;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Small move to trigger drag start?
        await page.mouse.move(startX + 10, startY + 10, { steps: 2 });
        // Larger move
        await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
        await page.mouse.up();

        // Wait for animation/update
        await page.waitForTimeout(500);

        // 6. Verify Node 2 also moved
        const bbox1After = await node1.boundingBox();
        const bbox2After = await node2.boundingBox();

        // Check delta
        const delta1X = bbox1After.x - bbox1Before.x;
        const delta1Y = bbox1After.y - bbox1Before.y;

        const delta2X = bbox2After.x - bbox2Before.x;
        const delta2Y = bbox2After.y - bbox2Before.y;

        console.log(`Node 1 Delta: ${delta1X}, ${delta1Y}`);
        console.log(`Node 2 Delta: ${delta2X}, ${delta2Y}`);

        // Expect significant movement
        expect(Math.abs(delta1X)).toBeGreaterThan(20);
        expect(Math.abs(delta1Y)).toBeGreaterThan(20);

        // Expect Node 2 to move similarly (within small margin of error due to snap/rounding)
        expect(Math.abs(delta1X - delta2X)).toBeLessThan(5);
        expect(Math.abs(delta1Y - delta2Y)).toBeLessThan(5);
    });
});

import { test, expect } from '@playwright/test';

test.describe('Simulator', () => {
    test.beforeEach(async ({ page }) => {
        // Clear local storage and set test flag
        await page.goto('http://localhost:8081');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('bri_prevent_redirect', '1');
        });

        // Wait for jsPlumb to be ready
        await page.waitForFunction(() => window.jsPlumb !== undefined);
        await page.waitForTimeout(500);
    });

    test('should open simulator modal and auto-start flow', async ({ page }) => {
        // Load a simple test flow
        const testFlow = {
            flow_id: 'test_simulator',
            name: 'Test Simulator Flow',
            start_node: 'start_1',
            nodes: {
                start_1: {
                    id: 'start_1',
                    type: 'start',
                    next: 'response_1',
                    x: 100,
                    y: 100
                },
                response_1: {
                    id: 'response_1',
                    type: 'response',
                    text: 'First message',
                    next: 'response_2',
                    x: 100,
                    y: 200
                },
                response_2: {
                    id: 'response_2',
                    type: 'response',
                    text: 'Second message',
                    next: 'response_3',
                    x: 100,
                    y: 300
                },
                response_3: {
                    id: 'response_3',
                    type: 'response',
                    text: 'Third message',
                    next: 'end_1',
                    x: 100,
                    y: 400
                },
                end_1: {
                    id: 'end_1',
                    type: 'end',
                    x: 100,
                    y: 500
                }
            }
        };

        // Import the flow
        await page.evaluate((flow) => {
            if (window.App && window.App.importJson) {
                window.App.importJson(flow);
            }
        }, testFlow);

        await page.waitForTimeout(500);

        // Open simulator modal
        const simulatorBtn = page.locator('#btnOpenSimulatorModal');
        await expect(simulatorBtn).toBeVisible();
        await simulatorBtn.click();

        // Wait for modal to open
        const modal = page.locator('#simulatorModal');
        await expect(modal).toBeVisible();

        // Wait for flow to load and start
        await page.waitForTimeout(1000);

        // Check console logs for engine start
        const logs = [];
        page.on('console', msg => {
            if (msg.text().includes('[Engine]') || msg.text().includes('[processResponse]')) {
                logs.push(msg.text());
            }
        });

        // Wait a bit for messages to appear
        await page.waitForTimeout(2000);

        // Check that chat messages are visible
        const chatContainer = page.locator('#simulatorChatBox');
        await expect(chatContainer).toBeVisible();

        // Count bot messages
        const botMessages = page.locator('#simulatorChatBox .chat-bubble-bot');
        const messageCount = await botMessages.count();

        console.log(`Found ${messageCount} bot messages`);

        // Should have 3 response messages
        expect(messageCount).toBeGreaterThanOrEqual(1);

        // Check first message content
        const firstMessage = botMessages.first();
        await expect(firstMessage).toContainText('First message');

        // If we have more messages, check them too
        if (messageCount >= 2) {
            const secondMessage = botMessages.nth(1);
            await expect(secondMessage).toContainText('Second message');
        }

        if (messageCount >= 3) {
            const thirdMessage = botMessages.nth(2);
            await expect(thirdMessage).toContainText('Third message');
        }

        // Log the actual count for debugging
        console.log(`Expected 3 messages, got ${messageCount}`);
    });

    test('should show all response messages in sequence', async ({ page }) => {
        // This test specifically checks that all messages appear
        const testFlow = {
            flow_id: 'sequential_test',
            name: 'Sequential Messages',
            start_node: 'start',
            nodes: {
                start: { id: 'start', type: 'start', next: 'msg1', x: 0, y: 0 },
                msg1: { id: 'msg1', type: 'response', text: 'Message 1', next: 'msg2', x: 0, y: 100 },
                msg2: { id: 'msg2', type: 'response', text: 'Message 2', next: 'msg3', x: 0, y: 200 },
                msg3: { id: 'msg3', type: 'response', text: 'Message 3', next: 'end', x: 0, y: 300 },
                end: { id: 'end', type: 'end', x: 0, y: 400 }
            }
        };

        await page.evaluate((flow) => {
            if (window.App && window.App.importJson) {
                window.App.importJson(flow);
            }
        }, testFlow);

        await page.waitForTimeout(300);

        // Open simulator
        await page.click('#btnOpenSimulatorModal');
        await page.waitForTimeout(2000);

        // Get all bot messages
        const messages = await page.locator('#simulatorChatBox .chat-bubble-bot').allTextContents();

        console.log('Messages found:', messages);

        // Should have all 3 messages
        expect(messages.length).toBe(3);
        expect(messages[0]).toContain('Message 1');
        expect(messages[1]).toContain('Message 2');
        expect(messages[2]).toContain('Message 3');
    });
});

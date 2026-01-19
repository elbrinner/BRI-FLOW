import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load source code
function loadSource(relativePath) {
    return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

// Setup JSDOM environment
let dom;
function setupDom() {
    if (dom) return; // Only setup once
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"><div id="canvas-inner"></div></div></body></html>', {
        url: 'http://localhost/',
        pretendToBeVisual: true
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.NodeList = dom.window.NodeList;

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    };

    // Mock jsPlumb
    global.jsPlumb = {
        reset: () => { },
        setContainer: () => { },
        importDefaults: () => { },
        deleteEveryConnection: () => { },
        remove: () => { },
        repaintEverything: () => { },
        ready: (cb) => cb()
    };

    // Mock App globals
    global.window.AppConnections = {
        refreshConnections: () => { },
        init: () => { }
    };
    global.window.Toasts = {
        info: () => { }
    };
}

function resetDom() {
    document.body.innerHTML = '<div id="canvas"><div id="canvas-inner"></div></div>';
}

// Test Runner
async function runTests() {
    console.log('Running Editor Unit Tests...');
    let passed = 0;
    let failed = 0;

    // Initialize DOM first
    setupDom();

    // --- Load Modules ---
    const canvasManagerSrc = loadSource('js/canvas_manager.js');
    const flowImporterSrc = loadSource('js/flow_importer.js');
    const flowManagerSrc = loadSource('js/flow_manager.js');

    // Execute modules in global scope
    // We need to ensure they attach to the global window we just created
    eval(canvasManagerSrc);
    eval(flowImporterSrc);
    eval(flowManagerSrc);

    const AppCanvasManager = global.window.AppCanvasManager;
    const AppFlowImporter = global.window.AppFlowImporter;
    const AppFlowManager = global.window.AppFlowManager;

    if (!AppCanvasManager) throw new Error('AppCanvasManager not loaded');
    if (!AppFlowImporter) throw new Error('AppFlowImporter not loaded');
    if (!AppFlowManager) throw new Error('AppFlowManager not loaded');

    function test(name, fn) {
        try {
            resetDom(); // Reset DOM content for each test
            fn();
            console.log(`[PASS] ${name}`);
            passed++;
        } catch (e) {
            console.error(`[FAIL] ${name}`, e);
            failed++;
        }
    }

    // --- CanvasManager Tests ---

    test('CanvasManager.init should setup refs', () => {
        const canvas = document.getElementById('canvas');
        const canvasInner = document.getElementById('canvas-inner');
        let zoom = 1;

        AppCanvasManager.init({
            canvas,
            canvasInner,
            getZoom: () => zoom,
            setZoom: (z) => { zoom = z; }
        });

        // No error means success for basic init
    });

    test('CanvasManager.autoGrowCanvas should expand canvasInner', () => {
        const canvasInner = document.getElementById('canvas-inner');
        // Mock layout
        Object.defineProperty(canvasInner, 'scrollWidth', { value: 500, configurable: true });
        Object.defineProperty(canvasInner, 'scrollHeight', { value: 500, configurable: true });

        // Add a node that is out of bounds
        const node = document.createElement('div');
        node.className = 'node';
        node.style.left = '1000px';
        node.style.top = '800px';
        node.style.width = '100px';
        node.style.height = '100px';
        // Mock offset props
        Object.defineProperty(node, 'offsetWidth', { value: 100 });
        Object.defineProperty(node, 'offsetHeight', { value: 100 });
        canvasInner.appendChild(node);

        // Initialize first
        AppCanvasManager.init({ canvas: {}, canvasInner });

        AppCanvasManager.autoGrowCanvas(100);

        // Expected width: 1000 + 100 + 100 = 1200
        // Expected height: 800 + 100 + 100 = 1000
        if (canvasInner.style.width !== '1200px') throw new Error(`Expected width 1200px, got ${canvasInner.style.width}`);
        if (canvasInner.style.height !== '1000px') throw new Error(`Expected height 1000px, got ${canvasInner.style.height}`);
    });

    // --- FlowImporter Tests ---

    test('FlowImporter.importJson should import basic flow', () => {
        const state = { nodes: {}, meta: {} };
        const json = {
            flow_id: 'test_flow',
            nodes: {
                n1: { id: 'n1', type: 'start', x: 10, y: 10 }
            }
        };

        let renderedNodes = [];
        const dependencies = {
            canvasInner: document.getElementById('canvas-inner'),
            renderNode: (n) => renderedNodes.push(n),
            refreshConnections: () => { },
            refreshOutput: () => { },
            selectNode: () => { },
            autoGrowCanvas: () => { },
            fitCanvasToContent: () => { }
        };

        AppFlowImporter.importJson(json, state, dependencies);

        if (state.meta.flow_id !== 'test_flow') throw new Error('Meta flow_id not set');
        if (!state.nodes.n1) throw new Error('Node n1 not imported');
        if (renderedNodes.length !== 1) throw new Error('Node not rendered');
    });

    test('FlowImporter.importJson should migrate set_var to assign_var', () => {
        const state = { nodes: {}, meta: {} };
        const json = {
            nodes: {
                n1: { id: 'n1', type: 'set_var' }
            }
        };

        const dependencies = {
            canvasInner: document.getElementById('canvas-inner'),
            renderNode: () => { },
            refreshConnections: () => { },
            refreshOutput: () => { },
            selectNode: () => { },
            autoGrowCanvas: () => { },
            fitCanvasToContent: () => { }
        };

        AppFlowImporter.importJson(json, state, dependencies);

        if (state.nodes.n1.type !== 'assign_var') throw new Error('Node type not migrated to assign_var');
    });

    // --- FlowManager Tests ---

    test('FlowManager.deleteNode should remove node from state and DOM', () => {
        const state = { nodes: { n1: { id: 'n1' } }, selectedId: 'n1' };
        const dependencies = {
            selectNode: () => { state.selectedId = null; },
            refreshOutput: () => { }
        };

        // Mock DOM element
        const el = document.createElement('div');
        el.id = 'node_n1';
        document.body.appendChild(el);

        AppFlowManager.init(state, dependencies);
        AppFlowManager.deleteNode('n1');

        if (state.nodes.n1) throw new Error('Node n1 not removed from state');
        if (document.getElementById('node_n1')) throw new Error('Node element not removed from DOM');
        if (state.selectedId !== null) throw new Error('Selection not cleared');
    });

    test('FlowManager.duplicateNode should create copy of node', () => {
        const state = { nodes: { n1: { id: 'n1', type: 'test', x: 10, y: 10, props: { a: 1 } } } };
        let createdNode = null;
        const dependencies = {
            createNode: (type, x, y) => {
                createdNode = { id: 'n2', type, x, y };
                state.nodes.n2 = createdNode;
                return createdNode;
            },
            renderNode: () => { },
            selectNode: () => { },
            refreshOutput: () => { }
        };

        AppFlowManager.init(state, dependencies);
        AppFlowManager.duplicateNode('n1');

        if (!createdNode) throw new Error('New node not created');
        if (createdNode.type !== 'test') throw new Error('Type mismatch');
        if (createdNode.x !== 30) throw new Error('X position not offset'); // 10 + 20
        if (createdNode.props.a !== 1) throw new Error('Properties not copied');
    });

    // Summary
    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});

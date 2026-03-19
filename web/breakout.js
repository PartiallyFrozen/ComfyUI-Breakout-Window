import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const channel = new BroadcastChannel("comfy_breakout_channel");
let customOrder = []; 
let activeExternalWindows = {}; 
let isZenMode = false;

// Global Layout State Variables
window._breakout_zen_order = [];
window._breakout_ext_order = [];

const VALID_CONTROL_TYPES = ["BreakoutIntControl", "BreakoutFloatControl", "BreakoutStringControl", "BreakoutBoolControl", "BreakoutSeedControl"];
const VALID_PREVIEW_TYPES = ["BreakoutWindow"]; 

// --- Progress Tracking State ---
let currentExecutingNode = "";
let globalProgressState = { text: "Idle", pct: 0, isVisible: false };

function updateGlobalProgress(text, pct, isVisible) {
    globalProgressState = { text, pct, isVisible };
    
    const zenCont = document.getElementById("zen-progress-container");
    if (zenCont) {
        zenCont.style.display = isVisible ? "flex" : "none";
        document.getElementById("zen-progress-text").innerText = text;
        document.getElementById("zen-progress-pct").innerText = pct + "%";
        document.getElementById("zen-progress-fill").style.width = pct + "%";
    }
    
    channel.postMessage({ action: "sync_progress", ...globalProgressState });
}

// --- Lazy DOM Initialization for Zen Overlay ---
let zenOverlay = null;

window.setZenCols = (cols) => {
    localStorage.setItem('breakout_zen_cols', cols);
    const overlay = document.getElementById("breakout-zen-overlay");
    if (overlay) {
        if (cols === 'auto') {
            overlay.style.gridTemplateColumns = "repeat(auto-fit, minmax(450px, 1fr))";
        } else {
            overlay.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        }
        document.querySelectorAll('.zen-col-btn').forEach(b => {
            b.style.background = b.dataset.cols == cols ? '#2196F3' : '#222';
            b.style.color = b.dataset.cols == cols ? 'white' : '#aaa';
        });
        setTimeout(window.applyZenMasonry, 50);
    }
    // Save to Graph JSON
    if (app.graph) {
        app.graph.extra = app.graph.extra || {};
        app.graph.extra.breakout_state = app.graph.extra.breakout_state || {};
        app.graph.extra.breakout_state.zen_cols = cols;
        app.graph.setDirtyCanvas(true, false);
    }
};

window.applyZenMasonry = () => {
    if (!isZenMode) return;
    const overlay = document.getElementById("breakout-zen-overlay");
    if (!overlay) return;
    const panels = overlay.querySelectorAll('.zen-active-panel');
    panels.forEach(p => {
        p.style.gridRowEnd = 'auto'; 
        const height = p.scrollHeight;
        const span = Math.ceil((height + 20) / 30); 
        p.style.gridRowEnd = 'span ' + span;
    });
};
window.addEventListener('resize', () => { if (isZenMode) window.applyZenMasonry(); });

function initZenOverlay() {
    if (document.getElementById("breakout-zen-overlay")) {
        zenOverlay = document.getElementById("breakout-zen-overlay");
        return;
    }
    
    const style = document.createElement('style');
    style.innerHTML = `
        #breakout-zen-overlay {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(10px);
            z-index: 9990; display: none; padding: 70px 40px 40px 40px;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            grid-auto-rows: 10px; row-gap: 20px; column-gap: 20px;
            grid-auto-flow: row dense; overflow-y: auto; align-items: start;
        }
        .zen-active-panel {
            position: relative !important; top: auto !important; left: auto !important; right: auto !important;
            width: 100% !important; min-height: 100px; height: max-content !important; margin: 0 !important; transform: none !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; border: 1px solid #333 !important; transition: opacity 0.2s; resize: none !important;
        }
        .zen-dragging {
            opacity: 0.4 !important; border: 2px dashed #2196F3 !important;
        }
        #zen-exit-header {
            position: fixed; top: 0; left: 0; width: 100vw; height: 50px;
            background: #151515; display: flex; align-items: center; justify-content: center; gap: 20px;
            border-bottom: 1px solid #333; z-index: 9991; padding: 0 20px; box-sizing: border-box;
        }
        #btn-exit-zen-top {
            background: #2196F3; color: white; border: none; padding: 6px 24px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;
        }
        .zen-col-btn {
            background: #222; color: #aaa; border: none; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 11px; font-weight:bold; transition: 0.1s;
        }
        .zen-col-btn:hover { background: #333; }
    `;
    document.head.appendChild(style);

    zenOverlay = document.createElement('div');
    zenOverlay.id = "breakout-zen-overlay";
    zenOverlay.innerHTML = `
        <div id="zen-exit-header">
            <button id="btn-zen-run-all" style="background: #2196F3; color: white; border: none; padding: 6px 24px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">🌍 Run All</button>
            
            <div id="zen-progress-container" style="flex:1; max-width: 400px; display:none; flex-direction:column; margin: 0 20px;">
                <div style="font-size:11px; color:#ccc; margin-bottom:4px; display:flex; justify-content:space-between; font-family:sans-serif;">
                    <span id="zen-progress-text" style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Idle</span>
                    <span id="zen-progress-pct">0%</span>
                </div>
                <div style="width:100%; background:#222; height:8px; border-radius:4px; overflow:hidden; border:1px solid #333;">
                    <div id="zen-progress-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #4CAF50, #8BC34A); transition:width 0.1s linear;"></div>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:5px; background:#1a1a1a; padding:4px 8px; border-radius:4px; border:1px solid #333; margin-left:auto;">
                <span style="color:#aaa; font-size:11px; margin-right:4px;">Cols:</span>
                <button class="zen-col-btn" data-cols="1" onclick="window.setZenCols('1')">1</button>
                <button class="zen-col-btn" data-cols="2" onclick="window.setZenCols('2')">2</button>
                <button class="zen-col-btn" data-cols="3" onclick="window.setZenCols('3')">3</button>
                <button class="zen-col-btn" data-cols="4" onclick="window.setZenCols('4')">4</button>
                <button class="zen-col-btn" data-cols="5" onclick="window.setZenCols('5')">5</button>
                <button class="zen-col-btn" data-cols="auto" onclick="window.setZenCols('auto')">Auto</button>
            </div>

            <label style="color: #ccc; font-size: 12px; display: flex; align-items: center; gap: 5px; cursor: pointer; margin-left: 20px; margin-right: 20px;">
                <input type="checkbox" id="chk-close-on-exit"> Close on exit
            </label>
            <button id="btn-exit-zen-top">✖ Exit Zen Mode</button>
        </div>
    `;
    document.body.appendChild(zenOverlay);
    document.getElementById("btn-exit-zen-top").onclick = () => { if (isZenMode) toggleZenMode(); };
    document.getElementById("btn-zen-run-all").onclick = () => sendSync({ action: "trigger_queue_all" });
}

function triggerQueuePrompt() {
    const queueBtn = document.getElementById("queue-button");
    if (queueBtn) queueBtn.click(); else app.queuePrompt(0, 1);
}

window.launchBreakoutWindow = (id, mode) => {
    if (mode === "External" || mode === "Control Panel (External)") openExternalBreakoutWindow(id);
    else createFloatingBreakout(id);
};

window.changeBreakoutWindowMode = (nodeId, newMode) => {
    if (!app.graph) return;
    const node = app.graph.getNodeById(nodeId);
    if (node && node.widgets) {
        const modeW = node.widgets.find(w => w.name === "window_mode");
        if (modeW) {
            modeW.value = newMode;
            if (modeW.callback) modeW.callback(modeW.value);
            app.graph.setDirtyCanvas(true, false);
            refreshAllBreakoutWindows();
            renderDynamicSidebar(); 
        }
    }
};

function getExistingPreviewData(targetId) {
    if (!app.graph || !app.graph._nodes) return { history: [], index: 0 };
    const node = app.graph._nodes.find(n => VALID_PREVIEW_TYPES.includes(n.type) && parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(targetId));
    
    if (node) {
        if (node._breakout_history && node._breakout_history.length > 0) {
            return { history: node._breakout_history, index: node._breakout_history_index || 0 };
        }
        if (node.imgs && node.imgs.length > 0) {
            return { history: [{ imgUrl: node.imgs[0].src, textData: null }], index: 0 };
        }
    }
    return { history: [], index: 0 };
}

function updateFloatingPreview(id, history, index) {
    const panel = document.getElementById(`float-panel-${id}`);
    if (!panel) return;
    const container = panel.querySelector('.preview-container');
    const imgWrapper = panel.querySelector('.img-wrapper');
    const textWrapper = panel.querySelector('.text-wrapper');
    const imgEl = panel.querySelector('.preview-img');
    const textEl = panel.querySelector('.preview-text');
    const nav = panel.querySelector('.gallery-nav');
    const counter = panel.querySelector('.gal-counter');

    if (!history || history.length === 0) {
        container.style.display = "none";
        if (isZenMode) setTimeout(window.applyZenMasonry, 10);
        return;
    }

    container.style.display = "flex";
    const current = history[index] || history[history.length - 1];

    if (current.imgUrl) {
        imgEl.onload = () => { if (isZenMode) window.applyZenMasonry(); };
        imgEl.src = current.imgUrl;
        imgWrapper.style.display = "flex";
        textWrapper.style.display = "none";
    } else if (current.textData !== null && current.textData !== undefined) {
        textEl.innerText = current.textData;
        textWrapper.style.display = "flex";
        imgWrapper.style.display = "none";
        if (isZenMode) setTimeout(window.applyZenMasonry, 10);
    }

    if (history.length > 1) {
        nav.style.display = "flex";
        counter.innerText = `${index + 1}/${history.length}`;
    } else {
        nav.style.display = "none";
    }
}

// --- UPDATED: Toggle Zen Mode Uses Graph-Saved Order Array ---
function toggleZenMode() {
    initZenOverlay(); 
    isZenMode = !isZenMode;
    const btn = document.getElementById("btn-zen-mode");
    
    if (isZenMode) {
        try { openAllFloating(); } catch(e) { console.error(e); }
        
        const chk = document.getElementById("zen-open-ext-chk");
        if (chk && chk.checked) {
            try { openAllExternal(); } catch(e) { console.error(e); }
        }

        zenOverlay.style.display = "grid";
        
        let panels = Array.from(document.querySelectorAll('[id^="float-panel-"]'));
        panels.sort((a, b) => {
            let idA = a.id.replace('float-panel-', '');
            let idB = b.id.replace('float-panel-', '');
            let idxA = window._breakout_zen_order.indexOf(idA);
            let idxB = window._breakout_zen_order.indexOf(idB);
            if(idxA === -1) idxA = 9999;
            if(idxB === -1) idxB = 9999;
            return idxA - idxB;
        });

        panels.forEach(p => {
            p.classList.add("zen-active-panel");
            zenOverlay.appendChild(p);
        });
        
        if (btn) { btn.style.background = "#E91E63"; btn.innerHTML = "✖ Exit Zen Mode"; }
        
        let savedCols = localStorage.getItem('breakout_zen_cols') || 'auto';
        if (window.setZenCols) window.setZenCols(savedCols);

    } else {
        zenOverlay.style.display = "none";
        const closeOnExit = document.getElementById("chk-close-on-exit")?.checked;
        document.querySelectorAll('[id^="float-panel-"]').forEach(p => {
            p.classList.remove("zen-active-panel");
            document.body.appendChild(p);
        });
        if (btn) { btn.style.background = "#2196F3"; btn.innerHTML = "☯ Zen Mode"; }
        
        if (closeOnExit) closeAllOpenWindows();
        else refreshAllBreakoutWindows(); 
    }
}

function getNextAvailableId() {
    if (!app.graph || !app.graph._nodes) return 1;
    const ids = app.graph._nodes
        .filter(n => VALID_PREVIEW_TYPES.includes(n.type))
        .map(n => parseInt(n.widgets?.find(w => w.name === "window_id")?.value || 0));
    let next = 1;
    while (ids.includes(next)) next++;
    return next;
}

function forceUniqueIds() {
    if (!app.graph || !app.graph._nodes) return;
    const hubs = app.graph._nodes.filter(n => VALID_PREVIEW_TYPES.includes(n.type));
    hubs.sort((a, b) => a.pos[1] - b.pos[1] || a.pos[0] - b.pos[0]); 
    hubs.forEach((node, index) => {
        const idW = node.widgets?.find(w => w.name === "window_id");
        if (idW) idW.value = index + 1;
    });
    app.graph.setDirtyCanvas(true, false);
    refreshAllBreakoutWindows();
    renderDynamicSidebar();
}

function forceUniqueTitles() {
    if (!app.graph || !app.graph._nodes) return;
    const hubs = app.graph._nodes.filter(n => VALID_PREVIEW_TYPES.includes(n.type));
    let counters = { "Control": 1, "External": 1, "Floating": 1 };
    hubs.forEach((node) => {
        const titleW = node.widgets?.find(w => w.name === "window_title");
        const modeW = node.widgets?.find(w => w.name === "window_mode");
        if (titleW && modeW) {
            let mode = modeW.value, newTitle = "";
            if (mode.startsWith("Control Panel")) newTitle = `Breakout Control Window ${counters["Control"]++}`;
            else if (mode.includes("External")) newTitle = `Breakout External Window ${counters["External"]++}`;
            else newTitle = `Breakout Floating Window ${counters["Floating"]++}`;
            titleW.value = newTitle;
        }
    });
    app.graph.setDirtyCanvas(true, false);
    refreshAllBreakoutWindows();
    renderDynamicSidebar(); 
}

function forceSeedRandomization() {
    if (!app.graph || !app.graph._nodes) return;
    let changed = false;
    app.graph._nodes.forEach(node => {
        if (node.type === "BreakoutSeedControl") return;
        const modeW = node.widgets?.find(w => w.name === "control_after_generate");
        if (!modeW) return;
        
        let valW = node.widgets?.find(w => w.name === "seed" || w.name === "noise_seed");
        
        if (valW && modeW) {
            let v = valW.value;
            let updated = false;
            if (modeW.value === "increment") { v++; updated = true; }
            else if (modeW.value === "decrement") { v--; updated = true; }
            else if (modeW.value === "randomize") { v = Math.floor(Math.random() * 1125899906842624); updated = true; }
            
            if (updated) { valW.value = v; changed = true; }
        }
    });
    if (changed) app.graph.setDirtyCanvas(true, false);
}

async function triggerWindowQueue(targetId) {
    if (!app.graph) return;
    forceSeedRandomization();

    const p = await app.graphToPrompt();
    if (!p || !p.output) return;
    const previewNodes = app.graph._nodes.filter(n => VALID_PREVIEW_TYPES.includes(n.type) && parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(targetId));
    if (previewNodes.length === 0) { triggerQueuePrompt(); return; }
    const targetNodeIds = previewNodes.map(n => String(n.id)), dependencies = new Set();
    function traceBack(nodeId) {
        if (dependencies.has(nodeId)) return; dependencies.add(nodeId);
        const nodeData = p.output[nodeId]; if (!nodeData || !nodeData.inputs) return;
        for (let key in nodeData.inputs) {
            const input = nodeData.inputs[key];
            if (Array.isArray(input) && input.length === 2 && typeof input[0] === 'string' && p.output[input[0]]) traceBack(input[0]);
        }
    }
    targetNodeIds.forEach(id => traceBack(id));
    const isolatedOutput = {};
    for (let id of dependencies) { if (p.output[id]) isolatedOutput[id] = p.output[id]; }
    try { await api.queuePrompt(0, { output: isolatedOutput, workflow: p.workflow }); } catch (e) { console.error(e); }
}

function getWindowTitle(targetId) {
    if (!app.graph || !app.graph._nodes) return `Breakout Panel`;
    const node = app.graph._nodes.find(n => VALID_PREVIEW_TYPES.includes(n.type) && parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(targetId));
    return node?.widgets?.find(w => w.name === "window_title")?.value || `Breakout Panel`; 
}

function checkHasPreview(targetId) {
    if (!app.graph || !app.graph._nodes) return false;
    return app.graph._nodes.some(n => 
        VALID_PREVIEW_TYPES.includes(n.type) && 
        parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(targetId) && 
        !n.widgets?.find(w => w.name === "window_mode")?.value.startsWith("Control Panel")
    );
}

// --- UPDATED: Process Messages includes Layout Saves ---
function processMessage(data) {
    if (data.action === "refresh_all_externals") return;
    
    if (data.action === "save_ext_graph_order") {
        window._breakout_ext_order = data.order;
        if(app.graph) {
            app.graph.extra = app.graph.extra || {};
            app.graph.extra.breakout_state = app.graph.extra.breakout_state || {};
            app.graph.extra.breakout_state.ext_order = data.order;
            app.graph.setDirtyCanvas(true, false);
        }
    }
    
    if (data.action === "save_ext_cols") {
        localStorage.setItem('breakout_ext_cols', data.cols);
        if(app.graph) {
            app.graph.extra = app.graph.extra || {};
            app.graph.extra.breakout_state = app.graph.extra.breakout_state || {};
            app.graph.extra.breakout_state.ext_cols = data.cols;
            app.graph.setDirtyCanvas(true, false);
        }
    }

    if (data.action === "nav_gallery") {
        if (!app.graph || !app.graph._nodes) return;
        const node = app.graph._nodes.find(n => VALID_PREVIEW_TYPES.includes(n.type) && parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(data.winId));
        if (node && node._breakout_history) {
            let newIdx = (node._breakout_history_index || 0) + data.direction;
            if (newIdx < 0) newIdx = 0;
            if (newIdx >= node._breakout_history.length) newIdx = node._breakout_history.length - 1;
            node._breakout_history_index = newIdx;
            
            const previewData = getExistingPreviewData(data.winId);
            updateFloatingPreview(data.winId, previewData.history, previewData.index);
            channel.postMessage({ action: "update_preview", targetId: data.winId, history: previewData.history, index: previewData.index });
        }
    }

    if (data.action === "request_refresh") {
        const previewData = getExistingPreviewData(data.winId);
        channel.postMessage({ 
            action: "refresh_html", targetId: data.winId, 
            html: generateControlsHTML(getControlData(data.winId), data.winId), 
            hasPreviewNode: checkHasPreview(data.winId), 
            title: getWindowTitle(data.winId), 
            history: previewData.history,
            index: previewData.index,
            progress: globalProgressState
        });
    }
    if (data.action === "assign_window") {
        if (!app.graph || !app.graph._nodes) return;
        app.graph._nodes.filter(n => VALID_CONTROL_TYPES.includes(n.type)).forEach(n => {
            if (n.widgets?.find(w => w.name === "control_name")?.value === data.name) {
                const idW = n.widgets?.find(w => w.name === "window_id"); if (idW) idW.value = parseInt(data.targetId);
            }
        });
        app.graph.setDirtyCanvas(true, false); refreshAllBreakoutWindows();
    }
    if (data.action === "trigger_queue") triggerWindowQueue(data.winId);
    if (data.action === "trigger_queue_all") triggerQueuePrompt(); 
    if (data.action === "save_new_order") customOrder = data.order;
    if (data.action === "sync_val") {
        let wName = (data.type === "seed_mode") ? "control_after_generate" : "value";
        if (data.nodeIds) data.nodeIds.forEach(id => updateSpecificNodeOnCanvas(id, data.val, wName));
        
        document.querySelectorAll(`#float-panel-${data.targetId} .breakout-control`).forEach(fi => {
            if (fi.dataset.name === data.name && fi.dataset.nodetype === data.type && document.activeElement !== fi) {
                if (data.type === "bool") fi.checked = data.val;
                else {
                    fi.value = data.val;
                    if (fi.tagName === 'TEXTAREA') {
                        fi.style.height = 'auto';
                        fi.style.height = Math.min(fi.scrollHeight, 200) + 'px';
                    }
                }
            }
        });
        if (isZenMode && data.type === 'string') setTimeout(window.applyZenMasonry, 10);
    }
}
function sendSync(data) { processMessage(data); channel.postMessage(data); }
channel.onmessage = (event) => processMessage(event.data);

function getControlData(targetId) {
    if (!app.graph || !app.graph._nodes) return [];
    let grouped = {};
    app.graph._nodes.filter(n => VALID_CONTROL_TYPES.includes(n.type)).forEach(n => {
        if (parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(targetId)) {
            const name = n.widgets?.find(w => w.name === "control_name")?.value || `Node ${n.id}`;
            const type = n.type;
            const valWidget = n.widgets?.find(w => w.name === "value");
            let value = (type === "BreakoutStringControl") ? "" : (type === "BreakoutBoolControl" ? true : 0);
            if (valWidget) value = valWidget.value;
            
            let mode = "fixed";
            if (type === "BreakoutSeedControl") {
                const modeW = n.widgets?.find(w => w.name === "control_after_generate");
                if (modeW) mode = modeW.value;
            }
            
            const key = name + "_" + type; 
            if (!grouped[key]) grouped[key] = { name, type, value, mode, ids: [] };
            grouped[key].ids.push(n.id); grouped[key].value = value;
        }
    });
    let data = Object.values(grouped);
    data.sort((a, b) => {
        let iA = customOrder.indexOf(a.name), iB = customOrder.indexOf(b.name);
        return (iA === -1 ? 9999 : iA) - (iB === -1 ? 9999 : iB);
    });
    return data;
}

function updateSpecificNodeOnCanvas(nodeId, newValue, widgetName="value") {
    if (!app.graph) return;
    const node = app.graph.getNodeById(nodeId);
    if (node && node.widgets) {
        const widget = node.widgets.find(w => w.name === widgetName);
        if (widget) { widget.value = newValue; app.graph.setDirtyCanvas(true, false); }
    }
}

function setAllWindowModes(targetMainMode) {
    if (!app.graph || !app.graph._nodes) return;
    app.graph._nodes.forEach(n => {
        if (VALID_PREVIEW_TYPES.includes(n.type)) {
            const modeW = n.widgets?.find(w => w.name === "window_mode");
            if (modeW) {
                const isControl = modeW.value.startsWith("Control Panel");
                if (targetMainMode === "Floating") modeW.value = isControl ? "Control Panel (Float)" : "Floating";
                else modeW.value = isControl ? "Control Panel (External)" : "External";
                if (modeW.callback) modeW.callback(modeW.value);
            }
        }
    });
    app.graph.setDirtyCanvas(true);
    refreshAllBreakoutWindows();
    renderDynamicSidebar(); 
}

function closeAllOpenWindows() {
    document.querySelectorAll('[id^="float-panel-"]').forEach(p => p.remove());
    if (activeExternalWindows['master'] && !activeExternalWindows['master'].closed) {
        activeExternalWindows['master'].close();
    }
    activeExternalWindows = {};
    renderDynamicSidebar();
}

function openAllFloating() {
    if (!app.graph || !app.graph._nodes) return;
    const floatIds = new Set();
    app.graph._nodes.forEach(n => {
        if (VALID_PREVIEW_TYPES.includes(n.type)) {
            const id = n.widgets?.find(w => w.name === "window_id")?.value;
            const mode = n.widgets?.find(w => w.name === "window_mode")?.value;
            if (id && parseInt(id) > 0 && mode && typeof mode === 'string' && !mode.includes("External")) {
                floatIds.add(parseInt(id));
            }
        }
    });
    const arr = Array.from(floatIds); 
    arr.forEach((id, i) => createFloatingBreakout(id, i, arr.length));
}

function openExternalBreakoutWindow(id) {
    let win = activeExternalWindows['master'];
    if (!win || win.closed) {
        win = window.open("", `BreakoutMasterWin`, "width=1200,height=800");
        activeExternalWindows['master'] = win;
        win.document.open();
        win.document.write(getUnifiedExternalHTML());
        win.document.close();
        
        setTimeout(() => {
            processMessage({ action: "request_refresh", winId: id });
            renderDynamicSidebar(); 
        }, 500);
    } else {
        win.focus();
        processMessage({ action: "request_refresh", winId: id });
        renderDynamicSidebar();
    }
}

function openAllExternal() {
    if (!app.graph || !app.graph._nodes) return;
    const externalIds = new Set();
    app.graph._nodes.forEach(n => {
        if (VALID_PREVIEW_TYPES.includes(n.type)) {
            const id = n.widgets?.find(w => w.name === "window_id")?.value;
            const mode = n.widgets?.find(w => w.name === "window_mode")?.value;
            if (id && parseInt(id) > 0 && mode && typeof mode === 'string' && mode.includes("External")) {
                externalIds.add(parseInt(id));
            }
        }
    });
    
    if (externalIds.size > 0) {
        let win = activeExternalWindows['master'];
        if (!win || win.closed) {
            win = window.open("", `BreakoutMasterWin`, "width=1200,height=800");
            activeExternalWindows['master'] = win;
            win.document.open();
            win.document.write(getUnifiedExternalHTML());
            win.document.close();
            
            setTimeout(() => {
                externalIds.forEach(id => processMessage({ action: "request_refresh", winId: id }));
                // Push graph state array down to external
                channel.postMessage({ action: "sync_ext_order", order: window._breakout_ext_order });
                let extCols = localStorage.getItem('breakout_ext_cols') || 'auto';
                channel.postMessage({ action: "sync_ext_cols", cols: extCols });
                
                renderDynamicSidebar(); 
            }, 500);
        } else {
            win.focus();
            externalIds.forEach(id => processMessage({ action: "request_refresh", winId: id }));
            renderDynamicSidebar();
        }
    }
}

function getAvailableControls(targetId) {
    if (!app.graph || !app.graph._nodes) return [];
    const available = new Set();
    app.graph._nodes.filter(n => VALID_CONTROL_TYPES.includes(n.type)).forEach(n => {
        const name = n.widgets?.find(w => w.name === "control_name")?.value;
        const winId = parseInt(n.widgets?.find(w => w.name === "window_id")?.value || 0);
        if (winId !== parseInt(targetId) && name) available.add(name);
    });
    const current = getControlData(targetId).map(c => c.name);
    return Array.from(available).filter(n => !current.includes(n));
}

function generateControlsHTML(data, targetId) {
    const available = getAvailableControls(targetId);
    let html = `<div style="display:flex; gap:5px; margin-bottom:15px; border-bottom:1px solid #444; padding-bottom:10px;"><select id="add-ctrl-select-${targetId}" style="flex:1; padding:6px; background:#1a1a1a; color:white; border:1px solid #444; border-radius:4px; font-size:13px;"><option value="" disabled selected>-- Select Control --</option>${available.map(n => `<option value="${n}">${n}</option>`).join("")}</select><button class="btn-add-control" data-winid="${targetId}" style="background:#2196F3; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; font-size:13px;">+ Add</button></div>`;
    if (data.length === 0) return html + "<p style='color:#888; font-size:12px; padding:10px; text-align:center;'>No controls added yet.</p>";
    html += `<div id="sortable-list" style="display:flex; flex-direction:column; gap:8px; width:100%;">`;
    data.forEach(item => {
        const ids = item.ids.join(',');
        html += `<div class="control-row" data-name="${item.name}" style="display:flex; align-items:center; gap:10px; background:#2c2c2c; padding:8px 12px; border-radius:6px; border:1px solid #3c3c3c;"><div style="display:flex; flex-direction:column; gap:4px;"><button class="btn-move-up" style="background:none; border:none; color:#888; cursor:pointer; font-size:12px;">▲</button><button class="btn-move-down" style="background:none; border:none; color:#888; cursor:pointer; font-size:12px;">▼</button></div><label style="font-size:13px; font-weight:bold; width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</label>`;
        
        if (item.type === "BreakoutIntControl") html += `<input type="number" class="breakout-control" data-name="${item.name}" data-nodeids="${ids}" data-nodetype="int" value="${item.value}" style="flex-grow:1; padding:6px; background:#1a1a1a; color:white; border:1px solid #444; border-radius:4px; font-family:monospace; text-align:center;">`;
        else if (item.type === "BreakoutFloatControl") html += `<input type="number" class="breakout-control" data-name="${item.name}" data-nodeids="${ids}" data-nodetype="float" step="0.01" value="${Number(item.value).toFixed(2)}" style="flex-grow:1; padding:6px; background:#1a1a1a; color:white; border:1px solid #444; border-radius:4px; font-family:monospace; text-align:center;">`;
        else if (item.type === "BreakoutStringControl") html += `<textarea class="breakout-control" data-name="${item.name}" data-nodeids="${ids}" data-nodetype="string" oninput="this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 200) + 'px';" style="flex-grow:1; padding:6px; background:#1a1a1a; color:white; border:1px solid #444; border-radius:4px; font-family:sans-serif; resize:none; overflow-y:auto; height:auto; max-height:200px; line-height:1.4;">${item.value}</textarea>`;
        else if (item.type === "BreakoutBoolControl") html += `<div style="flex-grow:1; display:flex; align-items:center; justify-content:center;"><input type="checkbox" class="breakout-control" data-name="${item.name}" data-nodeids="${ids}" data-nodetype="bool" ${item.value?"checked":""} style="width:20px; height:20px; cursor:pointer; accent-color:#4CAF50;"></div>`;
        else if (item.type === "BreakoutSeedControl") html += `<div style="flex-grow:1; display:flex; gap:4px;"><input type="number" class="breakout-control" data-name="${item.name}" data-nodeids="${ids}" data-nodetype="seed" value="${item.value}" style="flex:1; padding:6px; background:#1a1a1a; color:white; border:1px solid #444; border-radius:4px; font-family:monospace; text-align:center; min-width:0;"><select class="breakout-control" data-name="${item.name}" data-nodeids="${ids}" data-nodetype="seed_mode" style="width:85px; padding:6px; background:#1a1a1a; color:white; border:1px solid #444; border-radius:4px; font-size:11px;"><option value="fixed" ${item.mode==="fixed"?"selected":""}>fixed</option><option value="increment" ${item.mode==="increment"?"selected":""}>increment</option><option value="decrement" ${item.mode==="decrement"?"selected":""}>decrement</option><option value="randomize" ${item.mode==="randomize"?"selected":""}>randomize</option></select></div>`;
        
        html += `<button class="btn-remove-ctrl" data-name="${item.name}" style="background:none; border:none; color:#ff5555; cursor:pointer; font-weight:bold;">✖</button></div>`;
    });
    return html + `</div>`;
}

function attachUIEvents(container, isExternal = false, id) {
    container.querySelectorAll('.breakout-control').forEach(c => {
        if(c.tagName === 'TEXTAREA') {
            c.style.height = 'auto'; 
            c.style.height = Math.min(c.scrollHeight, 200) + 'px';
        }
        c.oninput = c.onchange = (e) => {
            const type = e.target.dataset.nodetype, name = e.target.dataset.name, ids = e.target.dataset.nodeids.split(',').map(n => parseInt(n));
            let val = (type === "bool") ? e.target.checked : e.target.value;
            if (val === "" && type !== "string" && type !== "bool") return;
            
            if (type === "int" || type === "seed") val = parseInt(val, 10) || 0; 
            else if (type === "float") val = parseFloat(val) || 0.0;
            
            let wName = (type === "seed_mode") ? "control_after_generate" : "value";
            ids.forEach(nId => updateSpecificNodeOnCanvas(nId, val, wName));
            
            sendSync({ action: "sync_val", nodeIds: ids, val, type, name, targetId: id });
        }
    });
    const updateOrder = () => {
        const list = container.querySelector('#sortable-list'); if (!list) return;
        sendSync({ action: "save_new_order", order: Array.from(list.querySelectorAll('.control-row')).map(r => r.dataset.name), targetId: id });
    };
    container.querySelectorAll('.btn-move-up').forEach(b => b.onclick = () => { const r = b.closest('.control-row'); if (r && r.previousElementSibling) { r.parentNode.insertBefore(r, r.previousElementSibling); updateOrder(); }});
    container.querySelectorAll('.btn-move-down').forEach(b => b.onclick = () => { const r = b.closest('.control-row'); if (r && r.nextElementSibling) { r.parentNode.insertBefore(r.nextElementSibling, r); updateOrder(); }});
    const add = container.querySelector('.btn-add-control'); if (add) add.onclick = () => { const s = container.querySelector('#add-ctrl-select-'+id); if (s && s.value) sendSync({ action: "assign_window", name: s.value, targetId: id });};
    container.querySelectorAll('.btn-remove-ctrl').forEach(b => b.onclick = (e) => sendSync({ action: "assign_window", name: e.target.dataset.name, targetId: 0 }));
}

function refreshAllBreakoutWindows() {
    document.querySelectorAll('[id^="float-panel-"]').forEach(p => {
        const id = p.id.replace("float-panel-", ""), titleDisplay = p.querySelector(".panel-title-display"), list = p.querySelector(".controls-list");
        if (titleDisplay) titleDisplay.innerText = getWindowTitle(id);
        if (list) {
            list.innerHTML = generateControlsHTML(getControlData(id), id); attachUIEvents(p, false, id);
            const hasPreview = checkHasPreview(id), wrapper = p.querySelector(".preview-container"), runBtn = p.querySelector(".q-run-win-btn");
            if (hasPreview) { 
                wrapper.style.display = "flex"; 
                runBtn.style.display = "inline-block"; 
                
                const previewData = getExistingPreviewData(id);
                updateFloatingPreview(id, previewData.history, previewData.index);
            } else { 
                wrapper.style.display = "none"; runBtn.style.display = "none"; 
                if (isZenMode) setTimeout(window.applyZenMasonry, 10);
            }
        }
    });
    channel.postMessage({ action: "refresh_all_externals" });
}

// --- UPDATED: Zen Mode dragging registers graph saves ---
function createFloatingBreakout(rawId, index = -1, total = 1) {
    const id = String(rawId).trim(); if (!id || id === "0") return;
    const pId = `float-panel-${id}`; if (document.getElementById(pId)) return;
    
    let topPos = "10vh", leftPos = "", rightPos = "5vw";
    if (index >= 0 && total > 1) {
        const panelWidth = 512, gap = 20, maxCols = Math.max(1, Math.floor((window.innerWidth - gap) / (panelWidth + gap))), cols = Math.min(total, maxCols), colI = index % cols, rowI = Math.floor(index / cols), rowW = (cols * panelWidth) + ((cols - 1) * gap);
        leftPos = `${Math.max(20, (window.innerWidth - rowW) / 2) + colI * (panelWidth + gap)}px`; topPos = `calc(10vh + ${rowI * 60}px)`; rightPos = "auto";
    }
    
    const win = document.createElement("div"); win.id = pId;
    Object.assign(win.style, { position: "fixed", top: topPos, width: "512px", minHeight: "100px", height: "auto", backgroundColor: "#1e1e1e", border: "1px solid #444", borderRadius: "8px", zIndex: "9999", display: "flex", flexDirection: "column", boxShadow: "0 10px 25px rgba(0,0,0,0.8)", overflow: "hidden", resize: "both", transition: "box-shadow 0.3s ease" });
    if (leftPos) win.style.left = leftPos; else win.style.right = rightPos;
    
    win.innerHTML = `
        <div class="drag-handle" style="padding:10px 15px; background:#2a2a2a; cursor:grab; display:flex; justify-content:space-between; align-items:center; color:white; font-family:sans-serif; border-bottom:1px solid #444;" title="Drag to move or reorder">
            <span class="panel-title-display" style="color:white; font-weight:bold; font-size:16px; pointer-events:none;">${getWindowTitle(id)}</span>
            <span class="close-btn" style="cursor:pointer; color:#ff5555; font-weight:bold; font-size:16px;">✖</span>
        </div>
        <div class="preview-container" style="display:none; flex:1; min-height: 200px; background:#000; overflow:hidden;">
            <div class="img-wrapper" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;"><img class="preview-img" style="max-width:100%; max-height:100%; object-fit:contain;"></div>
            <div class="text-wrapper" style="display:none; width:100%; height:100%; align-items:flex-start; justify-content:flex-start; padding:15px; box-sizing:border-box; overflow:auto; background:#111;"><pre class="preview-text" style="color:#fff; font-family:monospace; font-size:14px; white-space:pre-wrap; word-break:break-word; margin:0;"></pre></div>
        </div>
        <div style="padding:15px; background:#222; border-top:1px solid #444; color:white;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:8px; margin-bottom:10px;">
                <strong>Controls <span style="color:#aaa; font-size:12px; margin-left:5px;">(ID: ${id})</span></strong>
                <div style="display:flex; align-items:center; gap:5px;">
                    <div class="gallery-nav" style="display:none; background:#111; padding:4px 8px; border-radius:4px; border:1px solid #444; color:#ccc; font-size:11px; gap:8px; align-items:center; user-select:none;">
                        <span class="gal-prev" style="cursor:pointer; padding:0 4px;">◀</span>
                        <span class="gal-counter" style="font-family:monospace; color:white;">1/1</span>
                        <span class="gal-next" style="cursor:pointer; padding:0 4px;">▶</span>
                    </div>
                    <button class="q-run-win-btn" style="display:none; background:#4CAF50; color:white; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:bold;">🚀 Run Window</button>
                    <button class="ref-btn" style="background:#444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">↻ Refresh</button>
                </div>
            </div>
            <div class="controls-list" style="overflow-y:auto; max-height:400px;"></div>
        </div>`;
    
    if (isZenMode) {
        initZenOverlay(); 
        win.classList.add("zen-active-panel");
        zenOverlay.appendChild(win);
    } else {
        document.body.appendChild(win);
    }

    win.querySelector(".close-btn").onclick = () => { win.remove(); renderDynamicSidebar(); if(isZenMode) window.applyZenMasonry(); };
    win.querySelector(".q-run-win-btn").onclick = () => sendSync({ action: "trigger_queue", winId: id });
    win.querySelector(".ref-btn").onclick = refreshAllBreakoutWindows;
    
    win.querySelector(".gal-prev").onclick = () => sendSync({ action: "nav_gallery", winId: id, direction: -1 });
    win.querySelector(".gal-next").onclick = () => sendSync({ action: "nav_gallery", winId: id, direction: 1 });
    
    const h = win.querySelector(".drag-handle"); 
    h.onmousedown = (e) => { 
        if (["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(e.target.tagName)) return; 
        
        if (isZenMode) {
            win.setAttribute('draggable', 'true');
        } else {
            let sX = e.clientX - win.offsetLeft, sY = e.clientY - win.offsetTop; 
            document.onmousemove = (ev) => { win.style.left = (ev.clientX - sX) + "px"; win.style.top = (ev.clientY - sY) + "px"; }; 
            document.onmouseup = () => { document.onmousemove = null; }; 
        }
    };
    h.onmouseup = () => { if(isZenMode) win.removeAttribute('draggable'); };
    h.onmouseleave = () => { if(isZenMode) win.removeAttribute('draggable'); };

    win.ondragstart = (e) => {
        if (!isZenMode) return;
        window._zenDraggedPanel = win;
        setTimeout(() => win.classList.add('zen-dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
    };
    win.ondragend = () => {
        if (!isZenMode) return;
        win.classList.remove('zen-dragging');
        win.removeAttribute('draggable');
        window._zenDraggedPanel = null;
        window.applyZenMasonry();
        
        // Save Zen order to Graph
        if (zenOverlay && app.graph) {
            window._breakout_zen_order = Array.from(zenOverlay.children)
                .filter(c => c.id && c.id.startsWith('float-panel-'))
                .map(c => c.id.replace('float-panel-', ''));
            app.graph.extra = app.graph.extra || {};
            app.graph.extra.breakout_state = app.graph.extra.breakout_state || {};
            app.graph.extra.breakout_state.zen_order = window._breakout_zen_order;
            app.graph.setDirtyCanvas(true, false);
        }
    };
    win.ondragover = (e) => { if(isZenMode) e.preventDefault(); };
    win.ondragenter = function(e) {
        if (!isZenMode) return;
        e.preventDefault();
        if (window._zenDraggedPanel && window._zenDraggedPanel !== this) {
            const allPanels = Array.from(zenOverlay.children).filter(c => c.id.startsWith('float-panel'));
            const draggedIndex = allPanels.indexOf(window._zenDraggedPanel);
            const targetIndex = allPanels.indexOf(this);
            if (draggedIndex < targetIndex) zenOverlay.insertBefore(window._zenDraggedPanel, this.nextSibling);
            else zenOverlay.insertBefore(window._zenDraggedPanel, this);
            window.applyZenMasonry(); 
        }
    };
    
    setTimeout(() => { 
        if (checkHasPreview(id)) { 
            win.querySelector(".preview-container").style.display = "flex"; 
            win.querySelector(".q-run-win-btn").style.display = "inline-block"; 
            
            const previewData = getExistingPreviewData(id);
            updateFloatingPreview(id, previewData.history, previewData.index);
        } 
        win.querySelector(".controls-list").innerHTML = generateControlsHTML(getControlData(id), id); 
        attachUIEvents(win, false, id); 
        renderDynamicSidebar();
        if (isZenMode) setTimeout(window.applyZenMasonry, 50);
    }, 50);
}

// --- UPDATED: External HTML emits saving logic back to Graph ---
function getUnifiedExternalHTML() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Breakout Dashboard (External)</title>
    <style>
        body { margin:0; background:#0b0b0b; color:white; font-family:sans-serif; padding: 20px; overflow-y:auto; }
        #grid-container { 
            display: grid; 
            grid-template-columns: repeat(var(--ext-cols, auto-fit), minmax(450px, 1fr)); 
            grid-auto-rows: 10px; row-gap: 20px; column-gap: 20px;
            grid-auto-flow: row dense; align-items: start; 
        }
        .ext-panel { background: #1e1e1e; border: 1px solid #444; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.8); transition: opacity 0.2s; height: max-content; }
        .ext-panel.dragging { opacity: 0.4 !important; border: 2px dashed #2196F3 !important; }
        .ext-header { padding:10px 15px; background:#2a2a2a; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center; cursor:grab; }
        .ext-header:active { cursor:grabbing; }
        .ext-preview-container { display:none; background:#000; min-height: 200px; overflow:hidden; position:relative; }
        .ext-img-box { display:none; width:100%; height:100%; align-items:center; justify-content:center; }
        .ext-text-box { display:none; width:100%; height:100%; align-items:flex-start; justify-content:flex-start; padding:15px; box-sizing:border-box; overflow:auto; background:#111; }
        .view-text { color:white; font-family:monospace; font-size:14px; white-space:pre-wrap; word-break:break-word; margin:0; }
        .ext-controls { padding:15px; background:#222; overflow-y:auto; max-height:400px; }
        
        .col-btn { background: #222; color: #aaa; border: none; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 11px; font-weight:bold; transition: 0.1s; }
        .col-btn:hover { background: #333; }
    </style>
</head>
<body>
    <div style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #333; padding-bottom: 10px;">
        <h2>Breakout Dashboard</h2>
        
        <div id="ext-progress-container" style="flex:1; max-width: 400px; display:none; flex-direction:column; margin: 0 20px;">
            <div style="font-size:11px; color:#ccc; margin-bottom:4px; display:flex; justify-content:space-between; font-family:sans-serif;">
                <span id="ext-progress-text" style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Idle</span>
                <span id="ext-progress-pct">0%</span>
            </div>
            <div style="width:100%; background:#222; height:8px; border-radius:4px; overflow:hidden; border:1px solid #333;">
                <div id="ext-progress-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #4CAF50, #8BC34A); transition:width 0.1s linear;"></div>
            </div>
        </div>

        <div style="display:flex; align-items:center; gap:5px; background:#1a1a1a; padding:4px 8px; border-radius:4px; border:1px solid #333; margin-right: 15px;">
            <span style="color:#aaa; font-size:11px; margin-right:4px;">Cols:</span>
            <button class="col-btn" data-cols="1" onclick="setCols('1')">1</button>
            <button class="col-btn" data-cols="2" onclick="setCols('2')">2</button>
            <button class="col-btn" data-cols="3" onclick="setCols('3')">3</button>
            <button class="col-btn" data-cols="4" onclick="setCols('4')">4</button>
            <button class="col-btn" data-cols="5" onclick="setCols('5')">5</button>
            <button class="col-btn" data-cols="auto" onclick="setCols('auto')">Auto</button>
        </div>

        <button onclick="bc.postMessage({action:'trigger_queue_all'})" style="background:#2196F3; color:white; border:none; border-radius:4px; padding:8px 16px; cursor:pointer; font-weight:bold;">🌍 Run All</button>
    </div>
    <div id="grid-container"></div>
    <script>
        const bc = new BroadcastChannel("comfy_breakout_channel");
        let draggedPanel = null;
        let currentCols = localStorage.getItem('breakout_ext_cols') || 'auto';
        let extOrderMemory = []; // Bound to graph JSON

        function setCols(cols) {
            currentCols = cols;
            localStorage.setItem('breakout_ext_cols', cols);
            const container = document.getElementById('grid-container');
            if (cols === 'auto') {
                container.style.gridTemplateColumns = "repeat(auto-fit, minmax(450px, 1fr))";
            } else {
                container.style.gridTemplateColumns = \`repeat(\${cols}, 1fr)\`;
            }
            document.querySelectorAll('.col-btn').forEach(b => {
                b.style.background = b.dataset.cols == cols ? '#2196F3' : '#222';
                b.style.color = b.dataset.cols == cols ? 'white' : '#aaa';
            });
            setTimeout(applyMasonry, 50);
            bc.postMessage({ action: "save_ext_cols", cols: cols });
        }

        function applyMasonry() {
            const container = document.getElementById('grid-container');
            const panels = container.querySelectorAll('.ext-panel');
            panels.forEach(p => {
                p.style.gridRowEnd = 'auto'; 
                const height = p.scrollHeight;
                const span = Math.ceil((height + 20) / 30); 
                p.style.gridRowEnd = 'span ' + span;
            });
        }
        window.addEventListener('resize', applyMasonry);
        setTimeout(() => setCols(currentCols), 100); 

        function saveExtOrder() {
            const order = Array.from(document.querySelectorAll('.ext-panel')).map(p => p.dataset.winid);
            localStorage.setItem('breakout_ext_order', JSON.stringify(order));
            bc.postMessage({ action: "save_ext_graph_order", order: order });
        }

        function applySavedOrder() {
            const order = extOrderMemory.length > 0 ? extOrderMemory : JSON.parse(localStorage.getItem('breakout_ext_order') || "[]");
            const container = document.getElementById('grid-container');
            order.forEach(id => {
                const panel = document.getElementById('panel-' + id);
                if (panel) container.appendChild(panel);
            });
            applyMasonry();
        }

        function attachDragEvents(panel) {
            const header = panel.querySelector('.ext-header');
            
            header.onmousedown = () => panel.setAttribute('draggable', 'true');
            header.onmouseup = () => panel.removeAttribute('draggable');
            header.onmouseleave = () => panel.removeAttribute('draggable');

            panel.ondragstart = (e) => {
                draggedPanel = panel;
                setTimeout(() => panel.classList.add('dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
            };

            panel.ondragend = () => {
                panel.classList.remove('dragging');
                panel.removeAttribute('draggable');
                draggedPanel = null;
                saveExtOrder();
                applyMasonry();
            };

            panel.ondragover = (e) => {
                e.preventDefault(); 
            };

            panel.ondragenter = function(e) {
                e.preventDefault();
                if (draggedPanel && draggedPanel !== this) {
                    const container = document.getElementById('grid-container');
                    const allPanels = Array.from(container.children);
                    const draggedIndex = allPanels.indexOf(draggedPanel);
                    const targetIndex = allPanels.indexOf(this);
                    
                    if (draggedIndex < targetIndex) container.insertBefore(draggedPanel, this.nextSibling);
                    else container.insertBefore(draggedPanel, this);
                    applyMasonry(); 
                }
            };
        }

        function attachUIEvents(winId) {
            const panel = document.getElementById('panel-' + winId);
            if (!panel) return;
            
            panel.querySelectorAll('.breakout-control').forEach(c => {
                if(c.tagName === 'TEXTAREA') { 
                    c.style.height = 'auto'; 
                    c.style.height = Math.min(c.scrollHeight, 200) + 'px'; 
                    applyMasonry(); 
                }
                c.oninput = c.onchange = (e) => {
                    const t = e.target.dataset.nodetype, n = e.target.dataset.name, ids = e.target.dataset.nodeids.split(',').map(x => parseInt(x));
                    let v = (t === "bool") ? e.target.checked : e.target.value;
                    if (v === "" && t !== "string" && t !== "bool") return;
                    if (t === "int" || t === "seed") v = parseInt(v, 10) || 0; 
                    else if (t === "float") v = parseFloat(v) || 0.0;
                    bc.postMessage({ action: "sync_val", nodeIds: ids, val: v, type: t, name: n, targetId: winId });
                };
            });

            const list = panel.querySelector('#sortable-list');
            if (list) {
                list.querySelectorAll('.btn-move-up').forEach(b => b.onclick = () => {
                    const r = b.closest('.control-row'); 
                    if (r && r.previousElementSibling) { 
                        r.parentNode.insertBefore(r, r.previousElementSibling); 
                        bc.postMessage({ action: "save_new_order", order: Array.from(list.querySelectorAll('.control-row')).map(x => x.dataset.name), targetId: winId });
                    }
                });
                list.querySelectorAll('.btn-move-down').forEach(b => b.onclick = () => {
                    const r = b.closest('.control-row'); 
                    if (r && r.nextElementSibling) { 
                        r.parentNode.insertBefore(r, r.nextElementSibling); 
                        bc.postMessage({ action: "save_new_order", order: Array.from(list.querySelectorAll('.control-row')).map(x => x.dataset.name), targetId: winId });
                    }
                }); 
            }

            const addBtn = panel.querySelector('.btn-add-control');
            if (addBtn) {
                addBtn.onclick = () => {
                    const s = panel.querySelector('#add-ctrl-select-' + winId); 
                    if (s && s.value) bc.postMessage({ action: "assign_window", name: s.value, targetId: winId });
                };
            }

            panel.querySelectorAll('.btn-remove-ctrl').forEach(b => {
                b.onclick = (e) => bc.postMessage({ action: "assign_window", name: e.target.dataset.name, targetId: 0 });
            });
        }

        bc.onmessage = (e) => {
            const data = e.data;
            if (data.action === "refresh_all_externals") {
                document.querySelectorAll('.ext-panel').forEach(p => {
                    bc.postMessage({ action: "request_refresh", winId: p.dataset.winid });
                });
                return;
            }
            
            if (data.action === "sync_ext_order") {
                extOrderMemory = data.order || [];
                applySavedOrder();
                return;
            }
            
            if (data.action === "sync_ext_cols") {
                setCols(data.cols);
                return;
            }
            
            if (data.action === "sync_progress") {
                const cont = document.getElementById("ext-progress-container");
                if (cont) {
                    cont.style.display = data.isVisible ? "flex" : "none";
                    document.getElementById("ext-progress-text").innerText = data.text;
                    document.getElementById("ext-progress-pct").innerText = data.pct + "%";
                    document.getElementById("ext-progress-fill").style.width = data.pct + "%";
                }
                return;
            }
            
            const winId = data.targetId || data.winId;
            if (!winId) return;

            if (data.action === "update_preview") { 
                const container = document.querySelector(\`#panel-\${winId} .ext-preview-container\`);
                const imgBox = document.querySelector(\`#panel-\${winId} .ext-img-box\`);
                const textBox = document.querySelector(\`#panel-\${winId} .ext-text-box\`);
                const img = document.querySelector(\`#panel-\${winId} .view-img\`);
                const txt = document.querySelector(\`#panel-\${winId} .view-text\`);
                const nav = document.querySelector(\`#panel-\${winId} .gallery-nav\`);
                const counter = document.querySelector(\`#panel-\${winId} .gal-counter\`);
                
                if (container && imgBox && textBox && img && txt) {
                    if (!data.history || data.history.length === 0) {
                        container.style.display = "none";
                        setTimeout(applyMasonry, 10);
                        return;
                    }
                    
                    const current = data.history[data.index] || data.history[data.history.length - 1];

                    if (current.imgUrl) {
                        img.onload = applyMasonry; 
                        img.src = current.imgUrl.startsWith('/') ? window.opener.location.origin + current.imgUrl : current.imgUrl;
                        imgBox.style.display = "flex";
                        textBox.style.display = "none";
                        container.style.display = "flex";
                    } else if (current.textData !== null && current.textData !== undefined) {
                        txt.innerText = current.textData;
                        textBox.style.display = "flex";
                        imgBox.style.display = "none";
                        container.style.display = "flex";
                        setTimeout(applyMasonry, 10);
                    }
                    
                    if (nav && counter) {
                        if (data.history.length > 1) {
                            nav.style.display = "flex";
                            counter.innerText = (data.index + 1) + "/" + data.history.length;
                        } else {
                            nav.style.display = "none";
                        }
                    }
                }
            }
            
            if (data.action === "refresh_html") { 
                let panel = document.getElementById("panel-" + winId);
                if (!panel) {
                    panel = document.createElement("div");
                    panel.id = "panel-" + winId;
                    panel.className = "ext-panel";
                    panel.dataset.winid = winId;
                    panel.innerHTML = \`
                        <div class="ext-header" title="Drag to reorder window">
                            <span class="ext-title-display" style="color:white; font-weight:bold; font-size:16px; pointer-events:none;"></span>
                            <span class="close-btn" style="cursor:pointer; color:#ff5555; font-weight:bold; font-size:16px;" onclick="this.closest('.ext-panel').remove(); saveExtOrder(); applyMasonry();">✖</span>
                        </div>
                        <div class="ext-preview-container">
                            <div class="ext-img-box"><img class="view-img" style="max-width:100%; max-height:100%; object-fit:contain;"></div>
                            <div class="ext-text-box"><pre class="view-text"></pre></div>
                        </div>
                        <div class="ext-controls">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:8px; margin-bottom:10px;">
                                <strong>Controls <span class="ext-id-display" style="color:#aaa; font-size:12px; margin-left:5px;"></span></strong>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <div class="gallery-nav" style="display:none; background:#111; padding:4px 8px; border-radius:4px; border:1px solid #444; color:#ccc; font-size:11px; gap:8px; align-items:center; user-select:none;">
                                        <span class="gal-prev" style="cursor:pointer; padding:0 4px;" onclick="bc.postMessage({action:'nav_gallery', winId:\${winId}, direction:-1})">◀</span>
                                        <span class="gal-counter" style="font-family:monospace; color:white;">1/1</span>
                                        <span class="gal-next" style="cursor:pointer; padding:0 4px;" onclick="bc.postMessage({action:'nav_gallery', winId:\${winId}, direction:1})">▶</span>
                                    </div>
                                    <button class="q-run-win-btn" onclick="bc.postMessage({action:'trigger_queue', winId:\${winId}})" style="display:none; background:#4CAF50; color:white; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:bold;">🚀 Run Window</button>
                                    <button onclick="bc.postMessage({action:'request_refresh', winId:\${winId}})" style="background:#444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">↻ Refresh</button>
                                </div>
                            </div>
                            <div class="list-container"></div>
                        </div>
                    \`;
                    document.getElementById("grid-container").appendChild(panel);
                    attachDragEvents(panel);
                    
                    clearTimeout(window.orderTimeout);
                    window.orderTimeout = setTimeout(applySavedOrder, 50);
                }
                
                panel.querySelector(".ext-title-display").innerText = data.title;
                panel.querySelector(".ext-id-display").innerText = "(ID: " + winId + ")";
                panel.querySelector(".list-container").innerHTML = data.html; 
                
                const container = panel.querySelector(".ext-preview-container");
                const runBtn = panel.querySelector(".q-run-win-btn");
                if(!data.hasPreviewNode) { 
                    container.style.display = "none"; 
                    runBtn.style.display = "none"; 
                } else { 
                    runBtn.style.display = "inline-block"; 
                    const imgBox = panel.querySelector(".ext-img-box");
                    const textBox = panel.querySelector(".ext-text-box");
                    const img = panel.querySelector(".view-img");
                    const txt = panel.querySelector(".view-text");
                    const nav = panel.querySelector(".gallery-nav");
                    const counter = panel.querySelector(".gal-counter");
                    
                    if (data.history && data.history.length > 0) {
                        const current = data.history[data.index] || data.history[data.history.length - 1];
                        if (current.imgUrl) {
                            img.onload = applyMasonry;
                            img.src = current.imgUrl.startsWith('/') ? window.opener.location.origin + current.imgUrl : current.imgUrl;
                            imgBox.style.display = "flex";
                            textBox.style.display = "none";
                            container.style.display = "flex";
                        } else if (current.textData !== null && current.textData !== undefined) {
                            txt.innerText = current.textData;
                            textBox.style.display = "flex";
                            imgBox.style.display = "none";
                            container.style.display = "flex";
                        }
                        
                        if (data.history.length > 1) {
                            nav.style.display = "flex";
                            counter.innerText = (data.index + 1) + "/" + data.history.length;
                        } else {
                            nav.style.display = "none";
                        }
                    } else {
                        container.style.display = "flex";
                        imgBox.style.display = "none";
                        textBox.style.display = "none";
                        if (nav) nav.style.display = "none";
                    }
                }
                
                attachUIEvents(winId);
                setTimeout(applyMasonry, 50); 
                
                if (data.progress) {
                    const cont = document.getElementById("ext-progress-container");
                    if (cont) {
                        cont.style.display = data.progress.isVisible ? "flex" : "none";
                        document.getElementById("ext-progress-text").innerText = data.progress.text;
                        document.getElementById("ext-progress-pct").innerText = data.progress.pct + "%";
                        document.getElementById("ext-progress-fill").style.width = data.progress.pct + "%";
                    }
                }
            }
            
            if (data.action === "sync_val") { 
                document.querySelectorAll(\`#panel-\${winId} .breakout-control\`).forEach(c => { 
                    if (c.dataset.name === data.name && c.dataset.nodetype === data.type && document.activeElement !== c) { 
                        if (data.type === "bool") c.checked = data.val; 
                        else { 
                            c.value = data.val; 
                            if(c.tagName === 'TEXTAREA') { c.style.height = 'auto'; c.style.height = Math.min(c.scrollHeight, 200) + 'px'; applyMasonry(); } 
                        } 
                    } 
                }); 
            }
        };
        
        bc.postMessage({ action: "refresh_all_externals" });
    </script>
</body>
</html>`;
}

api.addEventListener("executed", (e) => {
    if (!app.graph || !app.graph.getNodeById) return;
    const node = app.graph.getNodeById(e.detail.node);
    if (!node) return;

    if (VALID_PREVIEW_TYPES.includes(node.type)) {
        const id = node.widgets?.find(w => w.name === "window_id")?.value || 1;
        const out = e.detail.output;

        if (out && out.images && out.images.length > 0) {
            if (!node._breakout_history) node._breakout_history = [];
            
            out.images.forEach(img => {
                let imgUrl = `/view?filename=${img.filename}&type=${img.type}&subfolder=${img.subfolder}&t=${Date.now()}`;
                node._breakout_history.push({ imgUrl, textData: null });
            });

            if (node._breakout_history.length > 10) node._breakout_history = node._breakout_history.slice(-10);
            node._breakout_history_index = node._breakout_history.length - 1;

            updateFloatingPreview(id, node._breakout_history, node._breakout_history_index);
            channel.postMessage({ action: "update_preview", targetId: id, history: node._breakout_history, index: node._breakout_history_index });
        
        } else if (out && out.text && out.text.length > 0) {
            if (!node._breakout_history) node._breakout_history = [];
            
            out.text.forEach(txt => {
                node._breakout_history.push({ imgUrl: null, textData: txt });
            });

            if (node._breakout_history.length > 10) node._breakout_history = node._breakout_history.slice(-10);
            node._breakout_history_index = node._breakout_history.length - 1;

            updateFloatingPreview(id, node._breakout_history, node._breakout_history_index);
            channel.postMessage({ action: "update_preview", targetId: id, history: node._breakout_history, index: node._breakout_history_index });
        }
    }
});

api.addEventListener("executing", (e) => {
    const nodeId = e.detail;
    
    if (nodeId) {
        if (app.graph) {
            const node = app.graph.getNodeById(nodeId);
            currentExecutingNode = node ? (node.title || node.type) : "Processing...";
        } else {
            currentExecutingNode = "Processing...";
        }
        updateGlobalProgress(currentExecutingNode, 0, true);
    } else {
        currentExecutingNode = "";
        updateGlobalProgress("Idle", 0, false);
        
        if (!app.graph || !app.graph._nodes) return;
        app.graph._nodes.forEach(node => {
            if (node.type === "BreakoutSeedControl") {
                const valW = node.widgets?.find(w => w.name === "value");
                const modeW = node.widgets?.find(w => w.name === "control_after_generate");
                if (valW && modeW) {
                    let v = valW.value;
                    let changed = false;
                    
                    if (modeW.value === "increment") { v++; changed = true; }
                    else if (modeW.value === "decrement") { v--; changed = true; }
                    else if (modeW.value === "randomize") { 
                        v = Math.floor(Math.random() * 1125899906842624); 
                        changed = true; 
                    }
                    
                    if (changed) {
                        valW.value = v;
                        app.graph.setDirtyCanvas(true, false);
                        const winId = parseInt(node.widgets?.find(w => w.name === "window_id")?.value || 0);
                        const nameW = node.widgets?.find(w => w.name === "control_name")?.value;
                        sendSync({ action: "sync_val", nodeIds: [node.id], val: v, type: "seed", targetId: winId, name: nameW });
                    }
                }
            }
        });
    }
});

api.addEventListener("progress", (e) => {
    const val = e.detail.value;
    const max = e.detail.max;
    const pct = max > 0 ? Math.round((val / max) * 100) : 0;
    updateGlobalProgress(currentExecutingNode || "Processing...", pct, true);
});

let lastSidebarHTML = "";
function renderDynamicSidebar() {
    const containers = document.querySelectorAll("#breakout-dynamic-list"); 
    if (containers.length === 0 || !app.graph) return; 
    
    const windows = app.graph._nodes.filter(n => VALID_PREVIEW_TYPES.includes(n.type));
    windows.sort((a, b) => parseInt(a.widgets?.find(w => w.name === "window_id")?.value || 0) - parseInt(b.widgets?.find(w => w.name === "window_id")?.value || 0));

    let hasFloat = false;
    let hasExt = false;

    let html = windows.length === 0 ? `<div style="text-align:center; padding:20px; color:#888; font-size:13px; background:#111; border-radius:6px; border:1px dashed #444;">No Hubs.</div>` : "";
    windows.forEach(n => {
        const id = n.widgets?.find(w => w.name === "window_id")?.value || "?", title = n.widgets?.find(w => w.name === "window_title")?.value || "Window", mode = n.widgets?.find(w => w.name === "window_mode")?.value || "Floating";
        const icon = mode.includes("External") ? "🌐" : (mode.includes("Control") ? "🎛️" : "🪟");
        
        if (mode.includes("External")) hasExt = true;
        else hasFloat = true;

        const options = ["Floating", "External", "Control Panel (Float)", "Control Panel (External)"];
        let selectHtml = `<select onchange="window.changeBreakoutWindowMode(${n.id}, this.value)" style="background:transparent; color:#aaa; border:1px solid #333; border-radius:3px; font-size:10px; cursor:pointer; outline:none; padding:1px 4px; margin-left:4px;">`;
        options.forEach(opt => {
            selectHtml += `<option value="${opt}" ${mode === opt ? "selected" : ""} style="background:#1a1a1a; color:white;">${opt}</option>`;
        });
        selectHtml += `</select>`;

        html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid #444;"><div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; margin-right:10px;"><strong style="color:white; font-size:14px;">${icon} ${title}</strong><br><span style="color:#aaa; font-size:11px; display:flex; align-items:center; margin-top:2px;">ID: ${id} | ${selectHtml}</span></div><button onclick="window.launchBreakoutWindow(${id}, '${mode}')" style="background:#2196F3; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; font-size:12px;">Launch</button></div>`;
    });
    
    containers.forEach(container => {
        if (html !== container.dataset.lastHtml || container.innerHTML.trim() === "") { 
            container.innerHTML = html; 
            container.dataset.lastHtml = html; 
        }
    });

    document.querySelectorAll("#btn-open-floating").forEach(btn => {
        btn.disabled = !hasFloat;
        btn.style.opacity = hasFloat ? "1" : "0.4";
        btn.style.cursor = hasFloat ? "pointer" : "not-allowed";
    });
    
    document.querySelectorAll("#btn-open-external").forEach(btn => {
        btn.disabled = !hasExt;
        btn.style.opacity = hasExt ? "1" : "0.4";
        btn.style.cursor = hasExt ? "pointer" : "not-allowed";
    });
    
    const hasOpen = document.querySelectorAll('[id^="float-panel-"]').length > 0 || (activeExternalWindows['master'] && !activeExternalWindows['master'].closed);
    document.querySelectorAll("#btn-close-all").forEach(btn => {
        btn.disabled = !hasOpen;
        btn.style.opacity = hasOpen ? "1" : "0.4";
        btn.style.cursor = hasOpen ? "pointer" : "not-allowed";
    });
}

app.registerExtension({
    name: "MyCustomNamespace.DualBreakout",
    
    // --- NEW: Intercept Graph Serialization to bake layout into JSON ---
    async setup() {
        const origSerialize = app.graph.onSerialize;
        app.graph.onSerialize = function(o) {
            if (origSerialize) origSerialize.call(this, o);
            o.extra = o.extra || {};
            o.extra.breakout_state = {
                zen_order: window._breakout_zen_order || [],
                ext_order: window._breakout_ext_order || [],
                zen_cols: localStorage.getItem('breakout_zen_cols') || 'auto',
                ext_cols: localStorage.getItem('breakout_ext_cols') || 'auto'
            };
        };

        const origConfigure = app.graph.onConfigure;
        app.graph.onConfigure = function(o) {
            if (origConfigure) origConfigure.call(this, o);
            if (o.extra && o.extra.breakout_state) {
                window._breakout_zen_order = o.extra.breakout_state.zen_order || [];
                window._breakout_ext_order = o.extra.breakout_state.ext_order || [];
                
                if (o.extra.breakout_state.zen_cols) {
                    localStorage.setItem('breakout_zen_cols', o.extra.breakout_state.zen_cols);
                    if (window.setZenCols) window.setZenCols(o.extra.breakout_state.zen_cols);
                }
                
                if (o.extra.breakout_state.ext_cols) {
                    localStorage.setItem('breakout_ext_cols', o.extra.breakout_state.ext_cols);
                    channel.postMessage({ action: "sync_ext_cols", cols: o.extra.breakout_state.ext_cols });
                }
                
                channel.postMessage({ action: "sync_ext_order", order: window._breakout_ext_order });
                
                if(isZenMode && zenOverlay) {
                    window._breakout_zen_order.forEach(id => {
                        const p = document.getElementById(`float-panel-${id}`);
                        if (p) zenOverlay.appendChild(p);
                    });
                    if(window.applyZenMasonry) setTimeout(window.applyZenMasonry, 50);
                }
            }
        };

        if (app.extensionManager?.registerSidebarTab) {
            app.extensionManager.registerSidebarTab({
                id: 'dual-breakout-tab', icon: 'pi pi-desktop', title: 'Displays', type: 'custom',
                render: (el) => {
                    el.style.padding = "20px";
                    el.innerHTML = `
                        <h3 style="color:white; margin-top:0;">Breakout Hub</h3>
                        
                        <button id="btn-zen-mode" style="margin-bottom:5px; padding:12px; width:100%; background:#2196F3; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">☯ Zen Mode</button>
                        
                        <div style="margin-bottom:15px; text-align:center;">
                            <label style="color:#aaa; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                                <input type="checkbox" id="zen-open-ext-chk" checked> Auto-open External Dashboard
                            </label>
                        </div>
                        
                        <div style="display:flex; gap:5px; margin-bottom:10px;">
                            <button id="btn-open-floating" style="flex:1; padding:8px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:11px;">▶ Open Floating</button>
                            <button id="btn-open-external" style="flex:1; padding:8px; background:#009688; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:11px;">▶ Open External</button>
                        </div>
                        
                        <button id="btn-close-all" style="margin-bottom:20px; padding:8px; width:100%; background:#f44336; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">✖ Close All Open Windows</button>
                        
                        <div style="margin-bottom:20px; padding:15px; background:#2a2a2a; border-radius:6px; border:1px solid #444;">
                            <p style="color:#ccc; font-size:13px; margin:0 0 10px 0;"><b>Detected Hubs:</b></p>
                            <div id="breakout-dynamic-list"></div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom:10px;">
                            <button id="btn-set-ids" style="padding:8px; background:#673AB7; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">Set Unique IDs</button>
                            <button id="btn-set-titles" style="padding:8px; background:#9C27B0; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">Set Unique Titles</button>
                        </div>
                        
                        <button id="btn-refresh-all" style="margin-bottom:20px; padding:8px; width:100%; background:#ff9800; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">↻ Force Refresh</button>
                        
                        <button id="btn-all-floating" style="margin-bottom:10px; padding:8px; width:100%; background:#607D8B; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Make all windows Floating</button>
                        <button id="btn-all-external" style="padding:8px; width:100%; background:#3F51B5; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Make all windows External</button>
                    `;
                    setTimeout(() => {
                        el.querySelector('#btn-open-floating').onclick = openAllFloating;
                        el.querySelector('#btn-open-external').onclick = openAllExternal;
                        el.querySelector('#btn-close-all').onclick = closeAllOpenWindows;
                        
                        el.querySelector('#btn-refresh-all').onclick = () => {
                            refreshAllBreakoutWindows();
                            renderDynamicSidebar();
                        };
                        
                        el.querySelector('#btn-all-floating').onclick = () => setAllWindowModes("Floating");
                        el.querySelector('#btn-all-external').onclick = () => setAllWindowModes("External");
                        el.querySelector('#btn-set-ids').onclick = forceUniqueIds;
                        el.querySelector('#btn-set-titles').onclick = forceUniqueTitles;
                        el.querySelector('#btn-zen-mode').onclick = toggleZenMode;
                        
                        document.querySelectorAll("#breakout-dynamic-list").forEach(c => c.dataset.lastHtml = "");
                        renderDynamicSidebar(); 
                    }, 100);
                }
            });
        }
    },
    nodeCreated(node) {
        if (VALID_PREVIEW_TYPES.includes(node.type)) {
            const modeW = node.widgets?.find(w => w.name === "window_mode");
            if (modeW) {
                const updateInput = () => {
                    const inp = node.inputs?.[0]; if (!inp) return;
                    const out = node.outputs?.[0]; 
                    if (modeW.value.startsWith("Control Panel")) { 
                        inp.name = "trigger (optional)"; inp.type = "*"; inp.color_off = "#00FF00"; inp.color_on = "#00FF00"; 
                        if (out) { out.name = "trigger (pass)"; out.type = "*"; out.color_off = "#00FF00"; out.color_on = "#00FF00"; }
                    } 
                    else { 
                        inp.name = "data (image/text)"; inp.type = "*"; delete inp.color_off; delete inp.color_on; 
                        if (out) { out.name = "data (pass)"; out.type = "*"; delete out.color_off; delete out.color_on; }
                    }
                    app.graph.setDirtyCanvas(true, false);
                };
                modeW.callback = updateInput; setTimeout(updateInput, 100);
            }
            node.addWidget("button", "🚀 Open Window", "open_btn", () => {
                const wId = node.widgets?.find(w=>w.name==="window_id")?.value;
                const wMode = node.widgets?.find(w=>w.name==="window_mode")?.value;
                if(wId && wMode) window.launchBreakoutWindow(wId, wMode);
            });
        }
        
        if (VALID_CONTROL_TYPES.includes(node.type)) {
            const wrapNameWidget = () => {
                if (!node.widgets) { setTimeout(wrapNameWidget, 100); return; }
                const valW = node.widgets.find(w => w.name === "value");
                if (!valW) { setTimeout(wrapNameWidget, 100); return; }
                
                ["value", "control_after_generate"].forEach(targetWidget => {
                    const w = node.widgets.find(x => x.name === targetWidget);
                    if (!w) return;
                    if (w._breakout_wrapped) return;
                    w._breakout_wrapped = true;
                    
                    const orig = w.callback;
                    w.callback = function(val) {
                        if(orig) orig.apply(this, arguments);
                        
                        const nameW = node.widgets.find(x => x.name === "control_name")?.value;
                        const winId = parseInt(node.widgets.find(x => x.name === "window_id")?.value || 0);
                        let syncIds = [node.id];
                        
                        if (app.graph && app.graph._nodes) {
                            app.graph._nodes.forEach(n => {
                                if (n.id !== node.id && VALID_CONTROL_TYPES.includes(n.type)) {
                                    const nName = n.widgets?.find(x=>x.name==="control_name")?.value;
                                    const nWinId = parseInt(n.widgets?.find(x=>x.name==="window_id")?.value || 0);
                                    if (nName === nameW && nWinId === winId) {
                                        const nv = n.widgets?.find(x=>x.name===targetWidget); 
                                        if(nv && nv.value !== val) { nv.value = val; syncIds.push(n.id); }
                                    }
                                }
                            });
                        }
                        
                        let t = "num";
                        if (node.type === "BreakoutStringControl") t = "string";
                        else if (node.type === "BreakoutBoolControl") t = "bool";
                        else if (node.type === "BreakoutSeedControl") t = (targetWidget === "control_after_generate") ? "seed_mode" : "seed";
                        
                        sendSync({ action: "sync_val", nodeIds: syncIds, val: val, type: t, targetId: winId, name: nameW });
                    };
                });
            };
            wrapNameWidget();
        }
    }
});
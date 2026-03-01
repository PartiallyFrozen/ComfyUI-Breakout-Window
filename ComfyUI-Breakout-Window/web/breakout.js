import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const channel = new BroadcastChannel("comfy_breakout_channel");
let customOrder = []; 
let activeExternalWindows = {}; 
let isZenMode = false;
const VALID_CONTROL_TYPES = ["BreakoutIntControl", "BreakoutFloatControl", "BreakoutStringControl", "BreakoutBoolControl", "BreakoutSeedControl"];
const VALID_PREVIEW_TYPES = ["BreakoutWindow"]; 

// --- Lazy DOM Initialization for Zen Overlay ---
let zenOverlay = null;

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
            grid-auto-rows: min-content; gap: 20px; overflow-y: auto; align-items: start;
        }
        .zen-active-panel {
            position: relative !important; top: auto !important; left: auto !important; right: auto !important;
            width: 100% !important; min-height: 250px; margin: 0 !important; transform: none !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; border: 1px solid #333 !important;
        }
        #zen-exit-header {
            position: fixed; top: 0; left: 0; width: 100vw; height: 50px;
            background: #151515; display: flex; align-items: center; justify-content: center; gap: 20px;
            border-bottom: 1px solid #333; z-index: 9991;
        }
        #btn-exit-zen-top {
            background: #2196F3; color: white; border: none; padding: 6px 24px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    zenOverlay = document.createElement('div');
    zenOverlay.id = "breakout-zen-overlay";
    zenOverlay.innerHTML = `
        <div id="zen-exit-header">
            <button id="btn-zen-run-all" style="background: #2196F3; color: white; border: none; padding: 6px 24px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">🌍 Run All</button>
            <button id="btn-exit-zen-top">✖ Exit Zen Mode</button>
            <label style="color: #ccc; font-size: 12px; display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" id="chk-close-on-exit"> Close all windows on exit
            </label>
        </div>
    `;
    document.body.appendChild(zenOverlay);
    document.getElementById("btn-exit-zen-top").onclick = () => { if (isZenMode) toggleZenMode(); };
    document.getElementById("btn-zen-run-all").onclick = () => sendSync({ action: "trigger_queue_all" });
}

// --- Core Helper Functions ---
function triggerQueuePrompt() {
    const queueBtn = document.getElementById("queue-button");
    if (queueBtn) queueBtn.click(); else app.queuePrompt(0, 1);
}

window.launchBreakoutWindow = (id, mode) => {
    if (mode === "External" || mode === "Control Panel (External)") openExternalBreakoutWindow(id);
    else createFloatingBreakout(id);
};

// --- UPDATED: Retrieve stored Text and Images natively from the node ---
function getExistingPreviewData(targetId) {
    if (!app.graph || !app.graph._nodes) return { imgUrl: null, textData: null };
    const node = app.graph._nodes.find(n => VALID_PREVIEW_TYPES.includes(n.type) && parseInt(n.widgets?.find(w => w.name === "window_id")?.value) === parseInt(targetId));
    if (node) {
        if (node._breakout_last_img || node._breakout_last_text) {
            return { imgUrl: node._breakout_last_img, textData: node._breakout_last_text };
        }
        if (node.imgs && node.imgs.length > 0) {
            return { imgUrl: node.imgs[0].src, textData: null };
        }
    }
    return { imgUrl: null, textData: null };
}

function updateFloatingPreview(id, imgUrl, textData) {
    const panel = document.getElementById(`float-panel-${id}`);
    if (!panel) return;
    const container = panel.querySelector('.preview-container');
    const imgWrapper = panel.querySelector('.img-wrapper');
    const textWrapper = panel.querySelector('.text-wrapper');
    const imgEl = panel.querySelector('.preview-img');
    const textEl = panel.querySelector('.preview-text');

    if (imgUrl) {
        imgEl.src = imgUrl;
        imgWrapper.style.display = "flex";
        textWrapper.style.display = "none";
        container.style.display = "flex";
    } else if (textData !== null && textData !== undefined) {
        textEl.innerText = textData;
        textWrapper.style.display = "flex";
        imgWrapper.style.display = "none";
        container.style.display = "flex";
    }
}

// --- Zen Mode Toggle Logic ---
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
        document.querySelectorAll('[id^="float-panel-"]').forEach(p => {
            p.classList.add("zen-active-panel");
            zenOverlay.appendChild(p);
        });
        if (btn) { btn.style.background = "#E91E63"; btn.innerHTML = "✖ Exit Zen Mode"; }
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

// --- ID & Title Management Logic ---
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
}

// --- Execution Trace (Isolated) ---
async function triggerWindowQueue(targetId) {
    if (!app.graph) return;
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

// --- Sync Dispatch ---
function processMessage(data) {
    if (data.action === "refresh_all_externals") return;
    if (data.action === "request_refresh") {
        const previewData = getExistingPreviewData(data.winId);
        channel.postMessage({ 
            action: "refresh_html", targetId: data.winId, 
            html: generateControlsHTML(getControlData(data.winId), data.winId), 
            hasPreviewNode: checkHasPreview(data.winId), 
            title: getWindowTitle(data.winId), 
            imgUrl: previewData.imgUrl,
            textData: previewData.textData
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
    }
}
function sendSync(data) { processMessage(data); channel.postMessage(data); }
channel.onmessage = (event) => processMessage(event.data);

// --- Control Data Scraper ---
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
}

function closeAllOpenWindows() {
    document.querySelectorAll('[id^="float-panel-"]').forEach(p => p.remove());
    if (activeExternalWindows['master'] && !activeExternalWindows['master'].closed) {
        activeExternalWindows['master'].close();
    }
    activeExternalWindows = {};
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
            }, 500);
        } else {
            win.focus();
            externalIds.forEach(id => processMessage({ action: "request_refresh", winId: id }));
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
                if (!isZenMode) p.style.height = "600px"; 
                
                const previewData = getExistingPreviewData(id);
                updateFloatingPreview(id, previewData.imgUrl, previewData.textData);
            } else { 
                wrapper.style.display = "none"; runBtn.style.display = "none"; p.style.height = "auto"; 
            }
        }
    });
    channel.postMessage({ action: "refresh_all_externals" });
}

// --- UPDATED: DOM Template handles both Image and Text Wrappers ---
function createFloatingBreakout(rawId, index = -1, total = 1) {
    const id = String(rawId).trim(); if (!id || id === "0") return;
    const pId = `float-panel-${id}`; if (document.getElementById(pId)) return;
    
    let topPos = "10vh", leftPos = "", rightPos = "5vw";
    if (index >= 0 && total > 1) {
        const panelWidth = 512, gap = 20, maxCols = Math.max(1, Math.floor((window.innerWidth - gap) / (panelWidth + gap))), cols = Math.min(total, maxCols), colI = index % cols, rowI = Math.floor(index / cols), rowW = (cols * panelWidth) + ((cols - 1) * gap);
        leftPos = `${Math.max(20, (window.innerWidth - rowW) / 2) + colI * (panelWidth + gap)}px`; topPos = `calc(10vh + ${rowI * 60}px)`; rightPos = "auto";
    }
    
    const win = document.createElement("div"); win.id = pId;
    Object.assign(win.style, { position: "fixed", top: topPos, width: "512px", minHeight: "100px", backgroundColor: "#1e1e1e", border: "1px solid #444", borderRadius: "8px", zIndex: "9999", display: "flex", flexDirection: "column", boxShadow: "0 10px 25px rgba(0,0,0,0.8)", overflow: "hidden", resize: "both", transition: "box-shadow 0.3s ease" });
    if (leftPos) win.style.left = leftPos; else win.style.right = rightPos;
    
    win.innerHTML = `
        <div class="drag-handle" style="padding:10px 15px; background:#2a2a2a; cursor:grab; display:flex; justify-content:space-between; align-items:center; color:white; font-family:sans-serif; border-bottom:1px solid #444;">
            <span class="panel-title-display" style="color:white; font-weight:bold; font-size:16px;">${getWindowTitle(id)}</span>
            <span class="close-btn" style="cursor:pointer; color:#ff5555; font-weight:bold; font-size:16px;">✖</span>
        </div>
        <div class="preview-container" style="display:none; flex:1; min-height:0; background:#000; overflow:hidden;">
            <div class="img-wrapper" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;"><img class="preview-img" style="max-width:100%; max-height:100%; object-fit:contain;"></div>
            <div class="text-wrapper" style="display:none; width:100%; height:100%; align-items:flex-start; justify-content:flex-start; padding:15px; box-sizing:border-box; overflow:auto; background:#111;"><pre class="preview-text" style="color:#fff; font-family:monospace; font-size:14px; white-space:pre-wrap; word-break:break-word; margin:0;"></pre></div>
        </div>
        <div style="padding:15px; background:#222; border-top:1px solid #444; color:white;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:8px; margin-bottom:10px;">
                <strong>Controls <span style="color:#aaa; font-size:12px; margin-left:5px;">(ID: ${id})</span></strong>
                <div>
                    <button class="q-run-win-btn" style="display:none; background:#4CAF50; color:white; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:5px;">🚀 Run Window</button>
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

    win.querySelector(".close-btn").onclick = () => win.remove();
    win.querySelector(".q-run-win-btn").onclick = () => sendSync({ action: "trigger_queue", winId: id });
    win.querySelector(".ref-btn").onclick = refreshAllBreakoutWindows;
    
    const h = win.querySelector(".drag-handle"); 
    h.onmousedown = (e) => { 
        if (isZenMode || ["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(e.target.tagName)) return; 
        let sX = e.clientX - win.offsetLeft, sY = e.clientY - win.offsetTop; 
        document.onmousemove = (ev) => { win.style.left = (ev.clientX - sX) + "px"; win.style.top = (ev.clientY - sY) + "px"; }; 
        document.onmouseup = () => { document.onmousemove = null; }; 
    };
    
    setTimeout(() => { 
        if (checkHasPreview(id)) { 
            win.querySelector(".preview-container").style.display = "flex"; 
            win.querySelector(".q-run-win-btn").style.display = "inline-block"; 
            if (!isZenMode) win.style.height = "600px"; 
            
            const previewData = getExistingPreviewData(id);
            updateFloatingPreview(id, previewData.imgUrl, previewData.textData);
        } 
        win.querySelector(".controls-list").innerHTML = generateControlsHTML(getControlData(id), id); 
        attachUIEvents(win, false, id); 
    }, 50);
}

function getUnifiedExternalHTML() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Breakout Dashboard (External)</title>
    <style>
        body { margin:0; background:#0b0b0b; color:white; font-family:sans-serif; padding: 20px; overflow-y:auto; }
        #grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 20px; align-items: start; }
        .ext-panel { background: #1e1e1e; border: 1px solid #444; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
        .ext-header { padding:10px 15px; background:#2a2a2a; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center; }
        .ext-controls { padding:15px; background:#222; overflow-y:auto; max-height:400px; }
    </style>
</head>
<body>
    <div style="margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #333; padding-bottom: 10px;">
        <h2>Breakout Dashboard</h2>
        <button onclick="bc.postMessage({action:'trigger_queue_all'})" style="background:#2196F3; color:white; border:none; border-radius:4px; padding:8px 16px; cursor:pointer; font-weight:bold;">🌍 Run All</button>
    </div>
    <div id="grid-container"></div>
    <script>
        const bc = new BroadcastChannel("comfy_breakout_channel");

        function attachUIEvents(winId) {
            const panel = document.getElementById('panel-' + winId);
            if (!panel) return;
            
            panel.querySelectorAll('.breakout-control').forEach(c => {
                if(c.tagName === 'TEXTAREA') { c.style.height = 'auto'; c.style.height = Math.min(c.scrollHeight, 200) + 'px'; }
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
            
            const winId = data.targetId || data.winId;
            if (!winId) return;

            if (data.action === "update_preview") { 
                const container = document.querySelector(\`#panel-\${winId} .ext-preview-container\`);
                const imgBox = document.querySelector(\`#panel-\${winId} .ext-img-box\`);
                const textBox = document.querySelector(\`#panel-\${winId} .ext-text-box\`);
                const img = document.querySelector(\`#panel-\${winId} .view-img\`);
                const txt = document.querySelector(\`#panel-\${winId} .view-text\`);
                
                if (container && imgBox && textBox && img && txt) {
                    if (data.imgUrl) {
                        img.src = window.opener.location.origin + data.imgUrl;
                        imgBox.style.display = "flex";
                        textBox.style.display = "none";
                        container.style.display = "flex";
                    } else if (data.textData !== null && data.textData !== undefined) {
                        txt.innerText = data.textData;
                        textBox.style.display = "flex";
                        imgBox.style.display = "none";
                        container.style.display = "flex";
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
                        <div class="ext-header">
                            <span class="ext-title-display" style="color:white; font-weight:bold; font-size:16px;"></span>
                            <span class="close-btn" style="cursor:pointer; color:#ff5555; font-weight:bold; font-size:16px;" onclick="this.closest('.ext-panel').remove()">✖</span>
                        </div>
                        <div class="ext-preview-container" style="display:none; background:#000; height: 400px; overflow:hidden;">
                            <div class="ext-img-box" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;"><img class="view-img" style="max-width:100%; max-height:100%; object-fit:contain;"></div>
                            <div class="ext-text-box" style="display:none; width:100%; height:100%; align-items:flex-start; justify-content:flex-start; padding:15px; box-sizing:border-box; overflow:auto; background:#111;"><pre class="view-text" style="color:#white; font-family:monospace; font-size:14px; white-space:pre-wrap; word-break:break-word; margin:0;"></pre></div>
                        </div>
                        <div class="ext-controls">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:8px; margin-bottom:10px;">
                                <strong>Controls <span class="ext-id-display" style="color:#aaa; font-size:12px; margin-left:5px;"></span></strong>
                                <div>
                                    <button class="q-run-win-btn" onclick="bc.postMessage({action:'trigger_queue', winId:\${winId}})" style="display:none; background:#4CAF50; color:white; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:5px;">🚀 Run Window</button>
                                    <button onclick="bc.postMessage({action:'request_refresh', winId:\${winId}})" style="background:#444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">↻ Refresh</button>
                                </div>
                            </div>
                            <div class="list-container"></div>
                        </div>
                    \`;
                    document.getElementById("grid-container").appendChild(panel);
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
                    
                    if (data.imgUrl) {
                        img.src = data.imgUrl;
                        if(data.imgUrl.startsWith('/')) img.src = window.opener.location.origin + data.imgUrl;
                        imgBox.style.display = "flex";
                        textBox.style.display = "none";
                        container.style.display = "flex";
                    } else if (data.textData !== null && data.textData !== undefined) {
                        txt.innerText = data.textData;
                        textBox.style.display = "flex";
                        imgBox.style.display = "none";
                        container.style.display = "flex";
                    } else {
                        container.style.display = "flex";
                        imgBox.style.display = "none";
                        textBox.style.display = "none";
                    }
                }
                
                attachUIEvents(winId);
            }
            
            if (data.action === "sync_val") { 
                document.querySelectorAll(\`#panel-\${winId} .breakout-control\`).forEach(c => { 
                    if (c.dataset.name === data.name && c.dataset.nodetype === data.type && document.activeElement !== c) { 
                        if (data.type === "bool") c.checked = data.val; 
                        else { 
                            c.value = data.val; 
                            if(c.tagName === 'TEXTAREA') { c.style.height = 'auto'; c.style.height = Math.min(c.scrollHeight, 200) + 'px'; } 
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

// --- UPDATED: Image & Text Preview Output Listener ---
api.addEventListener("executed", (e) => {
    if (!app.graph || !app.graph.getNodeById) return;
    const node = app.graph.getNodeById(e.detail.node);
    if (!node) return;

    if (VALID_PREVIEW_TYPES.includes(node.type)) {
        const id = node.widgets?.find(w => w.name === "window_id")?.value || 1;
        const out = e.detail.output;
        let imgUrl = null;
        let textData = null;

        if (out && out.images && out.images.length > 0) {
            imgUrl = `/view?filename=${out.images[0].filename}&type=${out.images[0].type}&subfolder=${out.images[0].subfolder}&t=${Date.now()}`;
            node._breakout_last_img = imgUrl;
            node._breakout_last_text = null;
        } else if (out && out.text && out.text.length > 0) {
            textData = out.text[0];
            node._breakout_last_text = textData;
            node._breakout_last_img = null;
        }

        updateFloatingPreview(id, imgUrl, textData);
        channel.postMessage({ action: "update_preview", targetId: id, imgUrl, textData });
    }
});

api.addEventListener("executing", (e) => {
    if (!e.detail) {
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

let lastSidebarHTML = "";
function renderDynamicSidebar() {
    const container = document.getElementById("breakout-dynamic-list"); if (!container || !app.graph) return;
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

        html += `<div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid #444;"><div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; margin-right:10px;"><strong style="color:white; font-size:14px;">${icon} ${title}</strong><br><span style="color:#aaa; font-size:11px;">ID: ${id} | ${mode}</span></div><button onclick="window.launchBreakoutWindow(${id}, '${mode}')" style="background:#2196F3; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; font-size:12px;">Launch</button></div>`;
    });
    if (html !== lastSidebarHTML) { container.innerHTML = html; lastSidebarHTML = html; }

    const btnF = document.getElementById("btn-open-floating");
    const btnE = document.getElementById("btn-open-external");
    if (btnF) {
        btnF.disabled = !hasFloat;
        btnF.style.opacity = hasFloat ? "1" : "0.4";
        btnF.style.cursor = hasFloat ? "pointer" : "not-allowed";
    }
    if (btnE) {
        btnE.disabled = !hasExt;
        btnE.style.opacity = hasExt ? "1" : "0.4";
        btnE.style.cursor = hasExt ? "pointer" : "not-allowed";
    }
    
    const btnClose = document.getElementById("btn-close-all");
    if (btnClose) {
        const hasOpen = document.querySelectorAll('[id^="float-panel-"]').length > 0 || (activeExternalWindows['master'] && !activeExternalWindows['master'].closed);
        btnClose.disabled = !hasOpen;
        btnClose.style.opacity = hasOpen ? "1" : "0.4";
        btnClose.style.cursor = hasOpen ? "pointer" : "not-allowed";
    }
}

app.registerExtension({
    name: "MyCustomNamespace.DualBreakout",
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
                        // UPDATED: Clarify that the Hub now accepts data/text
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
    },
    async setup() {
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
                        document.getElementById('btn-open-floating').onclick = openAllFloating;
                        document.getElementById('btn-open-external').onclick = openAllExternal;
                        document.getElementById('btn-close-all').onclick = closeAllOpenWindows;
                        document.getElementById('btn-refresh-all').onclick = () => {
                            refreshAllBreakoutWindows();
                            lastSidebarHTML = "";
                            renderDynamicSidebar();
                        };
                        document.getElementById('btn-all-floating').onclick = () => setAllWindowModes("Floating");
                        document.getElementById('btn-all-external').onclick = () => setAllWindowModes("External");
                        document.getElementById('btn-set-ids').onclick = forceUniqueIds;
                        document.getElementById('btn-set-titles').onclick = forceUniqueTitles;
                        document.getElementById('btn-zen-mode').onclick = toggleZenMode;
						// --- ADD THIS NEW BLOCK ---
                        // Force a refresh when the "Displays" sidebar button is clicked
                        document.body.addEventListener("click", (e) => {
                            const tabBtn = e.target.closest(".sidebar-item, .side-bar-button, [title='Displays']");
                            if (tabBtn && (tabBtn.title === "Displays" || tabBtn.innerText.includes("Displays"))) {
                                lastSidebarHTML = "";
                                renderDynamicSidebar();
                            }
                        });
                        // --------------------------
                        setInterval(renderDynamicSidebar, 1500);
                        renderDynamicSidebar();
                    }, 100);
                }
            });
        }
    }
});

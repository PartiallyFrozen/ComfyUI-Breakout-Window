import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const channel = new BroadcastChannel("comfy_breakout_channel");

let customOrder = []; 

function triggerQueuePrompt() {
    const queueBtn = document.getElementById("queue-button");
    if (queueBtn) queueBtn.click();
    else app.queuePrompt(0, 1);
}

// --- 1. Dynamic Node Scanning & Custom Sorting ---
function getControlData() {
    if (!app.graph) return [];
    
    const validTypes = ["BreakoutIntControl", "BreakoutFloatControl", "BreakoutStringControl"];
    const foundNodes = app.graph._nodes.filter(n => validTypes.includes(n.type));

    let data = foundNodes.map(n => {
        const widgets = n.widgets || []; 
        const nameWidget = widgets.find(w => w.name === "control_name");
        const valWidget = widgets.find(w => w.name === "value");
        
        let defaultVal = 0;
        if (n.type === "BreakoutStringControl") defaultVal = "";
        if (n.type === "BreakoutFloatControl") defaultVal = 1.0;

        return {
            id: n.id,
            type: n.type,
            name: nameWidget ? nameWidget.value : `Node ${n.id}`,
            value: valWidget ? valWidget.value : defaultVal
        };
    });

    data.sort((a, b) => {
        let indexA = customOrder.indexOf(a.id);
        let indexB = customOrder.indexOf(b.id);
        if (indexA === -1) indexA = 999999;
        if (indexB === -1) indexB = 999999;
        return indexA - indexB;
    });

    customOrder = data.map(item => item.id);

    return data;
}

function updateSpecificNodeOnCanvas(nodeId, newValue) {
    if (!app.graph) return;
    const node = app.graph.getNodeById(nodeId);
    if (node && node.widgets) {
        const widget = node.widgets.find(w => w.name === "value");
        if (widget) {
            widget.value = newValue;
            app.graph.setDirtyCanvas(true, false);
        }
    }
}

function generateControlsHTML(data) {
    if (data.length === 0) return "<p style='color:#888; font-size:12px; padding: 10px;'>No Breakout Controls found. Add them to canvas and click Refresh.</p>";
    
    let html = `<div id="sortable-list" style="display:flex; flex-direction:column; gap:8px; width:100%;">`;
    data.forEach(item => {
        html += `<div class="control-row" data-nodeid="${item.id}" style="display:flex; align-items:center; gap:10px; background: #2c2c2c; padding: 8px 12px; border-radius: 6px; border: 1px solid #3c3c3c; transition: opacity 0.2s;">`;
        
        // NEW: Up and Down Arrow Buttons
        html += `
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center;">
                <button class="btn-move-up" style="background: none; border: none; color: #888; cursor: pointer; font-size: 14px; padding: 0; line-height: 1;" title="Move Up">▲</button>
                <button class="btn-move-down" style="background: none; border: none; color: #888; cursor: pointer; font-size: 14px; padding: 0; line-height: 1;" title="Move Down">▼</button>
            </div>
        `;
        
        html += `<label style="font-size: 13px; font-weight: bold; width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</label>`;
        
        if (item.type === "BreakoutIntControl") {
            html += `<input type="number" class="breakout-control" data-nodeid="${item.id}" data-nodetype="int" value="${item.value}" style="flex-grow: 1; padding: 6px; background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 14px; text-align: center;">`;
        } 
        else if (item.type === "BreakoutFloatControl") {
            html += `<input type="number" class="breakout-control" data-nodeid="${item.id}" data-nodetype="float" step="0.01" value="${Number(item.value).toFixed(2)}" style="flex-grow: 1; padding: 6px; background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 4px; font-family: monospace; font-size: 14px; text-align: center;">`;
        } 
        else if (item.type === "BreakoutStringControl") {
            html += `<textarea class="breakout-control" data-nodeid="${item.id}" data-nodetype="string" rows="2" style="flex-grow: 1; padding: 6px; background: #1a1a1a; color: white; border: 1px solid #444; border-radius: 4px; font-family: sans-serif; resize: vertical;">${item.value}</textarea>`;
        }
        
        html += `</div>`;
    });
    html += `</div>`;
    return html;
}

function attachUIEvents(container, isExternal = false) {
    if (!container) return;
    
    const controls = container.querySelectorAll('.breakout-control');
    controls.forEach(ctrl => {
        ctrl.oninput = (e) => {
            const type = e.target.dataset.nodetype;
            const nodeId = parseInt(e.target.dataset.nodeid);
            let val = e.target.value;
            
            if (val === "" && type !== "string") return;

            if (type === "int") val = parseInt(val, 10) || 0;
            if (type === "float") val = parseFloat(val) || 0.0;
            
            if (isExternal) {
                channel.postMessage({ action: "update_specific_control", node_id: nodeId, value: val, type: type });
            } else {
                updateSpecificNodeOnCanvas(nodeId, val);
                channel.postMessage({ action: "sync_ext_controls", node_id: nodeId, value: val, type: type });
            }
        }
    });

    const list = container.querySelector('#sortable-list');
    if (!list) return;

    // NEW: Arrow Button Click Logic
    list.querySelectorAll('.btn-move-up').forEach(btn => {
        btn.onclick = (e) => {
            const row = e.target.closest('.control-row');
            if (row && row.previousElementSibling) {
                row.parentNode.insertBefore(row, row.previousElementSibling);
                const rows = Array.from(list.querySelectorAll('.control-row'));
                const newOrder = rows.map(r => parseInt(r.dataset.nodeid));
                
                if (isExternal) channel.postMessage({ action: "save_new_order", order: newOrder });
                else { customOrder = newOrder; refreshAllControls(); }
            }
        };
    });

    list.querySelectorAll('.btn-move-down').forEach(btn => {
        btn.onclick = (e) => {
            const row = e.target.closest('.control-row');
            if (row && row.nextElementSibling) {
                row.parentNode.insertBefore(row.nextElementSibling, row);
                const rows = Array.from(list.querySelectorAll('.control-row'));
                const newOrder = rows.map(r => parseInt(r.dataset.nodeid));
                
                if (isExternal) channel.postMessage({ action: "save_new_order", order: newOrder });
                else { customOrder = newOrder; refreshAllControls(); }
            }
        };
    });
}

function refreshAllControls() {
    const data = getControlData();
    const html = generateControlsHTML(data);
    
    const floatContainer = document.getElementById("float-controls-container");
    if (floatContainer) {
        floatContainer.innerHTML = html;
        attachUIEvents(document.getElementById("my-floating-breakout"), false);
    }
    
    channel.postMessage({ action: "refresh_external_html", data: data });
}

// --- 2. Listeners for Cross-Window Communication ---
channel.onmessage = (event) => {
    if (event.data.action === "save_new_order") {
        customOrder = event.data.order;
        refreshAllControls();
    }
    
    if (event.data.action === "update_specific_control") {
        updateSpecificNodeOnCanvas(event.data.node_id, event.data.value);
        const floatCtrl = document.querySelector(`#my-floating-breakout .breakout-control[data-nodeid="${event.data.node_id}"]`);
        
        if (floatCtrl && document.activeElement !== floatCtrl) {
            floatCtrl.value = (event.data.type === "float") ? Number(event.data.value).toFixed(2) : event.data.value;
        }
    }
    
    if (event.data.action === "refresh_external_html") {
        const extContainer = document.getElementById("ext-controls-container");
        if (extContainer) {
            extContainer.innerHTML = generateControlsHTML(event.data.data);
            attachUIEvents(document, true);
        }
    }
    
    if (event.data.action === "sync_ext_controls") {
        const floatCtrl = document.querySelector(`#my-floating-breakout .breakout-control[data-nodeid="${event.data.node_id}"]`);
        if (floatCtrl && document.activeElement !== floatCtrl) {
            floatCtrl.value = (event.data.type === "float") ? Number(event.data.value).toFixed(2) : event.data.value;
        }
    }
    
    if (event.data.action === "update_external_image") {
        document.getElementById("waiting-msg").style.display = "none";
        const img = document.getElementById("external-img");
        if (img) {
            img.src = window.opener.location.origin + event.data.url;
            img.style.display = "block";
        }
    }
    
    if (event.data.action === "trigger_queue") {
        triggerQueuePrompt();
    }
};

// --- 3. Floating Window Logic ---
function createFloatingBreakout() {
    if (document.getElementById("my-floating-breakout")) return;

    const win = document.createElement("div");
    win.id = "my-floating-breakout";
    Object.assign(win.style, {
        position: "fixed", top: "10vh", right: "5vw", width: "512px", height: "600px",
        minWidth: "350px", minHeight: "350px", 
        backgroundColor: "#1e1e1e", border: "1px solid #444", borderRadius: "8px",
        zIndex: "99999", display: "flex", flexDirection: "column",
        boxShadow: "0 10px 25px rgba(0,0,0,0.8)", overflow: "hidden", resize: "both" 
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
        padding: "10px 15px", backgroundColor: "#2a2a2a", cursor: "grab", display: "flex",
        justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #444",
        userSelect: "none", color: "white", fontFamily: "sans-serif", flex: "0 0 auto"
    });
    header.innerHTML = "<strong>Floating Breakout</strong>";

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    Object.assign(closeBtn.style, { background: "none", border: "none", color: "#ff5555", cursor: "pointer", fontWeight: "bold" });
    closeBtn.onclick = () => win.remove();
    header.appendChild(closeBtn);

    const content = document.createElement("div");
    content.id = "floating-image-container";
    Object.assign(content.style, {
        flex: "1 1 auto", minHeight: "0", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#000", position: "relative"
    });
    content.innerHTML = `<span style="color: #666; font-family: sans-serif;">Waiting for Image...</span>`;

    const controlPanel = document.createElement("div");
    Object.assign(controlPanel.style, {
        padding: "15px", backgroundColor: "#222", borderTop: "1px solid #444", color: "white", 
        fontFamily: "sans-serif", display: "flex", flexDirection: "column", gap: "10px",
        flex: "0 0 auto", maxHeight: "50%", overflowY: "auto" 
    });
    
    controlPanel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #444; padding-bottom: 8px;">
            <strong style="color:#aaa;">Order via Arrows</strong>
            <div>
                <button id="float-queue-btn" style="background:#4CAF50; color:white; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚀 Queue</button>
                <button id="float-refresh-btn" style="background:#444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">↻ Refresh</button>
            </div>
        </div>
        <div id="float-controls-container" style="margin-top: 5px;"></div>
    `;

    win.appendChild(header);
    win.appendChild(content);
    win.appendChild(controlPanel);
    document.body.appendChild(win);

    document.getElementById("float-refresh-btn").onclick = refreshAllControls;
    document.getElementById("float-queue-btn").onclick = triggerQueuePrompt;
    refreshAllControls();

    let isDragging = false, startX, startY, initialX, initialY;
    header.addEventListener("mousedown", (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
        isDragging = true; startX = e.clientX; startY = e.clientY;
        initialX = win.offsetLeft; initialY = win.offsetTop; header.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        win.style.left = `${initialX + (e.clientX - startX)}px`;
        win.style.top = `${initialY + (e.clientY - startY)}px`;
    });
    document.addEventListener("mouseup", () => { isDragging = false; header.style.cursor = "grab"; });
}

// --- 4. External OS Window Logic ---
function openExternalBreakoutWindow() {
    const breakoutWin = window.open("", "ComfyExternalBreakout", "width=600,height=700,menubar=no,toolbar=no");
    const initialData = getControlData();
    const initialHtml = generateControlsHTML(initialData);
    
    breakoutWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>External ComfyUI Preview</title>
            <style>
                body { margin: 0; background-color: #000; display: flex; flex-direction: column; height: 100vh; overflow: hidden; color: white; font-family: sans-serif; }
                #img-wrapper { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; position: relative; }
                #controls { flex: 0 0 auto; max-height: 50%; overflow-y: auto; padding: 15px; background: #222; border-top: 1px solid #444; display: flex; flex-direction: column; gap: 10px; }
            </style>
        </head>
        <body>
            <div id="img-wrapper">
                <div id="waiting-msg" style="color: #666; font-size: 16px;">Waiting for Image...</div>
                <img id="external-img" src="" style="display: none; width: 100%; height: 100%; object-fit: contain;">
            </div>
            
            <div id="controls">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #444; padding-bottom: 8px;">
                    <strong style="color:#aaa;">Order via Arrows</strong>
                    <div>
                        <button id="ext-queue-btn" style="background:#4CAF50; color:white; border:none; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:bold; margin-right:5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚀 Queue</button>
                        <button id="ext-refresh-btn" style="background:#444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">↻ Refresh UI</button>
                    </div>
                </div>
                <div id="ext-controls-container" style="margin-top: 5px;">
                    ${initialHtml}
                </div>
            </div>

            <script>
                const bc = new BroadcastChannel("comfy_breakout_channel");
                
                function attachUIEvents() {
                    const container = document;
                    // 1. Attach Controls
                    container.querySelectorAll('.breakout-control').forEach(ctrl => {
                        ctrl.oninput = (e) => {
                            const type = e.target.dataset.nodetype;
                            const nodeId = parseInt(e.target.dataset.nodeid);
                            let val = e.target.value;
                            
                            if (val === "" && type !== "string") return;

                            if (type === "int") val = parseInt(val, 10) || 0;
                            if (type === "float") val = parseFloat(val) || 0.0;

                            bc.postMessage({ action: "update_specific_control", node_id: nodeId, value: val, type: type });
                        };
                    });

                    // 2. Attach Arrow Up/Down Clicks
                    const list = container.querySelector('#sortable-list');
                    if (!list) return;

                    list.querySelectorAll('.btn-move-up').forEach(btn => {
                        btn.onclick = (e) => {
                            const row = e.target.closest('.control-row');
                            if (row && row.previousElementSibling) {
                                row.parentNode.insertBefore(row, row.previousElementSibling);
                                const rows = Array.from(list.querySelectorAll('.control-row'));
                                const newOrder = rows.map(r => parseInt(r.dataset.nodeid));
                                bc.postMessage({ action: "save_new_order", order: newOrder });
                            }
                        };
                    });

                    list.querySelectorAll('.btn-move-down').forEach(btn => {
                        btn.onclick = (e) => {
                            const row = e.target.closest('.control-row');
                            if (row && row.nextElementSibling) {
                                row.parentNode.insertBefore(row.nextElementSibling, row);
                                const rows = Array.from(list.querySelectorAll('.control-row'));
                                const newOrder = rows.map(r => parseInt(r.dataset.nodeid));
                                bc.postMessage({ action: "save_new_order", order: newOrder });
                            }
                        };
                    });
                }
                
                attachUIEvents();

                document.getElementById("ext-refresh-btn").onclick = () => bc.postMessage({ action: "request_refresh" });
                document.getElementById("ext-queue-btn").onclick = () => bc.postMessage({ action: "trigger_queue" });

                bc.onmessage = (event) => {
                    if (event.data.action === "update_external_image") {
                        document.getElementById("waiting-msg").style.display = "none";
                        const img = document.getElementById("external-img");
                        img.src = window.opener.location.origin + event.data.url;
                        img.style.display = "block";
                    }
                    if (event.data.action === "refresh_external_html") {
                        document.getElementById("ext-controls-container").innerHTML = event.data.html;
                        attachUIEvents();
                    }
                    if (event.data.action === "sync_ext_controls" || event.data.action === "update_specific_control") {
                        const extCtrl = document.querySelector(\`.breakout-control[data-nodeid="\${event.data.node_id}"]\`);
                        // Ensure we don't overwrite the box if the user is currently typing in it
                        if (extCtrl && document.activeElement !== extCtrl) {
                            extCtrl.value = (event.data.type === "float") ? Number(event.data.value).toFixed(2) : event.data.value;
                        }
                    }
                };
            </script>
        </body>
        </html>
    `);
    breakoutWin.document.close();
}

channel.addEventListener("message", (event) => {
    if (event.data.action === "request_refresh") {
        const data = getControlData();
        channel.postMessage({ action: "refresh_external_html", html: generateControlsHTML(data) });
    }
});

// --- 5. The Node Execution Listener ---
api.addEventListener("executed", (event) => {
    const node = app.graph.getNodeById(event.detail.node);
    if (node && (node.type === "FloatingWindowPreview" || node.type === "ExternalWindowPreview")) {
        const output = event.detail.output;
        if (output && output.images && output.images.length > 0) {
            const imgData = output.images[0];
            const imgUrl = `/view?filename=${encodeURIComponent(imgData.filename)}&type=${imgData.type}&subfolder=${encodeURIComponent(imgData.subfolder)}&t=${Date.now()}`;
            
            if (node.type === "FloatingWindowPreview") {
                if (!document.getElementById("my-floating-breakout")) createFloatingBreakout();
                const container = document.getElementById("floating-image-container");
                if (container) container.innerHTML = `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
            } 
            else if (node.type === "ExternalWindowPreview") {
                channel.postMessage({ action: "update_external_image", url: imgUrl });
            }
        }
    }
});

// --- 6. Sidebar & Menu UI Registration ---
app.registerExtension({
    name: "MyCustomNamespace.DualBreakout",
    commands: [
        { id: 'open-floating-breakout', label: 'Open Floating Panel', function: createFloatingBreakout },
        { id: 'open-external-breakout', label: 'Open External Screen', function: openExternalBreakoutWindow }
    ],
    menuCommands: [
        { path: ['Displays'], commands: ['open-floating-breakout', 'open-external-breakout'] }
    ],
    async setup() {
        if (app.extensionManager && app.extensionManager.registerSidebarTab) {
            const isDesktopApp = navigator.userAgent.toLowerCase().includes('electron') || window.electronAPI;
            app.extensionManager.registerSidebarTab({
                id: 'dual-breakout-tab', icon: 'pi pi-desktop', title: 'Displays', tooltip: 'Open Breakout Windows', type: 'custom',
                render: (el) => {
                    el.style.padding = "20px";
                    el.innerHTML = `
                        <h3 style="color: white; margin-top: 0;">Breakout Controls</h3>
                        <div style="margin-bottom: 20px; padding: 10px; background: #2a2a2a; border-radius: 6px;">
                            <p style="color: #ccc; font-size: 13px; margin: 0 0 10px 0;"><b>1. Floating Panel</b></p>
                            <button id="btn-floating" style="padding: 8px; width: 100%; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Open</button>
                        </div>
                        <div style="padding: 10px; background: #2a2a2a; border-radius: 6px;">
                            <p style="color: #ccc; font-size: 13px; margin: 0 0 10px 0;"><b>2. External Screen</b></p>
                            ${isDesktopApp 
                                ? `<button disabled style="padding: 8px; width: 100%; background: #555; color: #999; border: none; border-radius: 4px; cursor: not-allowed;">Browser Required</button>`
                                : `<button id="btn-external" style="padding: 8px; width: 100%; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Open</button>`
                            }
                        </div>
                    `;
                    setTimeout(() => {
                        const floatBtn = document.getElementById('btn-floating');
                        if (floatBtn) floatBtn.onclick = createFloatingBreakout;
                        const extBtn = document.getElementById('btn-external');
                        if (extBtn) extBtn.onclick = openExternalBreakoutWindow;
                    }, 100);
                }
            });
        }
    }
});
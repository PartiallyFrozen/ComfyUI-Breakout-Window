import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// --- Communication Channel for the External Window ---
const channel = new BroadcastChannel("comfy_breakout_channel");

// --- 1. Floating Window Logic ---
function createFloatingBreakout() {
    if (document.getElementById("my-floating-breakout")) return;

    const win = document.createElement("div");
    win.id = "my-floating-breakout";
    
    Object.assign(win.style, {
        position: "fixed", top: "10vh", right: "5vw", width: "512px", height: "512px",
        backgroundColor: "#1e1e1e", border: "1px solid #444", borderRadius: "8px",
        zIndex: "99999", display: "flex", flexDirection: "column",
        boxShadow: "0 10px 25px rgba(0,0,0,0.8)", overflow: "hidden"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
        padding: "10px 15px", backgroundColor: "#2a2a2a", cursor: "grab", display: "flex",
        justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #444",
        userSelect: "none", color: "white", fontFamily: "sans-serif"
    });
    header.innerHTML = "<strong>Floating Preview</strong>";

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    Object.assign(closeBtn.style, {
        background: "none", border: "none", color: "#ff5555", cursor: "pointer", fontSize: "14px", fontWeight: "bold"
    });
    closeBtn.onclick = () => win.remove();
    header.appendChild(closeBtn);

    const content = document.createElement("div");
    content.id = "floating-image-container";
    Object.assign(content.style, {
        flexGrow: "1", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "#000", position: "relative"
    });
    content.innerHTML = `<span style="color: #666; font-family: sans-serif;">Waiting for Floating node...</span>`;

    win.appendChild(header);
    win.appendChild(content);
    document.body.appendChild(win);

    // Drag Logic
    let isDragging = false, startX, startY, initialX, initialY;
    header.addEventListener("mousedown", (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        initialX = win.offsetLeft; initialY = win.offsetTop; header.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        win.style.left = `${initialX + (e.clientX - startX)}px`;
        win.style.top = `${initialY + (e.clientY - startY)}px`;
    });
    document.addEventListener("mouseup", () => {
        isDragging = false; header.style.cursor = "grab";
    });
}

// --- 2. External OS Window Logic ---
function openExternalBreakoutWindow() {
    const breakoutWin = window.open("", "ComfyExternalBreakout", "width=600,height=600,menubar=no,toolbar=no");
    
    // We write HTML directly into the new window that listens to our channel
    breakoutWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>External ComfyUI Preview</title>
        </head>
        <body style="margin: 0; background-color: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden;">
            <div id="waiting-msg" style="color: #666; font-family: sans-serif; font-size: 16px;">
                Waiting for External node...
            </div>
            <img id="external-img" src="" style="display: none; width: 100%; height: 100%; object-fit: contain;">

            <script>
                // Listen to the main window
                const bc = new BroadcastChannel("comfy_breakout_channel");
                bc.onmessage = (event) => {
                    if (event.data.action === "update_external_image") {
                        document.getElementById("waiting-msg").style.display = "none";
                        const img = document.getElementById("external-img");
                        // We must prepend the main window's URL origin so the external window knows where to download the image from
                        img.src = window.opener.location.origin + event.data.url;
                        img.style.display = "block";
                    }
                };
            </script>
        </body>
        </html>
    `);
    breakoutWin.document.close();
}

// --- 3. The Node Execution Listener ---
api.addEventListener("executed", (event) => {
    const node = app.graph.getNodeById(event.detail.node);
    
    // Check if the node that finished is one of our two custom nodes
    if (node && (node.type === "FloatingWindowPreview" || node.type === "ExternalWindowPreview")) {
        const output = event.detail.output;
        
        if (output && output.images && output.images.length > 0) {
            const imgData = output.images[0];
            const imgUrl = `/view?filename=${encodeURIComponent(imgData.filename)}&type=${imgData.type}&subfolder=${encodeURIComponent(imgData.subfolder)}&t=${Date.now()}`;
            
            if (node.type === "FloatingWindowPreview") {
                // Route to the In-App Floating Panel
                if (!document.getElementById("my-floating-breakout")) createFloatingBreakout();
                const container = document.getElementById("floating-image-container");
                if (container) {
                    container.innerHTML = `<img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
                }
            } 
            else if (node.type === "ExternalWindowPreview") {
                // Route to the Detached Browser Window
                channel.postMessage({ action: "update_external_image", url: imgUrl });
            }
        }
    }
});

// --- 4. Sidebar UI Registration ---
app.registerExtension({
    name: "MyCustomNamespace.DualBreakout",
    async setup() {
        if (app.extensionManager && app.extensionManager.registerSidebarTab) {
            
            // Detect if the user is running the Electron Desktop App
            const isDesktopApp = navigator.userAgent.toLowerCase().includes('electron') || window.electronAPI;

            app.extensionManager.registerSidebarTab({
                id: 'dual-breakout-tab',
                icon: 'pi pi-desktop', 
                // SHORTENED TITLE: Fits the sidebar perfectly
                title: 'Displays', 
                tooltip: 'Open Breakout Windows',
                type: 'custom',
                render: (el) => {
                    el.style.padding = "20px";
                    
                    // Build the buttons, applying a disabled state if they are in the Desktop App
                    el.innerHTML = `
                        <h3 style="color: white; margin-top: 0;">Breakout Controls</h3>
                        
                        <div style="margin-bottom: 20px; padding: 10px; background: #2a2a2a; border-radius: 6px;">
                            <p style="color: #ccc; font-size: 13px; margin: 0 0 10px 0;">
                                <b>1. Floating Panel</b><br>Draggable window inside the UI.
                            </p>
                            <button id="btn-floating" style="padding: 8px; width: 100%; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Open Floating Panel
                            </button>
                        </div>

                        <div style="padding: 10px; background: #2a2a2a; border-radius: 6px;">
                            <p style="color: #ccc; font-size: 13px; margin: 0 0 10px 0;">
                                <b>2. External Screen</b><br>Detached multi-monitor window.
                            </p>
                            ${isDesktopApp 
                                ? `<button disabled style="padding: 8px; width: 100%; background: #555; color: #999; border: none; border-radius: 4px; cursor: not-allowed;">
                                    Browser Required
                                   </button>
                                   <p style="color: #ff5555; font-size: 11px; margin: 5px 0 0 0; text-align: center;">Open ComfyUI in Chrome to use</p>`
                                : `<button id="btn-external" style="padding: 8px; width: 100%; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    Open External Monitor
                                   </button>`
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
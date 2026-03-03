# 🚀 ComfyUI Breakout Windows: The "Control Deck"

Welcome to **ComfyUI Breakout Windows**! This extension transforms from a simple floating window tool into a full-fledged, memory-safe, bidirectional "Control Deck" for your workflows. 

Whether you use a single monitor or a multi-monitor setup, Breakout Windows introduces powerful new ways to interact with, organize, and execute your ComfyUI graphs without ever touching the noodle spaghetti.

**Please NOTE!** External Windows only work when using ComfyUI from inside a browser window. It will not work for use in the Windows Standalone App. Floating windows and Zen Mode with floating windows still work fine for use in the Windows standalone. Feel free to use the buttons "Make all Floating" to help with this if needed!

---

**Multi-Window (External only):**
<img width="1268" height="678" alt="image" src="https://github.com/user-attachments/assets/a02c982b-68a3-430a-ac39-e5c91837bc26" />

**Multi-Window (Floating Only):**
<img width="1259" height="607" alt="image" src="https://github.com/user-attachments/assets/dd623a4b-0a60-4435-bf00-a7196c151ae3" />

**Multi-Window (Mixed):**
<img width="1260" height="522" alt="image" src="https://github.com/user-attachments/assets/18e65307-5611-4938-b71e-69212b61dbae" />

**Zen Mode (Floating only):**
<img width="1270" height="684" alt="image" src="https://github.com/user-attachments/assets/13a8a68b-2c7b-434a-94d5-439a4235c427" />

**Zen Mode (External only):**
<img width="1064" height="570" alt="image" src="https://github.com/user-attachments/assets/875889ca-cb75-4d09-8cbd-880f107c9f59" />

**Zen Mode (Mixed):**
<img width="1206" height="569" alt="image" src="https://github.com/user-attachments/assets/226975f3-67a7-48d2-9f04-a844ab46ba06" />

---

## ✨ Key Features (The Power User Update)

### 🧱 "Tetris" Masonry Grid & Column Controls
The dashboard uses a Masonry layout to densely pack your UI. Short text controls will automatically slide up to fill gaps next to tall image previews, eliminating dead space!
* **Column Controller:** Force the layout into 1, 2, 3, 4, 5, or "Auto" columns on the fly using the header buttons.
* **Snap-to-Grid Drag & Drop:** Grab a window by the header and drag it over another to effortlessly swap places. The grid instantly reflows.

### 💾 Native Workflow Saving
Your exact panel layout, column settings, and window order are natively bound to the ComfyUI graph. When you click "Save", **your custom dashboard layout is baked directly into the `.json` or `.png` file**. Load a workflow, and your command center rebuilds itself instantly!

### 📊 Live Progress & Mini-Galleries
* **Live Progress Bars:** Sleek gradient progress bars track your generation in real-time across all dashboards, displaying the exact node currently executing and its completion percentage.
* **History Gallery:** Breakout Hubs automatically remember your last 10 generations (including batch sizes > 1). Scroll through your history using unobtrusive navigation arrows tucked cleanly into the control header.
* **Drag & Drop:** Drag an image out from the breakout window onto the workspace to automatically create an Load Image node or to a tab an open that version as a new scene.

### ⚡ Cache-Busting Isolated Execution ("Run Window")
Clicking "Run Window" on a specific panel traces the graph backward to *only* execute the nodes necessary for that specific window. 
* **Smart Seed Scrambling:** It intelligently intercepts and scrambles native KSampler seeds *before* extracting the sub-graph, ensuring you always get a fresh image instead of a cached repeat.

### 🎛️ Inline Mode Switcher
The "Displays" sidebar tab features native dropdowns next to every detected hub. You can instantly bounce windows between Floating, External, and Control Panel modes without ever hunting for the node on the canvas.

### ☯ Zen Mode & 🌐 Unified External Dashboard
* **Zen Mode:** Dims the ComfyUI canvas and brings your breakout panels forward into a clean, auto-organized grid overlay. Optionally auto-opens the External Dashboard and offers a "Close all windows on exit" toggle.
* **Unified External:** All external breakout panels open inside a single, unified browser window (`http://127.0.0.1:8188`). Say goodbye to popup blocker nightmares and scattered tabs.

### 🖼️📝 Multi-Data Support (Images & Text)
The Breakout Hub is not just for images! Plug in an image to see a preview, or plug in a String/Text output, and the window instantly morphs to display a clean, scrollable, monospace text box. You can even drop them into the middle of a node chain as a **Pass-Through**.

### 🌱 Advanced Seed Control
The `BreakoutSeedControl` node natively supports ComfyUI's random seed behaviors right from your breakout panels. Choose between `fixed`, `increment`, `decrement`, or `randomize`. It smartly updates at the end of the generation queue to prevent double-rolling.

---

## 🛠️ Quality of Life Enhancements

* **Smart Canvas Scraping:** Opening a Breakout Window will instantly pull any image or text that was *already generated* on that node. No need to re-run your prompts!
* **Memory-Safe Architecture:** Completely rebuilt sync engine eliminates background polling loops and "Ghost DOM" memory leaks.
* **Smart Unique Naming:** Clicking "Set Unique Titles" logically names your windows based on their current state.
* **Auto-Resizing Text Inputs:** Multi-line string controls on the dashboard automatically expand as you type for a much cleaner UI.

---

## 📦 Installation & Updating

**If you are updating an existing installation:**
Navigate to your `ComfyUI/custom_nodes/` directory and pull the latest changes:
```bash
cd ComfyUI/custom_nodes/ComfyUI-Breakout-Windows
git pull
```

*Note: We highly recommend refreshing your browser cache (Ctrl+F5 or Cmd+Shift+R) after updating to ensure the new JS files load correctly!*

**New Installation:**
Clone the repository into your `custom_nodes` folder:
```bash
cd ComfyUI/custom_nodes
git clone [https://github.com/Partiallyfrozen/ComfyUI-Breakout-Windows.git](https://github.com/Partiallyfrozen/ComfyUI-Breakout-Windows.git)
```

## 🧩 Included Nodes
* **Breakout Window (Hub):** The main display node. Can be set to Floating, External, or Control Panel. Now acts as a pass-through.
* **Int (Breakout_Control):** Integer input synced to the dashboard.
* **Float (Breakout_Control):** Float input synced to the dashboard.
* **String (Breakout_Control):** Multi-line text input synced to the dashboard.
* **Bool (Breakout_Control):** Checkbox toggle synced to the dashboard.
* **Seed (Breakout_Control):** Seed integer + behavior dropdown (fixed/increment/decrement/randomize) synced to the dashboard.

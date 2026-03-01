# 🚀 ComfyUI Breakout v2.0: The "Control Deck" Update

Welcome to **Version 2.0** of ComfyUI Breakout! This major release transforms the extension from a simple floating window tool into a full-fledged, memory-safe, bidirectional "Control Deck" for your workflows. 

Whether you use a single monitor or a multi-monitor setup, v2.0 introduces powerful new ways to interact with, organize, and execute your ComfyUI graphs without ever touching the noodle spaghetti.

---

## ✨ What's New in v2.0

### ☯ Zen Mode
A completely new way to interact with your workflow. Clicking the **☯ Zen Mode** button in the sidebar dims the ComfyUI canvas and brings all your floating breakout panels into a clean, focused, auto-organized grid overlay. 
* **Auto-Open:** Optionally trigger the External Dashboard to open alongside Zen Mode via a toggle checkbox.
* **Clean Exit:** Choose to either leave your windows open when exiting Zen Mode, or check "Close all windows on exit" to instantly clear your board and return to pure ComfyUI.

### 🌐 The Unified External Dashboard
Say goodbye to popup blocker nightmares and scattered windows. All external breakout panels now open inside a **single, unified browser window**. As you send more panels to the external mode, they will automatically arrange themselves into a responsive, beautiful grid.

### 🖼️📝 Multi-Data Support (Images & Text)
The Breakout Hub is no longer just for images! The input port now accepts `*` (Any). 
* **Image Logic:** Plug in an image, and the window dynamically scales to show the image preview.
* **Text Logic:** Plug in a String/Text output, and the window instantly morphs to display a clean, scrollable, monospace text box.

### 🔗 Pass-Through Hubs
Breakout Windows now feature an **Output Port**. You can drop a Breakout Window directly into the middle of an existing node chain (e.g., between your VAE Decode and your Save Image node) without breaking the flow. It acts as a perfect data pass-through.

### 🌱 Advanced Seed Control
Introduced the new `BreakoutSeedControl` node. This natively supports ComfyUI's random seed behaviors right from your breakout panels. 
* Choose between `fixed`, `increment`, `decrement`, or `randomize` directly from the dashboard UI. 
* The extension listens to ComfyUI's execution engine and automatically syncs the newly generated seed back to your UI panels instantly.

---

## 🛠️ Quality of Life & UI/UX Enhancements

* **Smart Canvas Scraping:** Opening a Breakout Window will now instantly pull any image or text that was *already generated* on that node. No more re-running your prompts just to populate the windows!
* **Isolated Execution ("Run Window"):** Clicking "Run Window" on a specific panel traces the graph backward to *only* execute the nodes necessary for that specific window, saving massive amounts of compute time.
* **Smart Unique Naming:** Clicking "Set Unique Titles" now logically names your windows based on their current state (e.g., *Breakout Control Window 1*, *Breakout External Window 2*, *Breakout Floating Window 1*).
* **Dynamic Sidebar:** The Displays menu is now context-aware. If you have no windows open, the "Close All Open Windows" button automatically greys out and disables.
* **Auto-Resizing Text Inputs:** Multi-line string controls on the dashboard now automatically expand as you type (capping at ~10 lines) for a much cleaner UI.

---

## 🔧 Under the Hood (Performance Architecture)

Version 2.0 features a completely rewritten DOM management and synchronization baseline:
* **Zero Memory Leaks:** Background polling loops have been removed. The sidebar now refreshes instantly and contextually when you click the "Displays" tab.
* **Rock-Solid Syncing:** Control nodes (Int, Float, String, Bool, Seed) now use a strict widget wait-loop (`wrapNameWidget`). This guarantees that user inputs on the dashboard flawlessly sync bidirectionally with the canvas, regardless of load speed.
* **Shadow DOM Safe:** Fixed issues where collapsing and reopening the ComfyUI sidebar would result in blank menus or disconnected buttons.

---

## 📦 Installation & Updating

**If you are updating from v1.x:**
Navigate to your `ComfyUI/custom_nodes/` directory and pull the latest changes:
```bash
cd ComfyUI/custom_nodes/ComfyUI-Breakout-Window
git pull
```

Note: We highly recommend refreshing your browser cache (Ctrl+F5 or Cmd+Shift+R) after updating to ensure the new JS files load correctly!

New Installation:
Clone the repository into your custom_nodes folder:

Bash
```
cd ComfyUI/custom_nodes
git clone https://github.com/Partiallyfrozen/ComfyUI-Breakout-Window.git
```

## 🧩 Included Nodes
*Breakout Window (Hub): The main display node. Can be set to Floating or External. Now acts as a pass-through.

* **Int (Breakout_Control):** Integer input synced to the dashboard.
* **Float (Breakout_Control):** Float input synced to the dashboard.
* **String (Breakout_Control):** Multi-line text input synced to the dashboard.
* **Bool (Breakout_Control):** Checkbox toggle synced to the dashboard.
* **Seed (Breakout_Control):** (NEW) Seed integer + behavior dropdown (fixed/increment/decrement/randomize) synced to the dashboard.


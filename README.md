Windows UI compatible (floating window only):
<img width="2451" height="1032" alt="image" src="https://github.com/user-attachments/assets/80c876e5-f5df-41eb-a373-9a1b114db8eb" />


Browser compatible (breakout window enabled):
<img width="2504" height="874" alt="image" src="https://github.com/user-attachments/assets/f0fdcdde-280e-4583-bd0d-e0f0c57efed2" />


# 🪟 ComfyUI Breakout Window & Remote Control

A custom node extension for ComfyUI that allows you to route your image previews to a floating panel or a fully detached multi-monitor window, while providing a **customizable remote control panel** for your workflow.

Whether you want a clean canvas without giant preview nodes, want to dedicate a second physical monitor purely to viewing outputs, or want a centralized dashboard to tweak prompts and CFG scales without hunting for the nodes—this plugin has you covered.

## ✨ Features

* **Dual Display Modes:** Choose between a sleek, draggable **Floating Panel** inside the ComfyUI interface, or spawn a dedicated, detached **External Screen** to drag to your second monitor.
* **Two-Way Remote Control:** Add custom Int, Float, String, and Boolean inputs to your workflow. They instantly appear in your breakout windows so you can tweak values and edit prompts remotely. 
* **Custom Sorting:** Organize your control panel on the fly! Use the up (▲) and down (▼) arrows in the breakout window to sort your inputs perfectly. 
* **Instant Queue:** A built-in "🚀 Queue" button lets you adjust a slider or prompt and immediately trigger a generation directly from your second monitor.
* **Smart App Detection:** Automatically detects whether you are running ComfyUI in a Web Browser or the official Electron Desktop App, gracefully disabling the multi-monitor feature in Electron to prevent OS errors.

## 🚀 Installation

### Option 1: ComfyUI Manager (Recommended)
*(Note: Pending approval to the default manager list!)*
1. Open the ComfyUI Manager.
2. Click **Install Custom Nodes**.
3. Search for `Breakout Window`.
4. Click Install and restart your server.

### Option 2: Manual Git Clone
1. Navigate to your ComfyUI `custom_nodes` directory.
2. Open your terminal or command prompt.
3. Clone this repository:
```bash
git clone [https://github.com/](https://github.com/)[your-username]/ComfyUI-Breakout-Window.git
```
4. Restart your ComfyUI server and refresh your browser completely (`Ctrl` + `Shift` + `R`).

## 🧩 Available Nodes

This extension adds six custom nodes under the **Breakout** category. 

### Viewers
These nodes receive image data from your workflow and broadcast it to your breakout windows.
* **`Floating (Breakout_Window)`**: Routes the connected image to the in-app draggable panel.
* **`External (Breakout_Window)`**: Routes the connected image to the detached pop-out browser window. *(Requires using a standard web browser like Chrome/Edge).*

### Remote Controls
Connect these to your workflow inputs (like `seed`, `cfg_scale`, or `text` prompts). They automatically generate synced inputs inside your breakout windows.
* **`Int (Breakout_Control)`**: Outputs a whole number (Integer). Rendered as a number box.
* **`Float (Breakout_Control)`**: Outputs a decimal number (Float). Rendered as a decimal box.
* **`String (Breakout_Control)`**: Outputs text (String). Rendered as a multi-line text area.
* **`Bool (Breakout_Control)`**: Outputs a True/False toggle (Boolean). Rendered as a checkbox.

💡 **Pro-Tip:** Every control node has a `control_name` input on the canvas. Whatever you type here (e.g., "Positive Prompt" or "CFG Scale") is exactly what will be displayed as the label in your breakout window!

## 🛠️ How to Use

1. **Add Nodes:** Right-click your canvas, go to **Breakout**, and add your desired Viewer and Control nodes. Connect them to your workflow.
2. **Open the Viewer:** Look at the left-hand sidebar in ComfyUI and click the **Displays** icon (the desktop monitor). Click the button to launch either the Floating or External window.
3. **Refresh UI:** If you add new control nodes *after* opening the window, simply click the **↻ Refresh** button in the breakout panel to scan the canvas and generate your new inputs.
4. **Sort & Generate:** Use the arrows to organize your controls, tweak your values, and hit **🚀 Queue**!

## ⚠️ Compatibility & Desktop App Limitations

Because of security restrictions in the framework used to build the **Official ComfyUI Desktop App (Electron)**, literal pop-up windows are blocked by the operating system. 

* **If using a Web Browser (Chrome, Edge, Firefox, etc.):** Both the Floating Panel and the External Multi-Monitor window are fully supported.
* **If using the ComfyUI Desktop App:** Only the In-App Floating Panel is supported. To use the multi-monitor feature, simply leave the desktop app running in the background, open Google Chrome, and navigate to your local server address (usually `http://127.0.0.1:8188`).

## 🤝 Contributing
Pull requests are welcome! If you have ideas for adding new features, feel free to open an issue or submit a PR.

## 📜 License
MIT License. Feel free to use and modify!

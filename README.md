Windows UI compatible (floating window only):
<img width="2451" height="1032" alt="image" src="https://github.com/user-attachments/assets/80c876e5-f5df-41eb-a373-9a1b114db8eb" />


Browser compatible (breakout window enabled):
<img width="2504" height="874" alt="image" src="https://github.com/user-attachments/assets/f0fdcdde-280e-4583-bd0d-e0f0c57efed2" />


# 🪟 ComfyUI Breakout Window Preview

A custom node extension for ComfyUI that allows you to route your image previews to an in-app floating panel or a fully detached multi-monitor window. 

Whether you want a clean canvas without giant preview nodes cluttering your workspace, or you want to dedicate a second physical monitor purely to viewing your generated outputs, this plugin has you covered.

## ✨ Features

* **In-App Floating Panel:** A sleek, draggable overlay that lives inside your ComfyUI window. Perfect for keeping an eye on your outputs while scrolling around a massive workflow.
* **External Monitor Support:** Spawns a dedicated, detached browser window. Drag it to your second monitor, make it fullscreen, and watch your images roll in. 
* **Modern V1 UI Integration:** Adds a custom "Displays" tab right into the new ComfyUI sidebar for easy access to your breakout windows.
* **Smart App Detection:** Automatically detects whether you are running ComfyUI in a Web Browser or the official Electron Desktop App, gracefully disabling the multi-monitor feature in Electron to prevent OS errors.

This extension adds five custom nodes under the **Add Node > Breakout** menu. 

### Viewers
These nodes receive image data from your workflow and broadcast it to your breakout windows.

* **`1. Floating (Breakout_Window)`**
  Routes the connected image to the in-app draggable panel. Perfect for keeping an eye on generations without cluttering your main ComfyUI canvas.
* **`2. External (Breakout_Window)`**
  Routes the connected image to the detached pop-out browser window. Ideal for multi-monitor setups. *(Note: Requires using a standard web browser like Chrome/Edge, not the ComfyUI Desktop App).*

### Remote Controls
These nodes allow you to build a custom control panel inside your breakout windows. They feature up/down arrow sorting, allowing you to organize your UI on the fly. 

* **`3. Int (Breakout_Control)`**
  Outputs a whole number (Integer). Useful for controlling `seed`, `steps`, `batch_size`, etc. Rendered as a text-editable number box in the breakout window.
* **`4. Float (Breakout_Control)`**
  Outputs a decimal number (Float). Useful for controlling `cfg_scale`, `denoise`, `lora_strength`, etc. Rendered as a text-editable decimal box in the breakout window.
* **`5. String (Breakout_Control)`**
  Outputs text (String). Hook this into a CLIP Text Encode node to control your positive or negative prompts directly from the breakout window. Rendered as a multi-line text area.

💡 **Pro-Tip:** Every control node has a `control_name` input. Whatever you type here (e.g., "Positive Prompt" or "CFG Scale") is exactly what will be displayed as the label in your breakout window!

## 🚀 Installation

### Option 1: ComfyUI Manager (Recommended)
*(Note: Waiting for approval to the default manager list!)*
1. Open the ComfyUI Manager.
2. Click **Install Custom Nodes**.
3. Search for `Breakout Window`.
4. Click Install and restart your server.

### Option 2: Manual Git Clone
1. Navigate to your ComfyUI `custom_nodes` directory.
2. Open your terminal or command prompt.
3. Clone this repository:
```bash
git clone https://github.com/PartiallyFrozen/ComfyUI-Breakout-Window.git
```
4. Restart your ComfyUI server and refresh your browser.

## 🛠️ How to Use

This extension adds a new category of nodes under **Add Node > Breakout**.

1. **Add a Node:** Right-click your canvas and add either the `1. Floating (Breakout_Window)` or `2. External (Breakout_Window)` node.
2. **Connect an Image:** Route the `IMAGE` output from your VAE Decode (or any image node) into the Breakout node.
3. **Open the Viewer:** Look at the left-hand sidebar in ComfyUI and click the **Displays** icon (the desktop monitor). Click the button corresponding to your node to launch the viewing window.
4. **Queue Prompt:** Whenever your workflow finishes, the image will automatically beam directly to your breakout window!

## ⚠️ Compatibility & Desktop App Limitations

Because of security restrictions in the framework used to build the **Official ComfyUI Desktop App (Electron)**, literal pop-up windows are blocked by the operating system. 

* **If using a Web Browser (Chrome, Edge, Firefox, etc.):** Both the Floating Panel and the External Multi-Monitor window are fully supported.
* **If using the ComfyUI Desktop App:** Only the In-App Floating Panel is supported. The "External Screen" button will automatically disable itself to prevent Windows errors. To use the multi-monitor feature, simply leave the desktop app running in the background, open Google Chrome, and navigate to your local server address (usually `http://127.0.0.1:8188`).

## 📁 Folder Structure
If installing manually without Git, ensure your folder structure looks exactly like this:
```text
ComfyUI/
└── custom_nodes/
    └── ComfyUI-Breakout-Window/
        ├── __init__.py
        ├── README.md
        └── web/
            └── breakout.js
```

## 🤝 Contributing
Pull requests are welcome! If you have ideas for adding new features (like saving images directly from the breakout window or adding video support), feel free to open an issue or submit a PR.

## 📜 License
MIT License. Feel free to use and modify!

🪟 ComfyUI Breakout Window Preview
A custom node extension for ComfyUI that allows you to route your image previews to an in-app floating panel or a fully detached multi-monitor window.

Whether you want a clean canvas without giant preview nodes cluttering your workspace, or you want to dedicate a second physical monitor purely to viewing your generated outputs, this plugin has you covered.

✨ Features
In-App Floating Panel: A sleek, draggable overlay that lives inside your ComfyUI window. Perfect for keeping an eye on your outputs while scrolling around a massive workflow.

External Monitor Support: Spawns a dedicated, detached browser window. Drag it to your second monitor, make it fullscreen, and watch your images roll in.

Modern V1 UI Integration: Adds a custom "Displays" tab right into the new ComfyUI sidebar for easy access to your breakout windows.

Smart App Detection: Automatically detects whether you are running ComfyUI in a Web Browser or the official Electron Desktop App, gracefully disabling the multi-monitor feature in Electron to prevent OS errors.

🚀 Installation
Option 1: ComfyUI Manager (Recommended)
(Note: You can add this section once you submit your node to the ComfyUI Manager default list!)

Open the ComfyUI Manager.

Click Install Custom Nodes.

Search for Breakout Window.

Click Install and restart your server.

Option 2: Manual Git Clone
Navigate to your ComfyUI custom_nodes directory.

Open your terminal or command prompt.

Clone this repository:

Bash
git clone https://github.com/[your-username]/ComfyUI-Breakout-Window.git
Restart your ComfyUI server and refresh your browser.

🛠️ How to Use
This extension adds a new category of nodes under Add Node > Breakout.

Add a Node: Right-click your canvas and add either the 1. Floating Window Preview or 2. External Window Preview node.

Connect an Image: Route the IMAGE output from your VAE Decode (or any image node) into the Breakout node.

Open the Viewer: Look at the left-hand sidebar in ComfyUI and click the Displays icon (the desktop monitor). Click the button corresponding to your node to launch the viewing window.

Queue Prompt: Whenever your workflow finishes, the image will automatically beam directly to your breakout window!

⚠️ Compatibility & Desktop App Limitations
Because of security restrictions in the framework used to build the Official ComfyUI Desktop App (Electron), literal pop-up windows are blocked by the operating system.

If using a Web Browser (Chrome, Edge, Firefox, etc.): Both the Floating Panel and the External Multi-Monitor window are fully supported.

If using the ComfyUI Desktop App: Only the In-App Floating Panel is supported. The "External Screen" button will automatically disable itself to prevent Windows errors. To use the multi-monitor feature, simply leave the desktop app running in the background, open Google Chrome, and navigate to your local server address (usually http://127.0.0.1:8188).

🤝 Contributing
Pull requests are welcome! If you have ideas for adding new features (like saving images directly from the breakout window or adding video support), feel free to open an issue or submit a PR.

📜 License
MIT License. Feel free to use and modify!

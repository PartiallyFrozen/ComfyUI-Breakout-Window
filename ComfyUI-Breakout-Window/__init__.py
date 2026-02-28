import os
import random
import numpy as np
import torch
from PIL import Image
import folder_paths

# Tell ComfyUI to serve the files in the "web" folder
WEB_DIRECTORY = "./web"

# Helper function to save the image and generate the frontend message
def save_preview_image(images):
    results = []
    output_dir = folder_paths.get_temp_directory()
    
    for image in images:
        i = 255. * image.cpu().numpy()
        img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
        filename = f"breakout_{random.randint(0, 999999)}.png"
        filepath = os.path.join(output_dir, filename)
        img.save(filepath)
        results.append({"filename": filename, "subfolder": "", "type": "temp"})
        
    return {"ui": {"images": results}}

# --- Node 1: For the In-App Floating Panel ---
class FloatingWindowPreview:
    @classmethod
    def INPUT_TYPES(s): return {"required": {"images": ("IMAGE",)}}
    RETURN_TYPES = ()
    FUNCTION = "preview"
    OUTPUT_NODE = True
    CATEGORY = "Breakout"

    def preview(self, images):
        return save_preview_image(images)

# --- Node 2: For the Multi-Monitor Chrome/Edge Window ---
class ExternalWindowPreview:
    @classmethod
    def INPUT_TYPES(s): return {"required": {"images": ("IMAGE",)}}
    RETURN_TYPES = ()
    FUNCTION = "preview"
    OUTPUT_NODE = True
    CATEGORY = "Breakout"

    def preview(self, images):
        return save_preview_image(images)

# Register both nodes
NODE_CLASS_MAPPINGS = {
    "FloatingWindowPreview": FloatingWindowPreview,
    "ExternalWindowPreview": ExternalWindowPreview
}

# Updated Node Names
NODE_DISPLAY_NAME_MAPPINGS = {
    "FloatingWindowPreview": "Breakout Window (Floating)",
    "ExternalWindowPreview": "Breakout Window (External)"
}

__all__ = ['WEB_DIRECTORY', 'NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']
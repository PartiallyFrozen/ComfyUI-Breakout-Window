import os
import random
import numpy as np
import torch
from PIL import Image
import folder_paths

WEB_DIRECTORY = "./web"

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

class FloatingWindowPreview:
    @classmethod
    def INPUT_TYPES(s): return {"required": {"images": ("IMAGE",)}}
    RETURN_TYPES = ()
    FUNCTION = "preview"
    OUTPUT_NODE = True
    CATEGORY = "Breakout"
    def preview(self, images): return save_preview_image(images)

class ExternalWindowPreview:
    @classmethod
    def INPUT_TYPES(s): return {"required": {"images": ("IMAGE",)}}
    RETURN_TYPES = ()
    FUNCTION = "preview"
    OUTPUT_NODE = True
    CATEGORY = "Breakout"
    def preview(self, images): return save_preview_image(images)

# --- 1. Int Control ---
class BreakoutIntControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {
            "control_name": ("STRING", {"default": "Int_Name"}),
            "value": ("INT", {"default": 50, "min": 0, "step": 1})
        }}
    RETURN_TYPES = ("INT",)
    FUNCTION = "get_value"
    CATEGORY = "Breakout"
    def get_value(self, control_name, value): return (value,)

# --- 2. Float Control ---
class BreakoutFloatControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {
            "control_name": ("STRING", {"default": "Float_Name"}),
            "value": ("FLOAT", {"default": 1.0, "min": 0.0, "step": 0.000001})
        }}
    RETURN_TYPES = ("FLOAT",)
    FUNCTION = "get_value"
    CATEGORY = "Breakout"
    def get_value(self, control_name, value): return (value,)

# --- 3. String Control ---
class BreakoutStringControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {
            "control_name": ("STRING", {"default": "Prompt_Name"}),
            "value": ("STRING", {"default": "", "multiline": True})
        }}
    RETURN_TYPES = ("STRING",)
    FUNCTION = "get_value"
    CATEGORY = "Breakout"
    def get_value(self, control_name, value): return (value,)


NODE_CLASS_MAPPINGS = {
    "FloatingWindowPreview": FloatingWindowPreview,
    "ExternalWindowPreview": ExternalWindowPreview,
    "BreakoutIntControl": BreakoutIntControl,
    "BreakoutFloatControl": BreakoutFloatControl,
    "BreakoutStringControl": BreakoutStringControl
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FloatingWindowPreview": "Floating Window Preview",
    "ExternalWindowPreview": "External Window Preview",
    "BreakoutIntControl": "Int (Breakout_Control)",
    "BreakoutFloatControl": "Float (Breakout_Control)",
    "BreakoutStringControl": "String (Breakout_Control)"
}

__all__ = ['WEB_DIRECTORY', 'NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']
import os
import random
import numpy as np
import torch
from PIL import Image
import folder_paths

WEB_DIRECTORY = "./web"

def save_preview_image(images):
    if images is None or not isinstance(images, torch.Tensor):
        return []
    results = []
    output_dir = folder_paths.get_temp_directory()
    for image in images:
        i = 255. * image.cpu().numpy()
        img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
        filename = f"breakout_{random.randint(0, 999999)}.png"
        filepath = os.path.join(output_dir, filename)
        img.save(filepath)
        results.append({"filename": filename, "subfolder": "", "type": "temp"})
    return results

class BreakoutWindow:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "window_id": ("INT", {"default": 1, "min": 1, "max": 99}),
                "window_title": ("STRING", {"default": "Breakout Panel"}),
                "window_mode": (["Floating", "External", "Control Panel (Float)", "Control Panel (External)"], {"default": "Floating"}),
            },
            "optional": {
                "image": ("*",) # Receives any data type
            }
        }
    RETURN_TYPES = ("*",) 
    RETURN_NAMES = ("pass_through",)
    FUNCTION = "update_window"
    OUTPUT_NODE = True
    CATEGORY = "Breakout"

    def update_window(self, window_id, window_title, window_mode, image=None):
        img_results = []
        text_results = []
        
        if not window_mode.startswith("Control Panel"):
            if isinstance(image, torch.Tensor):
                img_results = save_preview_image(image)
            elif image is not None:
                if isinstance(image, (list, tuple)):
                    text_results = [str(item) for item in image]
                else:
                    text_results = [str(image)]

        return {"ui": {"images": img_results, "text": text_results, "window_id": [window_id]}, "result": (image,)}

# --- CONTROLS ---
class BreakoutIntControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"control_name": ("STRING", {"default": "Int_Name"}), "value": ("INT", {"default": 50, "min": 0, "step": 1}), "window_id": ("INT", {"default": 0, "min": 0, "max": 99})}}
    RETURN_TYPES = ("INT",); FUNCTION = "get_value"; CATEGORY = "Breakout"
    def get_value(self, control_name, value, window_id): return (value,)

class BreakoutFloatControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"control_name": ("STRING", {"default": "Float_Name"}), "value": ("FLOAT", {"default": 1.0, "min": 0.0, "step": 0.000001}), "window_id": ("INT", {"default": 0, "min": 0, "max": 99})}}
    RETURN_TYPES = ("FLOAT",); FUNCTION = "get_value"; CATEGORY = "Breakout"
    def get_value(self, control_name, value, window_id): return (value,)

class BreakoutStringControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"control_name": ("STRING", {"default": "Prompt_Name"}), "value": ("STRING", {"default": "", "multiline": True}), "window_id": ("INT", {"default": 0, "min": 0, "max": 99})}}
    RETURN_TYPES = ("STRING",); FUNCTION = "get_value"; CATEGORY = "Breakout"
    def get_value(self, control_name, value, window_id): return (value,)

class BreakoutBoolControl:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"control_name": ("STRING", {"default": "Bool_Name"}), "value": ("BOOLEAN", {"default": True}), "window_id": ("INT", {"default": 0, "min": 0, "max": 99})}}
    RETURN_TYPES = ("BOOLEAN",); FUNCTION = "get_value"; CATEGORY = "Breakout"
    def get_value(self, control_name, value, window_id): return (value,)

class BreakoutSeedControl:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "control_name": ("STRING", {"default": "Seed_Name"}), 
                "value": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}), 
                "control_after_generate": (["fixed", "increment", "decrement", "randomize"],),
                "window_id": ("INT", {"default": 0, "min": 0, "max": 99})
            }
        }
    RETURN_TYPES = ("INT",); FUNCTION = "get_value"; CATEGORY = "Breakout"
    def get_value(self, control_name, value, control_after_generate, window_id): return (value,)

NODE_CLASS_MAPPINGS = {
    "BreakoutWindow": BreakoutWindow, 
    "BreakoutIntControl": BreakoutIntControl, 
    "BreakoutFloatControl": BreakoutFloatControl, 
    "BreakoutStringControl": BreakoutStringControl, 
    "BreakoutBoolControl": BreakoutBoolControl,
    "BreakoutSeedControl": BreakoutSeedControl
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "BreakoutWindow": "Breakout Window (Hub)", 
    "BreakoutIntControl": "Int (Breakout_Control)", 
    "BreakoutFloatControl": "Float (Breakout_Control)", 
    "BreakoutStringControl": "String (Breakout_Control)", 
    "BreakoutBoolControl": "Bool (Breakout_Control)",
    "BreakoutSeedControl": "Seed (Breakout_Control)"
}
__all__ = ['WEB_DIRECTORY', 'NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

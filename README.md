<img width="1717" height="1632" alt="image" src="https://github.com/user-attachments/assets/aac99139-557c-478a-bd49-66bf5c2b3076" />

插件介绍：
•不是复杂的提示词管理器
•而是一个轻量、稳定、易维护的本地txt文本预设选择节点
•特别适合长文本、多换行、经常改内容的提示词场景

# ComfyUI 文本预设选择器
一个简单的 ComfyUI 自定义节点，用于从本地 `.txt` 文件加载长文本预设。
## 功能
- 从下拉菜单中选择预设
- 输出所选预设的完整文本内容
- 在下拉菜单中自动隐藏 `.txt` 扩展名
- 易于维护长多行提示预设
- 无需 JSON 转义
## 节点名称
- ComfyUI 中显示名称：`文本预设选择器`

Plugin Introduction:
• Not a complex prompt manager
• But a lightweight, stable, and easy-to-maintain local txt text preset selection node
• Especially suitable for scenarios with long text, multiple line breaks, and frequently edited prompts

# ComfyUI TextPreset Selector

A simple ComfyUI custom node for loading long text presets from local `.txt` files.

## Features

- Select a preset from a dropdown
- Output the full text content of the selected preset
- Automatically hides the `.txt` extension in the dropdown
- Easy to maintain for long multi-line prompt presets
- No JSON escaping needed

## Node Name

- Display name in ComfyUI: `文本预设选择器`

## Folder Structure

```text
comfyui_textpreset_selector/
├─ __init__.py
├─ textpreset_selector.py
└─ presets/
   ├─ 01_提示词润色.txt
   ├─ 02_图像编辑提示词.txt
   └─ 03_英语增强器.txt

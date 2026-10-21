
# ComfyUI 文本预设节点

为 ComfyUI 提供文本预设读取、选择和编辑节点。节点输出均为 `STRING`，可连接到需要文本输入的节点。

<img width="1085" height="1246" alt="文本预设选择器" src="https://github.com/user-attachments/assets/ed60e46f-7ab9-4b87-96ed-f61de0613507" />

## 节点

### 文本预设选择器

从 `presets` 文件夹中选择一个 TXT 文件，并输出文件的全部内容。

- 每个 TXT 文件对应一个预设选项。
- 适合将完整文本文件作为预设使用。

### 增强文本预设选择器

提供与“文本预设选择器”相同的预设读取方式，并增加一个可编辑的临时文本输入。

- 选择预设后，临时文本框以所选文件内容作为默认值。
- 节点输出临时文本框的内容。
- 编辑内容不会写回原 TXT 文件。

### TXT 文本预设选择器

从 `text_library` 文件夹中选择 TXT 文件和其中的标题预设，并输出对应正文。

标题和内容使用以下格式：

```text
标题一***
这是标题一对应的内容。
可以包含多行。

标题二***
这是标题二对应的内容。
```

- 标题行以 `***` 结尾。
- 标题正文从标题行之后开始，直到下一个标题行或文件结束。
- 标题下拉项会按文件中的顺序显示，并带有序号，例如 `01-标题一`。
- 节点根据当前选择的 TXT 文件读取标题和正文。

### TXT 文本预设编辑器

提供与“TXT 文本预设选择器”相同的 TXT 文件和标题选择，并增加多行文本编辑框。

- 选择标题后，文本框会载入对应正文。
- 可通过节点提供的编辑器操作创建预设并保存正文。
- 保存会更新 `text_library` 中对应 TXT 文件的预设正文。

## 文件夹

插件目录中使用两个独立文件夹：

```text
presets/
text_library/
```

- `presets/`：供“文本预设选择器”和“增强文本预设选择器”读取。每个 TXT 文件作为一个完整文本预设。
- `text_library/`：供两个 TXT 标题选择节点使用。文件内容需按“标题 + 正文”的格式组织。

插件首次运行时会自动创建相关文件夹。将 TXT 文件放入对应目录后，重新载入工作流或刷新 ComfyUI 页面即可使用。

## 安装

将插件文件夹放入 ComfyUI 的 `custom_nodes` 目录，然后重启 ComfyUI。

```text
ComfyUI/
└── custom_nodes/
    └── <插件文件夹>/
        ├── __init__.py
        ├── text_preset_selector.py
        ├── enhanced_text_preset_selector.py
        ├── simple_text_selector.py
        ├── editable_text_selector.py
        ├── presets/
        ├── text_library/
        └── web/
```

## 注意事项

- `presets` 与 `text_library` 用途不同，两个目录中的文件不会互相读取。
- 标题预设文件请使用 UTF-8 编码；读取时支持 UTF-8 BOM。
- 标题行必须以 `***` 结尾。
- 保存编辑后的内容会修改 `text_library` 中对应的 TXT 文件。建议重要文件提前备份。
```

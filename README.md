**README_EN.md**

```markdown
# ComfyUI Text Preset Nodes

A set of ComfyUI nodes for reading, selecting, and editing text presets. All nodes output a `STRING` that can be connected to nodes requiring text input.

<img width="1085" height="1246" alt="文本预设选择器" src="https://github.com/user-attachments/assets/ed60e46f-7ab9-4b87-96ed-f61de0613507" />

## Nodes

### Text Preset Selector

Selects a TXT file from the `presets` folder and outputs the file's entire contents.

- Each TXT file appears as a separate preset option.
- Use this node when a complete text file is the preset.

### Enhanced Text Preset Selector

Reads presets in the same way as the Text Preset Selector and adds an editable temporary text input.

- The text input is initialized with the selected file's contents.
- The node outputs the text input's current contents.
- Changes made in the input are not written back to the original TXT file.

### TXT Text Preset Selector

Selects a TXT file from the `text_library` folder, then selects a titled preset within that file and outputs its body.

Use this format for titles and their contents:

```text
Title One***
Content for the first title.
This content can span multiple lines.

Title Two***
Content for the second title.
```

- A title line must end with `***`.
- The body starts on the line after the title and ends at the next title line or the end of the file.
- Titles appear in file order with a numeric prefix, such as `01-Title One`.
- The node reads the title and body for the selected TXT file.

### TXT Text Preset Editor

Provides the same TXT file and title selection as the TXT Text Preset Selector, with an additional multiline text editor.

- Selecting a title loads its body into the text editor.
- The editor provides actions to create a preset and save its content.
- Saving updates the corresponding preset body in the TXT file under `text_library`.

## Folders

The plugin uses two separate folders:

```text
presets/
text_library/
```

- `presets/`: Used by the Text Preset Selector and Enhanced Text Preset Selector. Each TXT file is treated as one complete text preset.
- `text_library/`: Used by the two TXT title-based selector nodes. Files in this folder must use the title-and-body format described above.

The folders are created automatically when the plugin runs. Add TXT files to the appropriate folder, then reload the workflow or refresh the ComfyUI page.

## Installation

Place the plugin folder in ComfyUI's `custom_nodes` directory, then restart ComfyUI.

```text
ComfyUI/
└── custom_nodes/
    └── <plugin-folder>/
        ├── __init__.py
        ├── text_preset_selector.py
        ├── enhanced_text_preset_selector.py
        ├── simple_text_selector.py
        ├── editable_text_selector.py
        ├── presets/
        ├── text_library/
        └── web/
```

## Notes

- `presets` and `text_library` serve different purposes. Nodes do not read files from the other folder.
- Use UTF-8 encoding for title-based preset files. UTF-8 with BOM is also supported.
- Every title line must end with `***`.
- Saving edited content modifies the corresponding TXT file in `text_library`. Back up important files before editing them.
```

import os


def get_base_dir():
    return os.path.dirname(os.path.abspath(__file__))


def get_presets_dir():
    return os.path.join(get_base_dir(), "presets")


def list_preset_files():
    presets_dir = get_presets_dir()

    if not os.path.exists(presets_dir):
        return []

    files = []
    for name in os.listdir(presets_dir):
        path = os.path.join(presets_dir, name)
        if os.path.isfile(path) and name.lower().endswith(".txt"):
            files.append(name)

    files.sort()
    return files


def build_display_map():
    files = list_preset_files()
    display_map = {}

    for filename in files:
        display_name = os.path.splitext(filename)[0]
        display_map[display_name] = filename

    return display_map


def get_display_names():
    display_map = build_display_map()
    names = list(display_map.keys())

    if not names:
        return ["未找到预设文件"]

    return names


def read_preset_text(display_name):
    if display_name == "未找到预设文件":
        return "未在 presets 文件夹中找到任何 .txt 预设文件。"

    display_map = build_display_map()
    filename = display_map.get(display_name)

    if not filename:
        return "所选预设不存在。"

    path = os.path.join(get_presets_dir(), filename)

    if not os.path.exists(path):
        return "预设文件不存在。"

    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"读取预设文件失败: {e}"


class TextPresetSelector:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "预设": (get_display_names(),),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本",)
    FUNCTION = "load_text"
    CATEGORY = "文本工具"

    def load_text(self, 预设):
        text = read_preset_text(预设)
        return (text,)


NODE_CLASS_MAPPINGS = {
    "TextPresetSelector": TextPresetSelector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TextPresetSelector": "文本预设选择器"
}

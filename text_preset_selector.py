import os
from aiohttp import web


try:
    from server import PromptServer
except Exception:
    PromptServer = None


# ============================================================
# 配置
# ============================================================

PLUGIN_ROUTE_PREFIX = "/text_preset_selector"

PRESETS_FOLDER = "presets"

NO_PRESET = "无预设"


# ============================================================
# 路径
# ============================================================

def get_plugin_path():
    return os.path.dirname(
        os.path.abspath(__file__)
    )


def get_presets_path():
    path = os.path.join(
        get_plugin_path(),
        PRESETS_FOLDER
    )

    os.makedirs(
        path,
        exist_ok=True
    )

    return path


# ============================================================
# TXT 文件处理
# ============================================================

def get_txt_files():
    folder = get_presets_path()

    result = []

    try:
        for filename in os.listdir(folder):
            full_path = os.path.join(
                folder,
                filename
            )

            if not os.path.isfile(full_path):
                continue

            if not filename.lower().endswith(".txt"):
                continue

            result.append(filename)

    except Exception:
        pass

    result.sort(
        key=lambda value: value.casefold()
    )

    return result


def get_display_names():
    files = get_txt_files()

    names = []

    for filename in files:
        name = os.path.splitext(
            filename
        )[0]

        names.append(name)

    if not names:
        names.append(NO_PRESET)

    return names


def get_filename(display_name):
    if display_name == NO_PRESET:
        return None

    if not isinstance(display_name, str):
        return None

    display_name = display_name.strip()

    if not display_name:
        return None

    filename = f"{display_name}.txt"

    # 防止通过预设名称访问子目录或其他路径
    if os.path.basename(filename) != filename:
        return None

    if ".." in filename:
        return None

    return filename


def read_preset(display_name):
    filename = get_filename(
        display_name
    )

    if filename is None:
        return ""

    presets_path = os.path.abspath(
        get_presets_path()
    )

    path = os.path.abspath(
        os.path.join(
            presets_path,
            filename
        )
    )

    try:
        if os.path.commonpath(
            [
                presets_path,
                path
            ]
        ) != presets_path:
            return None
    except ValueError:
        return ""

    if not os.path.isfile(path):
        return ""

    try:
        with open(
            path,
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as file:
            return file.read()

    except Exception:
        return ""


# ============================================================
# ComfyUI 节点
# ============================================================

class TextPresetSelector:

    @classmethod
    def INPUT_TYPES(cls):
        presets = get_display_names()

        default = presets[0]

        return {
            "required": {
                "预设": (
                    presets,
                    {
                        "default": default
                    }
                )
            }
        }

    RETURN_TYPES = (
        "STRING",
    )

    RETURN_NAMES = (
        "文本",
    )

    FUNCTION = "get_text"

    CATEGORY = "文本工具"

    def get_text(self, 预设):
        text = read_preset(
            预设
        )

        if text is None:
            text = ""

        return (
            text,
        )


# ============================================================
# 节点注册
# ============================================================

NODE_CLASS_MAPPINGS = {
    "TextPresetSelector": TextPresetSelector
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "TextPresetSelector": "文本预设选择器"
}


# ============================================================
# API
# ============================================================

def register_routes():
    if PromptServer is None:
        return

    try:
        routes = (
            PromptServer
            .instance
            .routes
        )

    except Exception:
        return

    @routes.get(
        f"{PLUGIN_ROUTE_PREFIX}/presets"
    )
    async def api_presets(request):
        return web.json_response({
            "presets": get_display_names()
        })

    @routes.get(
        f"{PLUGIN_ROUTE_PREFIX}/content"
    )
    async def api_content(request):
        preset = request.query.get(
            "preset",
            ""
        )

        return web.json_response({
            "text": read_preset(preset) or ""
        })


register_routes()

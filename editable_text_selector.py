import os
import re
import tempfile
from aiohttp import web

try:
    from server import PromptServer
except Exception:
    PromptServer = None


# ============================================================
# 基础配置
# ============================================================

PLUGIN_ROUTE_PREFIX = "/editable_text_selector"

TEXT_LIBRARY_DIR_NAME = "text_library"

NO_TXT_FILE = "无TXT文件"
NO_PRESET_TITLE = "无预设标题"

# 标题序号格式，例如：
# 01-标题
# 02-标题
NUMBERED_TITLE_PATTERN = re.compile(r"^\d+-(.*)$")


# ============================================================
# 路径相关
# ============================================================

def get_base_dir():
    return os.path.dirname(os.path.abspath(__file__))


def get_text_library_dir():
    """
    新节点专用目录。
    不使用旧节点的 presets 文件夹。
    """
    return os.path.join(
        get_base_dir(),
        TEXT_LIBRARY_DIR_NAME
    )


def ensure_text_library_dir():
    folder = get_text_library_dir()
    os.makedirs(folder, exist_ok=True)
    return folder


def is_safe_txt_filename(filename):
    """
    只允许访问 text_library 目录下的普通 TXT 文件。
    """
    if not isinstance(filename, str):
        return False

    filename = filename.strip()

    if not filename:
        return False

    if filename == NO_TXT_FILE:
        return False

    if not filename.lower().endswith(".txt"):
        return False

    # 禁止子目录和绝对路径
    if os.path.basename(filename) != filename:
        return False

    # 禁止路径穿越
    if ".." in filename:
        return False

    return True


def get_safe_txt_path(filename):
    if not is_safe_txt_filename(filename):
        return None

    folder = ensure_text_library_dir()

    folder_abs = os.path.abspath(folder)

    file_path = os.path.abspath(
        os.path.join(
            folder_abs,
            filename
        )
    )

    try:
        common_path = os.path.commonpath(
            [
                folder_abs,
                file_path
            ]
        )
    except ValueError:
        return None

    if common_path != folder_abs:
        return None

    return file_path


# ============================================================
# TXT 文件相关
# ============================================================

def list_txt_files():
    folder = ensure_text_library_dir()
    files = []

    try:
        for filename in os.listdir(folder):
            file_path = os.path.join(
                folder,
                filename
            )

            if not os.path.isfile(file_path):
                continue

            if not filename.lower().endswith(".txt"):
                continue

            files.append(filename)

    except OSError:
        pass

    files.sort(key=lambda value: value.casefold())

    if not files:
        return [NO_TXT_FILE]

    return files


def read_text_file(path):
    """
    支持 UTF-8、UTF-8 BOM。
    """
    try:
        with open(
            path,
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as file:
            return file.read()

    except UnicodeDecodeError:
        with open(
            path,
            "r",
            encoding="utf-8",
            newline=""
        ) as file:
            return file.read()


def parse_preset_text(text):
    """
    TXT 格式：

    标题01***
    内容第一行
    内容第二行

    标题02***
    第二个内容

    返回：
    {
        "标题01": "内容第一行\n内容第二行",
        "标题02": "第二个内容"
    }

    预设顺序按照 TXT 中的出现顺序保留。
    """

    presets = {}

    current_title = None
    current_lines = []

    for line in text.splitlines():
        check_line = line.rstrip()

        # 以 *** 结尾的行视为新标题
        if check_line.endswith("***"):
            # 保存上一个预设
            if current_title is not None:
                if current_title not in presets:
                    presets[current_title] = "\n".join(
                        current_lines
                    )

            raw_title = check_line[:-3].strip()

            if raw_title:
                current_title = raw_title
                current_lines = []
            else:
                current_title = None
                current_lines = []

        else:
            if current_title is not None:
                current_lines.append(line)

    # 保存最后一个预设
    if current_title is not None:
        if current_title not in presets:
            presets[current_title] = "\n".join(
                current_lines
            )

    return presets


def parse_preset_file(filename):
    path = get_safe_txt_path(filename)

    if path is None:
        return {}

    if not os.path.isfile(path):
        return {}

    try:
        text = read_text_file(path)
    except Exception:
        return {}

    return parse_preset_text(text)


# ============================================================
# 标题处理
# ============================================================

def make_display_title(raw_title, index, total):
    """
    将真实标题转换为 ComfyUI 使用的带序号标题。

    例如：
    Qwen打光 -> 01-Qwen打光
    """

    width = max(
        2,
        len(str(total))
    )

    number = str(index + 1).zfill(width)

    return f"{number}-{raw_title}"


def get_title_entries(filename):
    """
    返回标题映射列表：

    [
        {
            "raw": "Qwen打光",
            "display": "01-Qwen打光"
        },
        ...
    ]
    """

    presets = parse_preset_file(filename)

    raw_titles = list(presets.keys())
    total = len(raw_titles)

    entries = []

    for index, raw_title in enumerate(raw_titles):
        entries.append({
            "raw": raw_title,
            "display": make_display_title(
                raw_title,
                index,
                total
            )
        })

    return entries


def get_titles(filename):
    """
    返回给 ComfyUI 下拉框的合法值。

    这里直接返回带序号的标题，确保前端和后端值一致。

    例如：
    [
        "01-Qwen打光",
        "02-Klein打光"
    ]
    """

    entries = get_title_entries(filename)

    if not entries:
        return [NO_PRESET_TITLE]

    return [
        entry["display"]
        for entry in entries
    ]


def get_all_titles_for_validation():
    """
    返回所有 TXT 文件中的标题合集。

    重要原因：
    ComfyUI 在运行工作流时，会根据 INPUT_TYPES 里的 combo 列表
    检查当前节点的值是否合法。

    如果这里只返回某一个 TXT 文件的标题，那么当工作流中多个节点
    选择了不同 TXT 文件时，就可能出现：

    Value not in list: 预设标题

    所以这里返回 text_library 中所有 TXT 文件的标题合集。
    前端 JS 仍然会根据当前节点选择的 TXT 文件动态显示对应标题。
    """

    files = list_txt_files()

    titles = []
    seen = set()

    for filename in files:
        if filename == NO_TXT_FILE:
            continue

        file_titles = get_titles(filename)

        for title in file_titles:
            if title == NO_PRESET_TITLE:
                continue

            if title in seen:
                continue

            seen.add(title)
            titles.append(title)

    if not titles:
        return [NO_PRESET_TITLE]

    return titles


def resolve_raw_title(filename, title):
    """
    将 ComfyUI 中的带序号标题转换成 TXT 中的真实标题。

    例如：
    01-Qwen打光 -> Qwen打光

    同时兼容旧值：
    Qwen打光 -> Qwen打光
    """

    if not isinstance(title, str):
        return None

    title = title.strip()

    if not title:
        return None

    entries = get_title_entries(filename)

    # 优先匹配带序号标题
    for entry in entries:
        if title == entry["display"]:
            return entry["raw"]

    # 兼容之前未带序号的工作流值
    for entry in entries:
        if title == entry["raw"]:
            return entry["raw"]

    # 兼容类似 01-标题 的旧数据
    match = NUMBERED_TITLE_PATTERN.match(title)

    if match:
        possible_raw_title = match.group(1).strip()

        for entry in entries:
            if possible_raw_title == entry["raw"]:
                return entry["raw"]

    return None


def get_first_file():
    files = list_txt_files()

    if files:
        return files[0]

    return NO_TXT_FILE


def get_first_title(filename):
    titles = get_titles(filename)

    if titles:
        return titles[0]

    return NO_PRESET_TITLE


# ============================================================
# 读取和保存内容
# ============================================================

def read_preset_content(filename, title):
    if filename == NO_TXT_FILE:
        return "未在 text_library 文件夹中找到任何 .txt 文件。"

    if title == NO_PRESET_TITLE:
        return "当前 TXT 文件中没有可用预设。请使用格式：标题***"

    raw_title = resolve_raw_title(
        filename,
        title
    )

    if raw_title is None:
        return ""

    presets = parse_preset_file(filename)

    return presets.get(raw_title, "")


def write_text_file_safely(path, content):
    """
    通过临时文件写入后替换原文件，降低文件损坏风险。
    """

    folder = os.path.dirname(path)
    temp_path = None

    try:
        file_descriptor, temp_path = tempfile.mkstemp(
            prefix=".editable_text_selector_",
            suffix=".tmp",
            dir=folder,
            text=True
        )

        with os.fdopen(
            file_descriptor,
            "w",
            encoding="utf-8",
            newline=""
        ) as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())

        os.replace(
            temp_path,
            path
        )

        temp_path = None

        return True, ""

    except Exception as error:
        return False, str(error)

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def build_updated_preset_file(
    original_text,
    target_raw_title,
    new_content
):
    """
    替换指定真实标题的正文内容。
    """

    lines = original_text.splitlines()

    output_lines = []
    replacing_target = False
    target_found = False

    for line in lines:
        check_line = line.rstrip()

        if check_line.endswith("***"):
            # 结束目标预设，写入新的正文
            if replacing_target:
                if new_content:
                    output_lines.extend(
                        new_content.splitlines()
                    )

                output_lines.append("")
                replacing_target = False

            output_lines.append(line)

            detected_title = check_line[:-3].strip()

            if detected_title == target_raw_title:
                replacing_target = True
                target_found = True

        else:
            if replacing_target:
                # 跳过旧正文
                continue

            output_lines.append(line)

    # 目标预设位于文件末尾
    if replacing_target:
        if new_content:
            output_lines.extend(
                new_content.splitlines()
            )

    # 如果没有找到目标标题，则追加
    if not target_found:
        while output_lines and output_lines[-1] == "":
            output_lines.pop()

        if output_lines:
            output_lines.append("")

        output_lines.append(
            f"{target_raw_title}***"
        )

        if new_content:
            output_lines.extend(
                new_content.splitlines()
            )

    return "\n".join(output_lines) + "\n"


def write_preset_content(filename, title, text):
    if filename == NO_TXT_FILE:
        return False, "当前没有可保存的 TXT 文件。"

    if title == NO_PRESET_TITLE:
        return False, "当前没有可保存的预设标题。"

    if not isinstance(text, str):
        text = str(text)

    raw_title = resolve_raw_title(
        filename,
        title
    )

    if raw_title is None:
        return False, "所选预设不存在，可能是 TXT 文件已被外部修改。请先刷新。"

    path = get_safe_txt_path(filename)

    if path is None:
        return False, "非法文件名。"

    if not os.path.isfile(path):
        return False, "TXT 文件不存在。"

    try:
        original_text = read_text_file(path)
    except Exception as error:
        return False, f"读取文件失败：{error}"

    updated_text = build_updated_preset_file(
        original_text,
        raw_title,
        text
    )

    success, error_message = write_text_file_safely(
        path,
        updated_text
    )

    if not success:
        return False, f"保存失败：{error_message}"

    return True, "保存成功。"


def create_new_preset(filename):
    """
    创建一个新的空预设。
    """

    if filename == NO_TXT_FILE:
        return False, "", "当前没有可用的 TXT 文件。"

    path = get_safe_txt_path(filename)

    if path is None:
        return False, "", "非法文件名。"

    if not os.path.isfile(path):
        return False, "", "TXT 文件不存在。"

    presets = parse_preset_file(filename)

    base_title = "新预设"
    new_raw_title = base_title
    number = 2

    while new_raw_title in presets:
        new_raw_title = f"{base_title}{number}"
        number += 1

    try:
        original_text = read_text_file(path)
    except Exception as error:
        return False, "", f"读取文件失败：{error}"

    original_text = original_text.rstrip()

    if original_text:
        updated_text = (
            original_text
            + "\n\n"
            + f"{new_raw_title}***\n"
        )
    else:
        updated_text = f"{new_raw_title}***\n"

    success, error_message = write_text_file_safely(
        path,
        updated_text
    )

    if not success:
        return False, "", f"新增预设失败：{error_message}"

    # 新增后重新读取，获取带序号的合法标题
    titles = get_titles(filename)

    new_display_title = ""

    for title in titles:
        raw = resolve_raw_title(
            filename,
            title
        )

        if raw == new_raw_title:
            new_display_title = title
            break

    if not new_display_title:
        new_display_title = new_raw_title

    return (
        True,
        new_display_title,
        "新预设已创建，请编辑内容后保存。"
    )


# ============================================================
# ComfyUI 节点
# ============================================================

class EditableTextSelector:
    @classmethod
    def INPUT_TYPES(cls):
        first_file = get_first_file()

        first_title = get_first_title(
            first_file
        )

        first_text = read_preset_content(
            first_file,
            first_title
        )

        return {
            "required": {
                "TXT文件": (
                    list_txt_files(),
                    {
                        "default": first_file
                    }
                ),

                # 重要：
                # 这里必须返回所有 TXT 文件中的标题合集。
                #
                # 原因：
                # ComfyUI 运行工作流时会用 INPUT_TYPES 中的 combo 列表
                # 校验节点当前值是否合法。
                #
                # 如果这里仅返回 first_file 的标题，那么多个节点选择不同 TXT
                # 文件时，其它节点就可能报：
                #
                # Value not in list: 预设标题
                #
                # 前端 JS 仍然会根据当前 TXT 文件动态刷新下拉框。
                "预设标题": (
                    get_all_titles_for_validation(),
                    {
                        "default": first_title
                    }
                ),

                "文本内容": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": first_text
                    }
                ),
            }
        }

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs):
        """
        尽量放行动态下拉框校验。

        说明：
        这个节点的“预设标题”是前端根据当前 TXT 文件动态刷新的。
        不同节点可以选择不同 TXT 文件，因此后端静态 combo 校验
        容易产生误判。

        安全性：
        文件路径安全由以下函数保证：
        - is_safe_txt_filename
        - get_safe_txt_path

        标题解析由以下函数保证：
        - resolve_raw_title
        - read_preset_content
        - write_preset_content

        因此这里放行输入校验不会导致任意路径读取。
        """

        return True

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本输出",)

    FUNCTION = "output_text"
    CATEGORY = "文本工具"

    def output_text(
        self,
        TXT文件,
        预设标题,
        文本内容
    ):
        if 文本内容 is None:
            文本内容 = ""

        return (文本内容,)


NODE_CLASS_MAPPINGS = {
    "EditableTextSelector": EditableTextSelector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EditableTextSelector": "TXT文本预设编辑器"
}


# ============================================================
# HTTP API
# ============================================================

def register_routes():
    if PromptServer is None:
        return

    try:
        routes = PromptServer.instance.routes
    except Exception:
        return

    @routes.get(f"{PLUGIN_ROUTE_PREFIX}/files")
    async def api_files(request):
        return web.json_response({
            "files": list_txt_files()
        })

    @routes.get(f"{PLUGIN_ROUTE_PREFIX}/titles")
    async def api_titles(request):
        filename = request.query.get(
            "file",
            ""
        )

        return web.json_response({
            "titles": get_titles(filename)
        })

    @routes.get(f"{PLUGIN_ROUTE_PREFIX}/content")
    async def api_content(request):
        filename = request.query.get(
            "file",
            ""
        )

        title = request.query.get(
            "title",
            ""
        )

        return web.json_response({
            "text": read_preset_content(
                filename,
                title
            )
        })

    @routes.post(f"{PLUGIN_ROUTE_PREFIX}/save")
    async def api_save(request):
        try:
            body = await request.json()
        except Exception:
            return web.json_response(
                {
                    "ok": False,
                    "message": "请求不是有效的 JSON。"
                },
                status=400
            )

        filename = body.get(
            "file",
            ""
        )

        title = body.get(
            "title",
            ""
        )

        text = body.get(
            "text",
            ""
        )

        success, message = write_preset_content(
            filename,
            title,
            text
        )

        return web.json_response({
            "ok": success,
            "message": message,
            "titles": get_titles(filename),
            "text": read_preset_content(
                filename,
                title
            )
        })

    @routes.post(f"{PLUGIN_ROUTE_PREFIX}/new")
    async def api_new(request):
        try:
            body = await request.json()
        except Exception:
            return web.json_response(
                {
                    "ok": False,
                    "message": "请求不是有效的 JSON。"
                },
                status=400
            )

        filename = body.get(
            "file",
            ""
        )

        success, new_title, message = create_new_preset(
            filename
        )

        return web.json_response({
            "ok": success,
            "title": new_title,
            "message": message,
            "titles": get_titles(filename)
        })


register_routes()

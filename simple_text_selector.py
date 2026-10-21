from .editable_text_selector import (
    get_first_file,
    get_first_title,
    list_txt_files,
    get_all_titles_for_validation,
    read_preset_content,
)


class SimpleTextSelector:
    @classmethod
    def INPUT_TYPES(cls):
        first_file = get_first_file()
        first_title = get_first_title(first_file)

        return {
            "required": {
                "TXT文件": (
                    list_txt_files(),
                    {
                        "default": first_file
                    }
                ),

                "预设标题": (
                    get_all_titles_for_validation(),
                    {
                        "default": first_title
                    }
                ),
            }
        }

    @classmethod
    def VALIDATE_INPUTS(cls, **kwargs):
        # 标题列表会根据当前 TXT 文件由前端动态刷新。
        return True

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本输出",)

    FUNCTION = "output_text"
    CATEGORY = "文本工具"

    def output_text(self, TXT文件, 预设标题):
        text = read_preset_content(
            TXT文件,
            预设标题
        )

        return (text,)


NODE_CLASS_MAPPINGS = {
    "SimpleTextSelector": SimpleTextSelector
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SimpleTextSelector": "TXT文本预设选择器"
}

from .text_preset_selector import (
    get_display_names,
    read_preset,
)


class EnhancedTextPresetSelector:

    @classmethod
    def INPUT_TYPES(cls):
        presets = get_display_names()

        default_preset = presets[0]

        default_text = read_preset(
            default_preset
        )

        if default_text is None:
            default_text = ""

        return {
            "required": {
                "预设": (
                    presets,
                    {
                        "default": default_preset
                    }
                ),

                "临时编辑文本": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": default_text,
                        "forceInput": False,
                        "defaultInput": False
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

    def get_text(
        self,
        预设,
        临时编辑文本
    ):
        return (
            临时编辑文本,
        )


NODE_CLASS_MAPPINGS = {
    "EnhancedTextPresetSelector":
        EnhancedTextPresetSelector
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "EnhancedTextPresetSelector":
        "增强文本预设选择器"
}

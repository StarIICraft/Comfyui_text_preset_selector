import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";


const EXTENSION_NAME =
    "Comfy.EnhancedTextPresetSelector";

const NODE_TYPE =
    "EnhancedTextPresetSelector";

const ROUTE =
    "/text_preset_selector";

const NO_PRESET =
    "无预设";


function findWidget(node, name) {
    if (!node || !Array.isArray(node.widgets)) {
        return null;
    }

    return (
        node.widgets.find(
            widget => widget && widget.name === name
        ) || null
    );
}


function getWidgetValue(widget) {
    if (!widget) {
        return "";
    }

    if (
        widget.value === undefined ||
        widget.value === null
    ) {
        return "";
    }

    return String(widget.value);
}


function setWidgetValue(widget, value) {
    if (!widget) {
        return;
    }

    widget.value =
        value === undefined || value === null
            ? ""
            : String(value);
}


function setPresetValues(widget, values) {
    if (!widget) {
        return;
    }

    if (
        !Array.isArray(values) ||
        values.length === 0
    ) {
        values = [NO_PRESET];
    }

    if (!widget.options) {
        widget.options = {};
    }

    widget.options.values = values;

    const currentValue =
        getWidgetValue(widget);

    if (values.includes(currentValue)) {
        widget.value = currentValue;
    } else {
        widget.value = values[0];
    }
}


function redrawNode(node) {
    if (
        node &&
        typeof node.setDirtyCanvas === "function"
    ) {
        node.setDirtyCanvas(true, true);
    }
}


async function requestJson(url) {
    const response =
        await api.fetchApi(url);

    if (!response.ok) {
        throw new Error(
            `${response.status} ${response.statusText}`
        );
    }

    return await response.json();
}


async function getPresets() {
    const data =
        await requestJson(
            `${ROUTE}/presets`
        );

    if (
        !data ||
        !Array.isArray(data.presets)
    ) {
        return [];
    }

    return data.presets;
}


async function getContent(preset) {
    const url =
        `${ROUTE}/content?preset=${
            encodeURIComponent(preset)
        }`;

    const data =
        await requestJson(url);

    if (
        data &&
        typeof data.text === "string"
    ) {
        return data.text;
    }

    return "";
}


function beginRequest(node) {
    if (!node) {
        return 0;
    }

    node.__enhancedPresetRequestId =
        Number(
            node.__enhancedPresetRequestId || 0
        ) + 1;

    return node.__enhancedPresetRequestId;
}


function isCurrentRequest(node, requestId) {
    return (
        node &&
        Number(
            node.__enhancedPresetRequestId || 0
        ) === requestId
    );
}


function wrapWidgetCallback(widget, callback) {
    if (!widget) {
        return;
    }

    if (widget.__enhancedPresetCallbackWrapped) {
        return;
    }

    widget.__enhancedPresetCallbackWrapped = true;

    const oldCallback =
        widget.callback;

    widget.callback =
        async function (...args) {
            if (typeof oldCallback === "function") {
                try {
                    oldCallback.apply(
                        this,
                        args
                    );
                } catch (error) {
                    console.warn(
                        "执行原有预设回调失败：",
                        error
                    );
                }
            }

            try {
                await callback(...args);
            } catch (error) {
                console.error(
                    "处理增强预设失败：",
                    error
                );
            }
        };
}


async function refreshPresetList(node) {
    const presetWidget =
        findWidget(node, "预设");

    if (!presetWidget) {
        return;
    }

    const requestId =
        beginRequest(node);

    try {
        const currentPreset =
            getWidgetValue(presetWidget);

        const presets =
            await getPresets();

        if (
            !isCurrentRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        setPresetValues(
            presetWidget,
            presets
        );

        if (presets.includes(currentPreset)) {
            presetWidget.value = currentPreset;
        }

        redrawNode(node);

    } catch (error) {
        console.error(
            "刷新增强文本预设列表失败：",
            error
        );
    }
}


async function loadPresetContent(node) {
    const presetWidget =
        findWidget(node, "预设");

    const editWidget =
        findWidget(node, "临时编辑文本");

    if (
        !presetWidget ||
        !editWidget
    ) {
        return;
    }

    const requestId =
        beginRequest(node);

    try {
        const text =
            await getContent(
                getWidgetValue(presetWidget)
            );

        if (
            !isCurrentRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        setWidgetValue(
            editWidget,
            text
        );

        redrawNode(node);

    } catch (error) {
        console.error(
            "读取增强预设内容失败：",
            error
        );
    }
}


async function refreshNode(
    node,
    loadContent = false
) {
    if (!node) {
        return;
    }

    await refreshPresetList(node);

    /*
     * 新建节点时加载预设内容。
     * 加载已有工作流时不覆盖已经保存的临时编辑文本。
     */
    if (loadContent) {
        await loadPresetContent(node);
    }
}


function scheduleRefresh(
    node,
    delay = 150,
    loadContent = false
) {
    if (!node) {
        return;
    }

    if (node.__enhancedPresetRefreshTimer) {
        clearTimeout(
            node.__enhancedPresetRefreshTimer
        );
    }

    node.__enhancedPresetRefreshTimer =
        setTimeout(
            function () {
                node.__enhancedPresetRefreshTimer =
                    null;

                refreshNode(
                    node,
                    loadContent
                );
            },
            delay
        );
}


async function onPresetChanged(node) {
    /*
     * 切换预设时，将对应 TXT 内容加载到临时编辑框。
     */
    await loadPresetContent(node);
}


function setupNode(node) {
    if (
        !node ||
        node.__enhancedPresetSetupDone
    ) {
        return;
    }

    node.__enhancedPresetSetupDone = true;

    const presetWidget =
        findWidget(node, "预设");

    wrapWidgetCallback(
        presetWidget,
        async function () {
            await onPresetChanged(node);
        }
    );

    /*
     * 新建节点时加载默认预设内容。
     */
    scheduleRefresh(
        node,
        150,
        true
    );
}


app.registerExtension({
    name: EXTENSION_NAME,

    async beforeRegisterNodeDef(
        nodeType,
        nodeData
    ) {
        if (
            !nodeData ||
            nodeData.name !== NODE_TYPE
        ) {
            return;
        }

        const oldOnNodeCreated =
            nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated =
            function () {
                const result =
                    oldOnNodeCreated
                        ? oldOnNodeCreated.apply(
                            this,
                            arguments
                        )
                        : undefined;

                setupNode(this);

                return result;
            };

        const oldOnConfigure =
            nodeType.prototype.onConfigure;

        nodeType.prototype.onConfigure =
            function () {
                const result =
                    oldOnConfigure
                        ? oldOnConfigure.apply(
                            this,
                            arguments
                        )
                        : undefined;

                setupNode(this);

                /*
                 * 加载工作流时只刷新预设列表，
                 * 不覆盖已经保存的临时编辑文本。
                 */
                scheduleRefresh(
                    this,
                    250,
                    false
                );

                return result;
            };
    }
});

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";


const EXTENSION_NAME =
    "Comfy.TextPresetSelector";

const NODE_TYPE =
    "TextPresetSelector";

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


function setWidgetValues(widget, values) {
    if (!widget) {
        return;
    }

    if (!Array.isArray(values) || values.length === 0) {
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


async function getPresets() {
    const response =
        await api.fetchApi(
            `${ROUTE}/presets`
        );

    if (!response.ok) {
        throw new Error(
            `${response.status} ${response.statusText}`
        );
    }

    const data =
        await response.json();

    if (
        !data ||
        !Array.isArray(data.presets)
    ) {
        return [];
    }

    return data.presets;
}


function beginRequest(node) {
    if (!node) {
        return 0;
    }

    node.__textPresetRequestId =
        Number(
            node.__textPresetRequestId || 0
        ) + 1;

    return node.__textPresetRequestId;
}


function isCurrentRequest(node, requestId) {
    return (
        node &&
        Number(
            node.__textPresetRequestId || 0
        ) === requestId
    );
}


async function refreshNode(node) {
    if (!node) {
        return;
    }

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

        setWidgetValues(
            presetWidget,
            presets
        );

        if (presets.includes(currentPreset)) {
            presetWidget.value = currentPreset;
        }

        redrawNode(node);

    } catch (error) {
        console.error(
            "刷新文本预设列表失败：",
            error
        );
    }
}


function wrapWidgetCallback(widget, callback) {
    if (!widget) {
        return;
    }

    if (widget.__textPresetCallbackWrapped) {
        return;
    }

    widget.__textPresetCallbackWrapped = true;

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
                    "处理预设切换失败：",
                    error
                );
            }
        };
}


function scheduleRefresh(node, delay = 150) {
    if (!node) {
        return;
    }

    if (node.__textPresetRefreshTimer) {
        clearTimeout(
            node.__textPresetRefreshTimer
        );
    }

    node.__textPresetRefreshTimer =
        setTimeout(
            function () {
                node.__textPresetRefreshTimer = null;

                refreshNode(node);
            },
            delay
        );
}


function setupNode(node) {
    if (!node || node.__textPresetSetupDone) {
        return;
    }

    node.__textPresetSetupDone = true;

    const presetWidget =
        findWidget(node, "预设");

    /*
     * 切换预设时刷新预设列表。
     * 当前节点的实际文本由 Python 节点在执行时读取。
     */
    wrapWidgetCallback(
        presetWidget,
        async function () {
            await refreshNode(node);
        }
    );

    /*
     * 新建节点时自动刷新。
     */
    scheduleRefresh(
        node,
        150
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
                 * 加载工作流时自动刷新预设列表。
                 */
                scheduleRefresh(
                    this,
                    250
                );

                return result;
            };
    }
});

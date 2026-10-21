import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";


const EXTENSION_NAME =
    "Comfy.SimpleTextSelector";

const NODE_TYPE =
    "SimpleTextSelector";

const ROUTE_PREFIX =
    "/editable_text_selector";

const NO_TXT_FILE =
    "无TXT文件";

const NO_PRESET_TITLE =
    "无预设标题";

const SELECTION_PROPERTY =
    "simpleTextSelectorSelection";


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


function safeArray(value) {
    return Array.isArray(value) ? value : [];
}


function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function getSavedSelection(node) {
    if (!node || !isObject(node.properties)) {
        return {
            file: "",
            title: ""
        };
    }

    const selection =
        node.properties[SELECTION_PROPERTY];

    if (!isObject(selection)) {
        return {
            file: "",
            title: ""
        };
    }

    return {
        file:
            typeof selection.file === "string"
                ? selection.file
                : "",

        title:
            typeof selection.title === "string"
                ? selection.title
                : ""
    };
}


function saveSelection(node, file, title) {
    if (!node) {
        return;
    }

    if (!isObject(node.properties)) {
        node.properties = {};
    }

    const oldSelection =
        getSavedSelection(node);

    const newSelection = {
        file:
            typeof file === "string"
                ? file
                : "",

        title:
            typeof title === "string"
                ? title
                : ""
    };

    node.properties[SELECTION_PROPERTY] =
        newSelection;

    if (
        oldSelection.file !== newSelection.file ||
        oldSelection.title !== newSelection.title
    ) {
        try {
            if (
                node.graph &&
                typeof node.graph.change === "function"
            ) {
                node.graph.change();
            }
        } catch (error) {
            console.warn(
                "通知工作流变化失败：",
                error
            );
        }
    }
}


function setComboValues(widget, values, preferredValue = "") {
    if (!widget) {
        return "";
    }

    values = safeArray(values).filter(
        value => typeof value === "string"
    );

    if (values.length === 0) {
        values = [NO_PRESET_TITLE];
    }

    if (!isObject(widget.options)) {
        widget.options = {};
    }

    widget.options.values = values;

    const currentValue =
        getWidgetValue(widget);

    let selectedValue = "";

    if (
        preferredValue &&
        values.includes(preferredValue)
    ) {
        selectedValue = preferredValue;
    } else if (
        values.includes(currentValue)
    ) {
        selectedValue = currentValue;
    } else {
        selectedValue = values[0];
    }

    widget.value = selectedValue;

    return selectedValue;
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


async function getFiles() {
    const data =
        await requestJson(
            `${ROUTE_PREFIX}/files`
        );

    return safeArray(data.files);
}


async function getTitles(file) {
    const url =
        `${ROUTE_PREFIX}/titles` +
        `?file=${encodeURIComponent(file)}`;

    const data =
        await requestJson(url);

    return safeArray(data.titles);
}


function redrawNode(node) {
    if (
        node &&
        typeof node.setDirtyCanvas === "function"
    ) {
        node.setDirtyCanvas(true, true);
    }
}


function beginRequest(node) {
    node.__simpleSelectorRequestId =
        Number(node.__simpleSelectorRequestId || 0) + 1;

    return node.__simpleSelectorRequestId;
}


function isCurrentRequest(node, requestId) {
    return (
        node &&
        Number(node.__simpleSelectorRequestId || 0) ===
            requestId
    );
}


async function refreshNode(node) {
    if (!node) {
        return;
    }

    const fileWidget =
        findWidget(node, "TXT文件");

    const titleWidget =
        findWidget(node, "预设标题");

    if (!fileWidget || !titleWidget) {
        return;
    }

    const requestId =
        beginRequest(node);

    try {
        const files =
            await getFiles();

        if (!isCurrentRequest(node, requestId)) {
            return;
        }

        const savedSelection =
            getSavedSelection(node);

        const selectedFile =
            setComboValues(
                fileWidget,
                files,
                savedSelection.file ||
                getWidgetValue(fileWidget)
            );

        const titles =
            await getTitles(selectedFile);

        if (!isCurrentRequest(node, requestId)) {
            return;
        }

        const selectedTitle =
            setComboValues(
                titleWidget,
                titles,
                selectedFile === savedSelection.file
                    ? savedSelection.title
                    : getWidgetValue(titleWidget)
            );

        saveSelection(
            node,
            selectedFile,
            selectedTitle
        );

        redrawNode(node);

    } catch (error) {
        console.error(
            "刷新简易文本预设选择器失败：",
            error
        );
    }
}


async function onFileChanged(node) {
    if (!node) {
        return;
    }

    const fileWidget =
        findWidget(node, "TXT文件");

    const titleWidget =
        findWidget(node, "预设标题");

    if (!fileWidget || !titleWidget) {
        return;
    }

    const requestId =
        beginRequest(node);

    const file =
        getWidgetValue(fileWidget);

    try {
        const titles =
            await getTitles(file);

        if (!isCurrentRequest(node, requestId)) {
            return;
        }

        const title =
            setComboValues(
                titleWidget,
                titles
            );

        saveSelection(
            node,
            file,
            title
        );

        redrawNode(node);

    } catch (error) {
        console.error(
            "读取 TXT 文件标题失败：",
            error
        );
    }
}


function onTitleChanged(node) {
    const fileWidget =
        findWidget(node, "TXT文件");

    const titleWidget =
        findWidget(node, "预设标题");

    if (!fileWidget || !titleWidget) {
        return;
    }

    saveSelection(
        node,
        getWidgetValue(fileWidget),
        getWidgetValue(titleWidget)
    );
}


function wrapWidgetCallback(widget, callback) {
    if (!widget || widget.__simpleSelectorWrapped) {
        return;
    }

    widget.__simpleSelectorWrapped = true;

    const oldCallback =
        widget.callback;

    widget.callback = async function (...args) {
        if (typeof oldCallback === "function") {
            oldCallback.apply(this, args);
        }

        await callback(...args);
    };
}


function setupNode(node) {
    if (!node || node.__simpleSelectorSetupDone) {
        return;
    }

    node.__simpleSelectorSetupDone = true;

    const fileWidget =
        findWidget(node, "TXT文件");

    const titleWidget =
        findWidget(node, "预设标题");

    wrapWidgetCallback(
        fileWidget,
        async function () {
            await onFileChanged(node);
        }
    );

    wrapWidgetCallback(
        titleWidget,
        async function () {
            onTitleChanged(node);
        }
    );

    setTimeout(
        function () {
            refreshNode(node);
        },
        150
    );
}


app.registerExtension({
    name: EXTENSION_NAME,

    async beforeRegisterNodeDef(nodeType, nodeData) {
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

                setTimeout(
                    () => refreshNode(this),
                    250
                );

                return result;
            };
    }
});

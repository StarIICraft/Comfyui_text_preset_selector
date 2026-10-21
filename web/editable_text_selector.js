import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";


/*
 * ============================================================
 * 基础配置
 * ============================================================
 */

const EXTENSION_NAME =
    "Comfy.EditableTextSelector";

const NODE_TYPE =
    "EditableTextSelector";

const ROUTE_PREFIX =
    "/editable_text_selector";

const NO_TXT_FILE =
    "无TXT文件";

const NO_PRESET_TITLE =
    "无预设标题";


/*
 * 保存到当前节点 properties 中。
 *
 * 不使用 localStorage。
 *
 * node.properties 会被 ComfyUI 保存到工作流 JSON，
 * 因此每个节点、每个工作流都拥有独立选择。
 */
const SELECTION_PROPERTY =
    "editableTextSelectorSelection";


/*
 * ============================================================
 * 通用工具
 * ============================================================
 */

function safeArray(value) {
    return Array.isArray(value)
        ? value
        : [];
}


function isObject(value) {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}


function findWidget(node, name) {
    if (
        !node ||
        !Array.isArray(node.widgets)
    ) {
        return null;
    }

    return (
        node.widgets.find(
            widget =>
                widget &&
                widget.name === name
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
        value === undefined ||
        value === null
            ? ""
            : value;
}


function redrawNode(node) {
    if (!node) {
        return;
    }

    try {
        if (
            typeof node.setDirtyCanvas ===
            "function"
        ) {
            node.setDirtyCanvas(
                true,
                true
            );
        }
    } catch (error) {
        console.warn(
            "刷新节点画布失败：",
            error
        );
    }
}


function resizeNode(node) {
    if (!node) {
        return;
    }

    try {
        if (
            typeof node.computeSize !==
            "function" ||
            typeof node.setSize !==
            "function"
        ) {
            return;
        }

        const computedSize =
            node.computeSize();

        if (
            !Array.isArray(computedSize) ||
            computedSize.length < 2
        ) {
            return;
        }

        const currentWidth =
            Array.isArray(node.size) &&
            Number(node.size[0]) > 0
                ? node.size[0]
                : computedSize[0];

        node.setSize([
            currentWidth,
            computedSize[1]
        ]);

    } catch (error) {
        console.warn(
            "重新计算节点尺寸失败：",
            error
        );
    }
}


function markGraphChanged(node) {
    try {
        if (
            node &&
            node.graph &&
            typeof node.graph.change ===
            "function"
        ) {
            node.graph.change();
        }
    } catch (error) {
        console.warn(
            "通知工作流变化失败：",
            error
        );
    }

    redrawNode(node);
}


/*
 * ============================================================
 * 清理旧版动态控件
 * ============================================================
 *
 * 旧版本节点可能已经动态添加了：
 *
 * - 状态
 * - 保存当前预设到TXT
 * - 新增预设
 * - 刷新当前 TXT
 *
 * 当前版本只保留：
 *
 * - TXT文件
 * - 预设标题
 * - 文本内容
 */

function removeRemovedWidgets(node) {
    if (
        !node ||
        !Array.isArray(node.widgets)
    ) {
        return;
    }

    const removedWidgetNames =
        new Set([
            "状态",
            "保存当前预设到TXT",
            "新增预设",
            "刷新当前 TXT"
        ]);

    const remainingWidgets = [];

    for (const widget of node.widgets) {
        if (
            widget &&
            removedWidgetNames.has(
                widget.name
            )
        ) {
            try {
                if (
                    typeof widget.onRemove ===
                    "function"
                ) {
                    widget.onRemove();
                }
            } catch (error) {
                console.warn(
                    "清理旧控件失败：",
                    error
                );
            }

            continue;
        }

        remainingWidgets.push(widget);
    }

    node.widgets =
        remainingWidgets;

    resizeNode(node);
    redrawNode(node);
}


/*
 * ============================================================
 * 节点级选择保存
 * ============================================================
 */

function loadNodeSelection(node) {
    if (
        !node ||
        !isObject(node.properties)
    ) {
        return {
            file: "",
            title: ""
        };
    }

    const data =
        node.properties[
            SELECTION_PROPERTY
        ];

    if (!isObject(data)) {
        return {
            file: "",
            title: ""
        };
    }

    return {
        file:
            typeof data.file ===
            "string"
                ? data.file
                : "",

        title:
            typeof data.title ===
            "string"
                ? data.title
                : ""
    };
}


function saveNodeSelection(
    node,
    file,
    title,
    notifyWorkflow = true
) {
    if (!node) {
        return;
    }

    if (
        !isObject(node.properties)
    ) {
        node.properties = {};
    }

    const oldSelection =
        loadNodeSelection(node);

    const newSelection = {
        file:
            typeof file ===
            "string"
                ? file
                : "",

        title:
            typeof title ===
            "string"
                ? title
                : ""
    };

    const changed =
        oldSelection.file !==
            newSelection.file ||
        oldSelection.title !==
            newSelection.title;

    node.properties[
        SELECTION_PROPERTY
    ] = newSelection;

    if (
        changed &&
        notifyWorkflow
    ) {
        markGraphChanged(node);
    }
}


/*
 * ============================================================
 * 下拉框处理
 * ============================================================
 */

function setComboValues(
    widget,
    values,
    preferredValue = ""
) {
    if (!widget) {
        return "";
    }

    values =
        safeArray(values).filter(
            value =>
                typeof value ===
                "string"
        );

    if (values.length === 0) {
        values = [
            NO_PRESET_TITLE
        ];
    }

    if (
        !isObject(widget.options)
    ) {
        widget.options = {};
    }

    /*
     * Python 后端已经返回带序号标题，例如：
     *
     * 01-Qwen打光
     * 02-Klein打光
     *
     * 前端不再次编号。
     */
    widget.options.values =
        values;

    const currentValue =
        getWidgetValue(widget);

    let selectedValue = "";

    if (
        typeof preferredValue ===
            "string" &&
        values.includes(
            preferredValue
        )
    ) {
        selectedValue =
            preferredValue;

    } else if (
        values.includes(
            currentValue
        )
    ) {
        selectedValue =
            currentValue;

    } else {
        selectedValue =
            values[0];
    }

    widget.value =
        selectedValue;

    return selectedValue;
}


/*
 * ============================================================
 * HTTP 请求
 * ============================================================
 */

async function requestJson(
    url,
    options = {}
) {
    const response =
        await api.fetchApi(
            url,
            options
        );

    if (!response.ok) {
        let errorText = "";

        try {
            errorText =
                await response.text();
        } catch (error) {
            errorText = "";
        }

        throw new Error(
            `${response.status} ${errorText}`
        );
    }

    return await response.json();
}


async function getFiles() {
    const data =
        await requestJson(
            `${ROUTE_PREFIX}/files`
        );

    return safeArray(
        data.files
    );
}


async function getTitles(file) {
    const url =
        `${ROUTE_PREFIX}/titles` +
        `?file=${encodeURIComponent(
            file
        )}`;

    const data =
        await requestJson(url);

    return safeArray(
        data.titles
    );
}


async function getContent(
    file,
    title
) {
    const url =
        `${ROUTE_PREFIX}/content` +
        `?file=${encodeURIComponent(
            file
        )}` +
        `&title=${encodeURIComponent(
            title
        )}`;

    const data =
        await requestJson(url);

    if (
        data &&
        typeof data.text ===
        "string"
    ) {
        return data.text;
    }

    return "";
}


/*
 * ============================================================
 * 请求序号
 * ============================================================
 *
 * 防止快速切换时旧请求覆盖新请求。
 */

function beginNodeRequest(node) {
    if (!node) {
        return 0;
    }

    node.__editableRequestId =
        Number(
            node.__editableRequestId || 0
        ) + 1;

    return node.__editableRequestId;
}


function isCurrentNodeRequest(
    node,
    requestId
) {
    return (
        node &&
        Number(
            node.__editableRequestId || 0
        ) === requestId
    );
}


/*
 * ============================================================
 * 自动刷新节点
 * ============================================================
 */

async function refreshNode(
    node,
    preferredFile = "",
    preferredTitle = "",
    notifyWorkflow = false
) {
    if (!node) {
        return;
    }

    const fileWidget =
        findWidget(
            node,
            "TXT文件"
        );

    const titleWidget =
        findWidget(
            node,
            "预设标题"
        );

    const textWidget =
        findWidget(
            node,
            "文本内容"
        );

    if (
        !fileWidget ||
        !titleWidget ||
        !textWidget
    ) {
        return;
    }

    const requestId =
        beginNodeRequest(node);

    const savedSelection =
        loadNodeSelection(node);

    try {
        const files =
            await getFiles();

        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        /*
         * 文件选择优先级：
         *
         * 1. 显式传入的文件
         * 2. 节点保存的文件
         * 3. 当前控件已有值
         * 4. 后端返回的第一个文件
         */
        const currentFile =
            getWidgetValue(
                fileWidget
            );

        const wantedFile =
            preferredFile ||
            savedSelection.file ||
            currentFile;

        const selectedFile =
            setComboValues(
                fileWidget,
                files,
                wantedFile
            );

        const titles =
            await getTitles(
                selectedFile
            );

        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        /*
         * 只有当前文件与保存的文件相同，
         * 才恢复之前保存的标题。
         */
        const currentTitle =
            getWidgetValue(
                titleWidget
            );

        const savedTitleForCurrentFile =
            selectedFile ===
            savedSelection.file
                ? savedSelection.title
                : "";

        const wantedTitle =
            preferredTitle ||
            savedTitleForCurrentFile ||
            currentTitle;

        const selectedTitle =
            setComboValues(
                titleWidget,
                titles,
                wantedTitle
            );

        const text =
            await getContent(
                selectedFile,
                selectedTitle
            );

        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        setWidgetValue(
            textWidget,
            text
        );

        /*
         * 初始化和加载工作流时保存属性，
         * 但默认不标记工作流为修改状态。
         */
        saveNodeSelection(
            node,
            selectedFile,
            selectedTitle,
            notifyWorkflow
        );

        redrawNode(node);

    } catch (error) {
        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        console.error(
            "刷新节点失败：",
            error
        );
    }
}


/*
 * ============================================================
 * TXT 文件切换
 * ============================================================
 */

async function onFileChanged(node) {
    if (!node) {
        return;
    }

    const fileWidget =
        findWidget(
            node,
            "TXT文件"
        );

    const titleWidget =
        findWidget(
            node,
            "预设标题"
        );

    const textWidget =
        findWidget(
            node,
            "文本内容"
        );

    if (
        !fileWidget ||
        !titleWidget ||
        !textWidget
    ) {
        return;
    }

    const requestId =
        beginNodeRequest(node);

    const file =
        getWidgetValue(
            fileWidget
        );

    try {
        const titles =
            await getTitles(
                file
            );

        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        const selectedTitle =
            setComboValues(
                titleWidget,
                titles
            );

        const text =
            await getContent(
                file,
                selectedTitle
            );

        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        setWidgetValue(
            textWidget,
            text
        );

        /*
         * 用户主动切换 TXT 文件，
         * 保存当前节点自己的选择。
         */
        saveNodeSelection(
            node,
            file,
            selectedTitle,
            true
        );

        redrawNode(node);

    } catch (error) {
        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        console.error(
            "读取 TXT 文件失败：",
            error
        );
    }
}


/*
 * ============================================================
 * 预设标题切换
 * ============================================================
 */

async function onTitleChanged(node) {
    if (!node) {
        return;
    }

    const fileWidget =
        findWidget(
            node,
            "TXT文件"
        );

    const titleWidget =
        findWidget(
            node,
            "预设标题"
        );

    const textWidget =
        findWidget(
            node,
            "文本内容"
        );

    if (
        !fileWidget ||
        !titleWidget ||
        !textWidget
    ) {
        return;
    }

    const requestId =
        beginNodeRequest(node);

    const file =
        getWidgetValue(
            fileWidget
        );

    const title =
        getWidgetValue(
            titleWidget
        );

    try {
        const text =
            await getContent(
                file,
                title
            );

        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        setWidgetValue(
            textWidget,
            text
        );

        /*
         * 用户主动切换标题，
         * 保存当前节点自己的选择。
         */
        saveNodeSelection(
            node,
            file,
            title,
            true
        );

        redrawNode(node);

    } catch (error) {
        if (
            !isCurrentNodeRequest(
                node,
                requestId
            )
        ) {
            return;
        }

        console.error(
            "读取预设失败：",
            error
        );
    }
}


/*
 * ============================================================
 * 下拉框回调包装
 * ============================================================
 */

function wrapWidgetCallback(
    widget,
    callback
) {
    if (!widget) {
        return;
    }

    if (
        widget.__editableSelectorWrapped
    ) {
        return;
    }

    widget.__editableSelectorWrapped =
        true;

    const oldCallback =
        widget.callback;

    widget.callback =
        async function (...args) {
            /*
             * 先执行 ComfyUI 原有回调。
             */
            if (
                typeof oldCallback ===
                "function"
            ) {
                try {
                    oldCallback.apply(
                        this,
                        args
                    );
                } catch (error) {
                    console.warn(
                        "原有下拉框回调执行失败：",
                        error
                    );
                }
            }

            /*
             * 再执行插件回调。
             */
            try {
                await callback(
                    ...args
                );
            } catch (error) {
                console.error(
                    "插件下拉框回调执行失败：",
                    error
                );
            }
        };
}


/*
 * ============================================================
 * 延迟初始化刷新
 * ============================================================
 */

function scheduleInitialRefresh(
    node,
    delay = 150
) {
    if (!node) {
        return;
    }

    if (
        node.__editableRefreshTimer
    ) {
        clearTimeout(
            node.__editableRefreshTimer
        );
    }

    node.__editableRefreshTimer =
        setTimeout(
            function () {
                node.__editableRefreshTimer =
                    null;

                refreshNode(
                    node,
                    "",
                    "",
                    false
                );
            },
            delay
        );
}


/*
 * ============================================================
 * 节点初始化
 * ============================================================
 */

function setupNode(node) {
    if (
        !node ||
        node.__editableSetupDone
    ) {
        return;
    }

    node.__editableSetupDone =
        true;

    /*
     * 清理旧版本动态添加的：
     *
     * - 状态
     * - 保存当前预设到TXT
     * - 新增预设
     * - 刷新当前 TXT
     */
    removeRemovedWidgets(node);

    const fileWidget =
        findWidget(
            node,
            "TXT文件"
        );

    const titleWidget =
        findWidget(
            node,
            "预设标题"
        );

    wrapWidgetCallback(
        fileWidget,
        async function () {
            await onFileChanged(
                node
            );
        }
    );

    wrapWidgetCallback(
        titleWidget,
        async function () {
            await onTitleChanged(
                node
            );
        }
    );

    /*
     * 创建节点或加载工作流后自动刷新。
     */
    scheduleInitialRefresh(
        node,
        150
    );
}


/*
 * ============================================================
 * ComfyUI 扩展注册
 * ============================================================
 */

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

                /*
                 * onConfigure 时，ComfyUI 通常已经恢复：
                 *
                 * - node.properties
                 * - TXT文件
                 * - 预设标题
                 * - 文本内容
                 *
                 * 延迟刷新，确保读取到工作流保存的选择。
                 */
                setupNode(this);

                scheduleInitialRefresh(
                    this,
                    250
                );

                return result;
            };
    }
});

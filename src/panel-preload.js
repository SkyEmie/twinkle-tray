const { ipcRenderer: ipc } = require('electron');

// Send logs to main thread
const log = console.log
const con = {
    log: console.log,
    warn: console.warn,
    error: console.error
}
console.log = (...e) => { e.forEach((c) => { ipc.send('log', c); con.log(c) }) }
console.error = (...e) => { e.forEach((c) => { ipc.send('log', c); con.error(c) }) }

window.winPosition = [0, 0]

function getArgumentVars() {
    try {
        const jsVarsString = process.argv.find(arg => arg.indexOf("jsVars") === 0)
        const jsVars = JSON.parse(atob(jsVarsString.substring(6)))
        return jsVars
    } catch(e) {
        return {}
    }
}

// Show or hide the brightness panel
function setPanelVisibility(visible) {
    window.showPanel = visible

    if (visible) {
        window.dispatchEvent(new CustomEvent('sleepUpdated', {
            detail: false
        }))
        if (!settings.useNativeAnimation) {
            setTimeout(() => {
                if (window.showPanel) {
                    ipc.send('show-acrylic')
                }
            }, 500)
        }
        window.updateMica?.()
    } else {
        window.document.body.dataset["acrylicShow"] = false
        if (window.isAcrylic) {
            window.isAcrylic = false
        }
        window.dispatchEvent(new CustomEvent('sleepUpdated', {
            detail: true
        }))
    }


    // Update #root value
    if (window.isAcrylic) {
        window.isAcrylic = false
    }

    window.document.getElementById("root").dataset["visible"] = window.showPanel
    window.sleep = !visible

    // Blur all inputs to fix visual bugs
    if ("activeElement" in document)
        document.activeElement.blur();
}

function requestMonitors() {
    ipc.send('request-monitors')
}

function requestAccent() {
    ipc.send('request-colors')
}

// Send brightness update request. Params are the monitor's index in the array and requested brightness level.
function updateBrightness(index, level) {
    if (!window.showPanel) return false;
    ipc.send('update-brightness', {
        index,
        level
    })
}

function detectSunValley() {
    try {
        // Detect new Fluent Icons (Windows build 21327+)
        if(window.settings.enableSunValley && document.fonts.check("12px Segoe Fluent Icons")) {
            window.document.getElementById("root").dataset.fluentIcons = true
        } else {
            window.document.getElementById("root").dataset.fluentIcons = false
        }
        // Detect new system font (Windows build 21376+)
        if(window.settings.enableSunValley && document.fonts.check("12px Segoe UI Variable Text")) {
            window.document.getElementById("root").dataset.segoeUIVariable = true
        } else {
            window.document.getElementById("root").dataset.segoeUIVariable = false
        }
        // Detect Windows 11
        window.document.body.dataset.isWin11 = (window.settings.isWin11 ? true : false)
    } catch(e) {
        console.log("Couldn't test for Sun Valley", e)
    }
}

function openSettings() {
    setPanelVisibility(false)
    ipc.send('blur-panel')
    setTimeout(() => {
        ipc.send("open-settings")
    }, 111)
}

function sendSettings(newSettings) {
    ipc.send('send-settings', newSettings)
}

function requestSettings() {
    ipc.send('request-settings')
}

function sendHeight(height) {
    ipc.send('panel-height', height)
}

function pauseMonitorUpdates() {
    ipc.send('pause-updates')
}

function panelAnimationDone() {
    if (showPanel === false) {
        ipc.send('panel-hidden')
        window.sleep = true
        window.document.body.dataset["acrylicShow"] = false
        window.document.getElementById("root").dataset["sleep"] = true
        window.dispatchEvent(new CustomEvent('sleepUpdated', {
            detail: true
        }))
    } else {

    }
}

function shouldSendHeightUpdate() {
    setTimeout(() => {
        try {
            const height = window.document.getElementById("panel").offsetHeight
            window.sendHeight(height)
        } catch(e) {
            console.error(e)
        }
    }, 99)
}

function turnOffDisplays() {
    setPanelVisibility(false)
    ipc.send('blur-panel')
    setTimeout(() => {
        ipc.send('sleep-displays')
    }, 111)
}

function installUpdate() {
    ipc.send('get-update', window.latestVersion)
    ipc.send('clear-update', window.latestVersion.version)
}

function dismissUpdate() {
    ipc.send('ignore-update', window.latestVersion.version)
}

// Tray icon clicked
ipc.on('tray-clicked', () => {
    window.document.getElementById("root").dataset["sleep"] = false
    setPanelVisibility(true)
})

ipc.on("panelBlur", (e) => {
    setPanelVisibility(false)
    setTimeout(() => global.gc(), 2000)
})

ipc.on("panel-unsleep", () => {
    window.dispatchEvent(new CustomEvent('sleepUpdated', {
        detail: false
    }))
})

// Monitor info updated
ipc.on("monitors-updated", (e, monitors) => {
    if (JSON.stringify(window.allMonitors) === JSON.stringify(monitors)) return false;
    window.allMonitors = monitors
    window.lastUpdate = Date.now()
    window.dispatchEvent(new CustomEvent('monitorsUpdated', {
        detail: monitors
    }))
})
ipc.on("force-refresh-monitors", (e) => {
    window.allMonitors = {}
    ipc.send('full-refresh', true)
})

// Accent colors recieved
ipc.on('update-colors', (event, data) => {
    window.document.body.style.setProperty("--system-accent-color", data.accent.hex)
    window.document.body.style.setProperty("--system-accent-lighter", data.lighter)
    window.document.body.style.setProperty("--system-accent-light", data.light)
    window.document.body.style.setProperty("--system-accent-medium", data.medium)
    window.document.body.style.setProperty("--system-accent-medium-dark", data.mediumDark)
    window.document.body.style.setProperty("--system-accent-transparent", data.transparent)
    window.document.body.style.setProperty("--system-accent-dark", data.dark)

    window.document.body.style.setProperty("--system-accent-dark1", data.accentDark1.hex)
    window.document.body.style.setProperty("--system-accent-dark2", data.accentDark2.hex)
    window.document.body.style.setProperty("--system-accent-dark3", data.accentDark3.hex)
    window.document.body.style.setProperty("--system-accent-light1", data.accentLight1.hex)
    window.document.body.style.setProperty("--system-accent-light2", data.accentLight2.hex)
    window.document.body.style.setProperty("--system-accent-light3", data.accentLight3.hex)
})

// Taskbar position recieved
ipc.on('taskbar', (event, taskbar) => {
    window.document.getElementById("root").dataset["position"] = taskbar.position
})

// Set display mode (overlay or normal)
ipc.on('display-mode', (event, mode) => {
    window.document.getElementById("root").dataset["mode"] = mode
    if(mode === "overlay") {
        document.body.classList.add("ignoreWin11")
    } else {
        document.body.classList.remove("ignoreWin11")
    }
    shouldSendHeightUpdate()
})

ipc.on('request-height', () => {
    ipc.send('panel-height', window.document.getElementById("panel").offsetHeight)
})

// Settings recieved
ipc.on('settings-updated', (event, settings) => {
    if (settings.isDev == false) {
        console.log = () => { }
    } else {
        console.log = log
        console.log = (...e) => { e.forEach((c) => ipc.send('log', c)) }
    }
    window.settings = settings
    detectSunValley()
    window.dispatchEvent(new CustomEvent('settingsUpdated', {
        detail: settings
    }))
})

// Localization recieved
ipc.on('localization-updated', (event, localization) => {
    window.dispatchEvent(new CustomEvent('localizationUpdated', {
        detail: localization
    }))
})

// New app update recieved
ipc.on('latest-version', (event, version) => {
    window.latestVersion = version
    window.dispatchEvent(new CustomEvent('updateUpdated', {
        detail: version
    }))
})

// Update download progress
ipc.on('updateProgress', (event, progress) => {
    window.dispatchEvent(new CustomEvent('updateProgress', {
        detail: {
            progress
        }
    }))
})

// Updated window position variable
ipc.on('panel-position', (event, pos) => {
    winPosition = pos
    window.updateMica?.()
})

// User personalization settings recieved
ipc.on('theme-settings', (event, theme) => {
    try {
        window.theme = (theme.SystemUsesLightTheme == 0 ? "dark" : "light")
        window.document.body.dataset["systemTheme"] = (theme.SystemUsesLightTheme == 0 ? "dark" : "light")
        window.document.body.dataset["transparent"] = (theme.EnableTransparency == 0 || theme.UseAcrylic == 0 ? "false" : "true")
        window.document.body.dataset["acrylic"] = (theme.UseAcrylic == 0 || settings?.isWin11 ? "false" : "true")
        window.document.body.dataset["coloredTaskbar"] = (theme.ColorPrevalence == 0 ? "false" : "true")
        window.document.body.dataset["useNativeAnimation"] = (settings.useNativeAnimation == false ? "false" : "true")
        isTransparent = theme.EnableTransparency
    } catch (e) {
        window.document.body.dataset["systemTheme"] = "default"
        window.document.body.dataset["transparent"] = "false"
        window.document.body.dataset["acrylic"] = "false"
        window.document.body.dataset["coloredTaskbar"] = "false"
        window.document.body.dataset["useNativeAnimation"] = "false"
    }
})

// Play non-acrylic animation
ipc.on('playPanelAnimation', () => {
    window.document.getElementById("root").dataset["visible"] = true
})

// Play non-acrylic animation
ipc.on('closePanelAnimation', () => {
    window.document.getElementById("root").dataset["visible"] = false
})

ipc.on('set-acrylic-show', () => {
    window.document.body.dataset["acrylicShow"] = true
})

window.micaState = {
    visibility: "hidden",
    src: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D"
}
ipc.on('mica-wallpaper', (event, wallpaper) => {
    const mica = document.querySelector("#mica .displays")
    const micaIMG = document.querySelector("#mica img")
    if(!mica) return false;
    if(!wallpaper) {
        mica.style.visibility = "hidden"
        window.micaState.visibility = "hidden"
    } else {
        window.micaState.visibility = "visible"
        window.micaState.src = wallpaper.path
        mica.style.visibility = "visible"
        micaIMG.src = wallpaper.path
        micaIMG.width = wallpaper.size?.width
        micaIMG.height = wallpaper.size?.height
    }
})

// Request startup data
window.addEventListener('DOMContentLoaded', () => {
    requestSettings()
    //requestMonitors()
    requestAccent()
})

// VCP code handling
const vcpMap = {
    0x10: "luminance",
    0x13: "brightness",
    0x12: "contrast",
    0xD6: "powerState",
    0x62: "volume"
}
window.addEventListener("setVCP", e => {
    if(!window.showPanel) return false;
    const { monitor, code, value } = e.detail
    ipc.send("set-vcp", { monitor, code, value })
    if(vcpMap[vcp] && monitor.features[vcpMap[vcp]]) {
        monitor.features[vcpMap[vcp]][0] = level
      }
})

window.ipc = ipc
window.updateBrightness = updateBrightness
window.requestMonitors = requestMonitors
window.openSettings = openSettings
window.sendSettings = sendSettings
window.requestSettings = requestSettings
window.pauseMonitorUpdates = pauseMonitorUpdates
window.installUpdate = installUpdate
window.dismissUpdate = dismissUpdate
window.sendHeight = sendHeight
window.panelAnimationDone = panelAnimationDone
window.setPanelVisibility = setPanelVisibility
window.turnOffDisplays = turnOffDisplays
window.allMonitors = []
window.lastUpdate = Date.now()
window.showPanel = false
window.isAcrylic = false
window.theme = "dark"
window.settings = {}
window.isAppX = (getArgumentVars().appName == "twinkle-tray-appx" ? true : false)
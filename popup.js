// --- DEVTOOLS CLEANER ---
const originalLog = console.log;

console.log = function (...args) {
    if (args.length === 1 && Array.isArray(args[0])) {
        const firstItem = args[0][0];
        if (firstItem && typeof firstItem === "object" && ("timeout" in firstItem || "handler" in firstItem)) {
            return;
        }
    }
    originalLog.apply(console, args);
};
// ------------------------

let injected = false;

// ------------------------
// TAB HELPERS
// ------------------------
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab;
}

// ------------------------
// PERMISSION CHECK + INJECTION
// ------------------------
async function checkPermissions() {
    const tab = await getActiveTab();
    if (!tab || !tab.url) return;

    const hasPermission = await chrome.permissions.contains({
        origins: [tab.url]
    });

    const warningBanner = document.getElementById("permission-warning");

    if (hasPermission) {
        warningBanner.style.display = "none";
        injectSpeedHack();
    } else {
        warningBanner.style.display = "block";
    }
}

async function injectSpeedHack() {
    if (injected) return;

    const tab = await getActiveTab();

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["speedhack.js"],
            world: "MAIN"
        });

        injected = true;
    } catch (err) {
        console.warn("Injection failed:", err);
        document.getElementById("permission-warning").style.display = "block";
    }
}

// ------------------------
// CONFIG APPLY + PERSIST
// ------------------------
async function applyConfig() {
    const tab = await getActiveTab();
    if (!tab) return;

    const speedValue = Number(document.getElementById("speed-number").value) || 1;

    const config = {
        speed: speedValue,
        cbSetIntervalChecked: document.getElementById("interval").checked,
        cbSetTimeoutChecked: document.getElementById("timeout").checked,
        cbPerformanceNowChecked: document.getElementById("performance").checked,
        cbDateNowChecked: document.getElementById("date").checked,
        cbRequestAnimationFrameChecked: document.getElementById("raf").checked
    };

    // ✅ SAVE CONFIG (fixes reset on popup close)
    await chrome.storage.local.set({ speedHackConfig: config });

    // Only try to send if injected (optional safety)
    if (!injected) return;

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (config) => {
            window.postMessage({
                command: "setSpeedConfig",
                config
            });
        },
        args: [config]
    });
}

// ------------------------
// RESTORE CONFIG ON OPEN
// ------------------------
async function restoreConfig() {
    const data = await chrome.storage.local.get("speedHackConfig");
    const config = data.speedHackConfig;
    if (!config) return;

    document.getElementById("speed-number").value = config.speed;
    document.getElementById("speed").value = config.speed;

    document.getElementById("interval").checked = config.cbSetIntervalChecked;
    document.getElementById("timeout").checked = config.cbSetTimeoutChecked;
    document.getElementById("performance").checked = config.cbPerformanceNowChecked;
    document.getElementById("date").checked = config.cbDateNowChecked;
    document.getElementById("raf").checked = config.cbRequestAnimationFrameChecked;
}

// ------------------------
// SLIDER SYNC
// ------------------------
const slider = document.getElementById("speed");
const numInput = document.getElementById("speed-number");

slider.addEventListener("input", () => {
    numInput.value = slider.value;
});

numInput.addEventListener("input", () => {
    const val = Number(numInput.value);

    if (val >= Number(slider.min) && val <= Number(slider.max)) {
        slider.value = val;
    } else if (val > Number(slider.max)) {
        slider.value = slider.max;
    }
});

// ------------------------
// AUTO APPLY ON INPUT
// ------------------------
document.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", applyConfig);
    input.addEventListener("change", applyConfig);
});

// ------------------------
// MANUAL PERMISSION BUTTON
// ------------------------
document.getElementById("request-permission-btn").addEventListener("click", async () => {
    injectSpeedHack();
});

// ------------------------
// INIT
// ------------------------
restoreConfig();
checkPermissions();

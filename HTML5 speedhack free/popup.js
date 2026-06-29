// --- DEVTOOLS CLEANER ---
// Backup the original console.log function
const originalLog = console.log;

// Override console.log globally in the page environment
console.log = function (...args) {
    // Check if the log looks like the timer array you want to block
    if (args.length === 1 && Array.isArray(args[0])) {
        const firstItem = args[0][0];
        // If the array contains objects with 'timeout' or 'handler' properties, silence it!
        if (firstItem && (typeof firstItem === 'object') && ('timeout' in firstItem || 'handler' in firstItem)) {
            return; // Do nothing, blocking the log entirely
        }
    }
    
    // Allow all other normal logs to pass through
    originalLog.apply(console, args);
};
// ------------------------

let injected = false;

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab;
}

// NEW: Validates whether the extension can run on the active tab's URL
async function checkPermissions() {
    const tab = await getActiveTab();
    if (!tab || !tab.url) return;

    // Check if we have host permissions for the active site
    const hasPermission = await chrome.permissions.contains({
        origins: [tab.url]
    });

    const warningBanner = document.getElementById("permission-warning");

    if (hasPermission) {
        warningBanner.style.display = "none";
        // Permission is clean, run standard script injection
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
        console.warn("Script injection blocked. Presenting permission warning.", err);
        document.getElementById("permission-warning").style.display = "block";
    }
}

async function applyConfig() {
    // Prevent execution attempts if we know we aren't permitted/injected yet
    if (!injected) return; 

    const tab = await getActiveTab();
    const speedValue = Number(document.getElementById("speed-number").value) || 1;

    const config = {
        speed: speedValue,
        cbSetIntervalChecked: document.getElementById("interval").checked,
        cbSetTimeoutChecked: document.getElementById("timeout").checked,
        cbPerformanceNowChecked: document.getElementById("performance").checked,
        cbDateNowChecked: document.getElementById("date").checked,
        cbRequestAnimationFrameChecked: document.getElementById("raf").checked
    };

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

// Synchronized Inputs Configuration
const slider = document.getElementById("speed");
const numInput = document.getElementById("speed-number");

slider.addEventListener("input", () => { numInput.value = slider.value; });
numInput.addEventListener("input", () => {
    const val = Number(numInput.value);
    if (val >= Number(slider.min) && val <= Number(slider.max)) {
        slider.value = val;
    } else if (val > Number(slider.max)) {
        slider.value = slider.max;
    }
});

document.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", applyConfig);
    input.addEventListener("change", applyConfig);
});

document.getElementById("request-permission-btn").addEventListener("click", async () => {
    injectSpeedHack();
});

// Initialize by checking permissions instead of blinding injecting
checkPermissions();
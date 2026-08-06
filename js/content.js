// Autobing - RAM Saver Mode content script
//
// When RAM Saver Mode is enabled AND an automated search batch is running,
// heavy Bing search page DOM is hidden so the page consumes minimal RAM and
// CPU while queries keep being submitted. The search bar stays intact; once
// the batch stops or finishes, everything is restored immediately.

const STYLE_ID = "autobing-ram-saver-style";
const FAVICON_ID = "autobing-ram-saver-favicon";
const AUTOBING_TITLE = "Autobing";
const EXTENSION_FAVICON_PATH = "img/icon128.png";
const RAM_SAVER_CSS =
  "div#b_content { display: none !important; }";

let faviconObserver = null;
let originalFavicons = [];
let titleObserver = null;
let originalPageTitle = null;
let settingTitle = false;

function injectRamSaver() {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RAM_SAVER_CSS;
    (document.head || document.documentElement).appendChild(style);
  }
  injectExtensionFavicon();
  injectExtensionTitle();
}

function removeRamSaver() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
  removeExtensionFavicon();
  removeExtensionTitle();
}

function injectExtensionTitle() {
  if (originalPageTitle === null && document.title !== AUTOBING_TITLE) {
    originalPageTitle = document.title;
  }

  setExtensionTitle();

  if (!titleObserver && document.head) {
    titleObserver = new MutationObserver(() => {
      if (!settingTitle && document.title !== AUTOBING_TITLE) {
        if (originalPageTitle === null) originalPageTitle = document.title;
        setExtensionTitle();
      }
    });
    titleObserver.observe(document.head, { childList: true, subtree: true });
  }
}

function setExtensionTitle() {
  settingTitle = true;
  document.title = AUTOBING_TITLE;
  settingTitle = false;
}

function removeExtensionTitle() {
  if (titleObserver) {
    titleObserver.disconnect();
    titleObserver = null;
  }
  if (originalPageTitle !== null) document.title = originalPageTitle;
  originalPageTitle = null;
}

function injectExtensionFavicon() {
  const head = document.head;
  if (!head) {
    document.addEventListener("DOMContentLoaded", injectExtensionFavicon, {
      once: true,
    });
    return;
  }

  if (!document.getElementById(FAVICON_ID) && !originalFavicons.length) {
    Array.from(
      head.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]'),
    ).forEach((link) => {
      originalFavicons.push(link);
      link.remove();
    });
  }

  let favicon = document.getElementById(FAVICON_ID);
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.id = FAVICON_ID;
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.sizes = "128x128";
    favicon.href = chrome.runtime.getURL(`${EXTENSION_FAVICON_PATH}?v=1`);
    head.appendChild(favicon);
  }

  if (!faviconObserver) {
    faviconObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        Array.from(record.addedNodes).forEach((node) => {
          if (
            node === favicon ||
            node.nodeType !== Node.ELEMENT_NODE ||
            !node.matches?.('link[rel~="icon"], link[rel="shortcut icon"]')
          ) {
            return;
          }
          originalFavicons.push(node);
          node.remove();
        });
      });
    });
    faviconObserver.observe(head, { childList: true });
  }
}

function removeExtensionFavicon() {
  if (faviconObserver) {
    faviconObserver.disconnect();
    faviconObserver = null;
  }
  const favicon = document.getElementById(FAVICON_ID);
  if (favicon) favicon.remove();

  if (document.head && originalFavicons.length) {
    originalFavicons.forEach((originalFavicon) => {
      if (!originalFavicon.isConnected) {
        document.head.appendChild(originalFavicon);
      }
    });
  }
  originalFavicons = [];
}

// The page should be blanked only while a batch is actively running
function shouldBeActive(ramSaverEnabled, searchState) {
  return ramSaverEnabled === true && searchState?.isRunning === true;
}

async function syncFromStorage() {
  const result = await chrome.storage.local.get([
    "ramSaverEnabled",
    "searchState",
  ]);
  if (shouldBeActive(result.ramSaverEnabled, result.searchState)) {
    injectRamSaver();
  } else {
    removeRamSaver();
  }
}

// document_start: hide before the heavy DOM renders whenever possible
syncFromStorage();

// Revert instantly when the run stops or completes (searchState is removed),
// and apply instantly when the toggle flips or a batch starts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.ramSaverEnabled || changes.searchState) {
    syncFromStorage();
  }
});

// Explicit fast-path commands from the background script, in case storage
// events race a page navigation
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ramSaverOn") {
    injectRamSaver();
  } else if (message?.type === "ramSaverOff") {
    removeRamSaver();
  }
});

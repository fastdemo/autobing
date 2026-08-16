// Autobing - RAM Saver Mode content script
//
// When RAM Saver Mode is enabled AND an automated search batch is running,
// heavy Bing search page DOM is hidden so the page consumes minimal RAM and
// CPU while queries keep being submitted. The search bar stays intact; once
// the batch stops or finishes, everything is restored immediately.

const STYLE_ID = "autobing-ram-saver-style";
const FAVICON_ID = "autobing-ram-saver-favicon";
const PAGE_BRANDING_STYLE_ID = "autobing-page-branding-style";
const PAGE_BRANDING_CLASS = "autobing-page-branding";
const AUTOBING_TITLE_PREFIX = "Autobing / ";
const EXTENSION_FAVICON_PATH = "img/icon128.png";
const RAM_SAVER_CSS =
  "div#b_content { display: none !important; }";

let faviconObserver = null;
let originalFavicons = [];
let titleObserver = null;
let originalPageTitle = null;
let settingTitle = false;
let pageBrandingObserver = null;

function injectEcoModeStyle() {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RAM_SAVER_CSS;
    (document.head || document.documentElement).appendChild(style);
  }
}

function removeEcoModeStyle() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

function injectRamSaver() {
  injectEcoModeStyle();
}

function removeRamSaver() {
  removeEcoModeStyle();
}

function injectExtensionTitle() {
  if (originalPageTitle === null && !document.title.startsWith(AUTOBING_TITLE_PREFIX)) {
    if (document.title) originalPageTitle = document.title;
  }

  if (originalPageTitle !== null) setExtensionTitle();

  if (!titleObserver && document.head) {
    titleObserver = new MutationObserver(() => {
      if (originalPageTitle === null) {
        if (document.title && !document.title.startsWith(AUTOBING_TITLE_PREFIX)) {
          originalPageTitle = document.title;
          setExtensionTitle();
        }
        return;
      }
      const expectedTitle = `${AUTOBING_TITLE_PREFIX}${originalPageTitle || ""}`;
      if (!settingTitle && document.title !== expectedTitle) {
        if (originalPageTitle === null) originalPageTitle = document.title;
        setExtensionTitle();
      }
    });
    titleObserver.observe(document.head, { childList: true, subtree: true });
  }
}

function setExtensionTitle() {
  const originalTitle = originalPageTitle || document.title;
  settingTitle = true;
  document.title = `${AUTOBING_TITLE_PREFIX}${originalTitle}`;
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

function injectPageBranding() {
  const head = document.head;
  if (!head) {
    document.addEventListener("DOMContentLoaded", injectPageBranding, { once: true });
    return;
  }

  let style = document.getElementById(PAGE_BRANDING_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = PAGE_BRANDING_STYLE_ID;
    style.textContent = `
      .${PAGE_BRANDING_CLASS} {
        background-image: var(--autobing-page-logo) !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-size: contain !important;
      }
      .${PAGE_BRANDING_CLASS} > * {
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `;
    head.appendChild(style);
  }

  const logo = document.querySelector(
    "#b_logo, a[aria-label='Bing'], header a[href*='bing']",
  );
  if (logo) {
    logo.classList.add(PAGE_BRANDING_CLASS);
    logo.style.setProperty(
      "--autobing-page-logo",
      `url("${chrome.runtime.getURL(`${EXTENSION_FAVICON_PATH}?v=1`)}")`,
    );
  }

  if (!pageBrandingObserver) {
    pageBrandingObserver = new MutationObserver(() => {
      const currentLogo = document.querySelector(
        "#b_logo, a[aria-label='Bing'], header a[href*='bing']",
      );
      if (currentLogo && !currentLogo.classList.contains(PAGE_BRANDING_CLASS)) {
        currentLogo.classList.add(PAGE_BRANDING_CLASS);
        currentLogo.style.setProperty(
          "--autobing-page-logo",
          `url("${chrome.runtime.getURL(`${EXTENSION_FAVICON_PATH}?v=1`)}")`,
        );
      }
    });
    pageBrandingObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

function removePageBranding() {
  if (pageBrandingObserver) {
    pageBrandingObserver.disconnect();
    pageBrandingObserver = null;
  }
  document.querySelectorAll(`.${PAGE_BRANDING_CLASS}`).forEach((logo) => {
    logo.classList.remove(PAGE_BRANDING_CLASS);
    logo.style.removeProperty("--autobing-page-logo");
  });
  document.getElementById(PAGE_BRANDING_STYLE_ID)?.remove();
}

function waitForTopResults(timeoutMs = 15000) {
  const getResults = () => {
    const selectors = [
      "li.b_algo h2 a[href]",
      "li.b_algo a[href]",
      "#b_results li.b_algo a[href]",
    ];
    const seen = new Set();
    return selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((link) => {
        if (seen.has(link) || !link.href) return false;
        seen.add(link);
        return true;
      })
      .slice(0, 5);
  };

  return new Promise((resolve) => {
    const initialResults = getResults();
    if (initialResults.length) {
      resolve(initialResults);
      return;
    }

    const observer = new MutationObserver(() => {
      const results = getResults();
      if (results.length) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(results);
      }
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve(getResults());
    }, timeoutMs);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function visitRandomSearchResult() {
  const ramSaverStyle = document.getElementById(STYLE_ID);
  const savedStyleText = ramSaverStyle?.textContent;
  if (ramSaverStyle) ramSaverStyle.textContent = "";

  try {
    const results = await waitForTopResults();
    if (!results.length) return { clicked: false };
    const result = results[Math.floor(Math.random() * results.length)];
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "openVisitResult", url: result.href },
        resolve,
      );
    });
    return { clicked: response?.success === true };
  } finally {
    if (ramSaverStyle) ramSaverStyle.textContent = savedStyleText;
  }
}

async function syncFromStorage() {
  const state = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getRamSaverState" }, (response) => {
      resolve(response || { active: false });
    });
  });
  if (state.branded === true) {
    injectExtensionFavicon();
    injectExtensionTitle();
    injectPageBranding();
  } else {
    removeExtensionFavicon();
    removeExtensionTitle();
    removePageBranding();
  }
  if (state.eco === true) injectEcoModeStyle();
  else removeEcoModeStyle();
}

// document_start: hide before the heavy DOM renders whenever possible
syncFromStorage();

// Re-check from the background worker so every page gets only its own tab's
// state rather than applying the global search state to every tab.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.ramSaverEnabled || changes.brandingEnabled || changes.searchState) {
    syncFromStorage();
  }
});

// Explicit fast-path commands from the background script, in case storage
// events race a page navigation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ramSaverOn") {
    injectRamSaver();
  } else if (message?.type === "ramSaverOff") {
    removeRamSaver();
  } else if (message?.type === "visitTabOn") {
    if (message.branding === true) {
      injectExtensionFavicon();
      injectExtensionTitle();
      injectPageBranding();
    } else {
      removeExtensionFavicon();
      removeExtensionTitle();
      removePageBranding();
    }
    if (message.ecoMode === true) injectEcoModeStyle();
    else removeEcoModeStyle();
  } else if (message?.type === "visitTabOff") {
    removeRamSaver();
  } else if (message?.type === "visitSearchResult") {
    visitRandomSearchResult().then(sendResponse);
    return true;
  }
});

function notifySearchPageReady() {
  chrome.runtime.sendMessage({ type: "searchPageReady" }).catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", notifySearchPageReady, {
    once: true,
  });
} else {
  notifySearchPageReady();
}

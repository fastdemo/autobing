// Autobing - RAM Saver Mode content script
//
// When RAM Saver Mode is enabled AND an automated search batch is running,
// heavy Bing search page DOM is hidden so the page consumes minimal RAM and
// CPU while queries keep being submitted. The search bar stays intact; once
// the batch stops or finishes, everything is restored immediately.

const STYLE_ID = "autobing-ram-saver-style";

// Heavy elements on a Bing search page that can be safely hidden while a
// batch is running. The search bar (#b_header / #sb_form) is intentionally
// kept so queries still submit normally.
const RAM_SAVER_CSS = [
  "#b_content",
  "#b_tween",
  "#b_results",
  "#b_sidebarmain",
  "#b_sidebar",
  "#b_sb",
  "#b_context",
  "#b_footer",
  "#b_notification",
  "aside",
  '[role="complementary"]',
  ".b_ad",
  ".b_promote",
  ".b_ans",
].join(", ") + " { display: none !important; }";

function injectRamSaver() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = RAM_SAVER_CSS;
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.classList.add("autobing-ram-saver");
}

function removeRamSaver() {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
  document.documentElement.classList.remove("autobing-ram-saver");
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

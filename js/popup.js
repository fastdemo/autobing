import config from "./config.js";

chrome.runtime.connect({ name: "popup" });

let isRunning = false;
let endlessMode = false;
let lastNumericValue = null;
let startTime = 0;
let timerInterval = null;

// Progressbar object
var progressBar = document.querySelector(config.domElements.progressBar);

// Hide the progress track until persisted state is loaded (prevents a 0% flash)
var progressTrack = document.querySelector(config.domElements.progressTrack);
progressTrack.classList.add("progress-pending");

setDefaultUI();
loadPreferences().then(() => restoreSearchState());

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "progress") {
    setProgress(message.progress);
    updateStats(
      message.currentSearch,
      message.totalSearches,
      message.progress,
      message.endless,
    );
  } else if (message.type === "phaseChange") {
    console.log(`Phase changed to: ${message.phase}`);
    updateStats(0, message.totalSearches, 0, message.endless);
  } else if (message.type === "complete") {
    setProgress(0);
    progressBar.classList.remove("endless");
    stopTimer();
    activateForms();
  } else if (message.type === "stopped") {
    setProgress(0);
    progressBar.classList.remove("endless");
    stopTimer();
    activateForms();
  }
});

// Restore persisted search state (storage-first so the bar shows the real
// absolute progress instead of flashing to 0% when the popup opens)
async function restoreSearchState() {
  try {
    const result = await chrome.storage.local.get(["searchState", "startTime"]);
    const state = result.searchState;

    if (state && state.isRunning) {
      const progress =
        state.totalSearches > 0
          ? parseInt((state.currentSearch / state.totalSearches) * 100) || 0
          : 0;
      setProgress(progress);
      updateStats(state.currentSearch, state.totalSearches, progress, state.endless);
      if (state.endless) setEndlessUI(true);
      deactivateForms();
      startTimer();
    } else {
      setProgress(0);
      updateStats(0, 0, 0, false);
    }
  } catch (error) {
    setProgress(0);
    updateStats(0, 0, 0, false);
  } finally {
    progressTrack.classList.remove("progress-pending");
  }
}

$(config.domElements.totDesktopSearchesForm).on("change", function () {
  const value = $(config.domElements.totDesktopSearchesForm).val();
  config.searches.desktop = value;
  chrome.storage.local.set({ desktopSearches: value });
  updateComboStats();
});

// Endless mode toggle (infinity icon inside the Searches input)
$(config.domElements.endlessToggle).on("click", () => {
  const next = !endlessMode;
  setEndlessUI(next);
  chrome.storage.local.set({ endlessMode: next });
});

function setEndlessUI(enabled) {
  const input = $(config.domElements.totDesktopSearchesForm);
  if (enabled) {
    endlessMode = true;
    const current = input.val();
    if (String(current) !== "∞") lastNumericValue = current || "";
    input.attr("type", "text").val("∞").prop("readonly", true);
    $(config.domElements.endlessToggle).addClass("active");
  } else {
    endlessMode = false;
    input
      .val(
        lastNumericValue !== null && lastNumericValue !== ""
          ? lastNumericValue
          : "",
      )
      .prop("readonly", false)
      .attr("type", "number");
    $(config.domElements.endlessToggle).removeClass("active");
  }
}

$(config.domElements.totMobileSearchesForm).on("change", function () {
  const value = $(config.domElements.totMobileSearchesForm).val();
  config.searches.mobile = value;
  chrome.storage.local.set({ mobileSearches: value });
});

$(config.domElements.waitingBetweenSearchesFormMin).on("change", function () {
  const value = $(config.domElements.waitingBetweenSearchesFormMin).val();
  config.searches.millisecondsMin = value;
  chrome.storage.local.set({ millisecondsMin: value });
});

$(config.domElements.waitingBetweenSearchesFormMax).on("change", function () {
  const value = $(config.domElements.waitingBetweenSearchesFormMax).val();
  config.searches.millisecondsMax = value;
  chrome.storage.local.set({ millisecondsMax: value });
});

// Default word bank presets (mirrors the fallbacks in js/background.js)
const DEFAULT_WORD_BANKS = {
  mood: [
    "best", "easy", "quick", "top rated", "simple", "healthy", "cheap",
    "affordable", "popular", "trending", "creative", "essential", "ultimate",
    "beginner", "minimalist", "cozy", "modern", "underrated", "budget",
    "smart", "fun", "relaxing", "fast", "great", "cool", "unique", "useful",
    "stylish", "practical", "classic", "clean", "fresh", "quiet", "compact",
    "durable", "lightweight", "portable", "effective", "low cost",
    "high quality", "aesthetic", "comforting", "peaceful", "energizing",
    "tasty", "delicious", "productive", "inspiring", "clever", "handy",
  ],
  category: [
    "coffee shops", "dinner recipes", "laptop reviews", "travel destinations",
    "workout routines", "sci-fi movies", "houseplants", "home decor ideas",
    "python tutorials", "meal prep plans", "indie games", "desk setups",
    "ambient music", "sourdough recipes", "hiking trails",
    "mechanical keyboards", "noise canceling headphones", "ergonomic chairs",
    "air purifiers", "mirrorless cameras", "book recommendations",
    "board games", "stretching routines", "podcasts", "breakfast ideas",
    "street photography", "backpacks", "running shoes", "smart home devices",
    "water bottles", "standing desks", "skin care routines",
    "smoothie recipes", "productivity apps", "coding tools", "graphic novels",
    "lo-fi beats", "tea varieties", "camping gear", "gardening tips",
    "organizing hacks", "baking recipes", "snack ideas",
    "time management techniques", "instrumental music", "wall art ideas",
    "espresso machines", "wireless earbuds", "monitors for coding",
    "bedside lamps",
  ],
  detail: [
    "near me", "for beginners", "on a budget", "step by step", "this week",
    "for students", "at home", "ideas", "compared", "review", "guide",
    "for small spaces", "from scratch", "for productivity",
    "to play this weekend", "on streaming", "for remote work",
    "for everyday use", "without hassle", "tips and tricks",
    "for small apartments", "for studying", "for summer", "for winter",
    "for long runs", "for travel", "under $50", "for college",
    "for office use", "in 15 minutes", "for beginners 2026",
    "with high rating", "for daily routine", "to try today", "for home gym",
    "for night time", "for focus", "for weekend project", "free options",
    "simple steps", "for busy days", "for relaxing", "creative list",
    "top picks", "for beginners guide", "essential list", "budget friendly",
    "quick setup", "for daily use", "high value",
  ],
};

const WORD_BANK_FIELDS = [
  {
    id: "#moodDescriptorsField",
    storageKey: "moodDescriptors",
    presetKey: "mood",
  },
  {
    id: "#categoriesField",
    storageKey: "categories",
    presetKey: "category",
  },
  {
    id: "#extraDetailsField",
    storageKey: "extraDetails",
    presetKey: "detail",
  },
];

const wordBankSaveTimers = {};

// Pristine baseline defaults (captured before loadPreferences mutates config)
const DEFAULT_SEARCH_CONFIG = {
  desktop: config.searches.desktop,
  mobile: config.searches.mobile,
  millisecondsMin: config.searches.millisecondsMin,
  millisecondsMax: config.searches.millisecondsMax,
};

let resetFlashTimer = null;

// Settings view
$(config.domElements.settingsToggle).on("click", () => {
  if ($(config.domElements.settingsView).hasClass("open")) {
    closeSettings();
  } else {
    openSettings();
  }
});

$(config.domElements.settingsBack).on("click", closeSettings);

// Escape key closes the settings view
$(document).on("keydown", (event) => {
  if (event.key === "Escape" && $(config.domElements.settingsView).hasClass("open")) {
    closeSettings();
  }
});

function openSettings() {
  $(config.domElements.settingsView).addClass("open").attr("aria-hidden", "false");
  loadWordBankFields();
  $(config.domElements.moodDescriptorsField).trigger("focus");
}

function closeSettings() {
  $(config.domElements.settingsView).removeClass("open").attr("aria-hidden", "true");
}

// Populate the word bank textareas from storage (fall back to presets)
async function loadWordBankFields() {
  const result = await chrome.storage.local.get([
    "moodDescriptors",
    "categories",
    "extraDetails",
  ]);

  WORD_BANK_FIELDS.forEach(({ id, storageKey, presetKey }) => {
    const stored = result[storageKey];
    const list =
      Array.isArray(stored) && stored.length > 0
        ? stored
        : DEFAULT_WORD_BANKS[presetKey];
    $(id).val(list.join(", "));
  });

  updateComboStats();
}

// Split textarea value into a trimmed, non-empty array and save it
function saveWordBankField(storageKey, selector) {
  const list = $(selector)
    .val()
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  chrome.storage.local.set({ [storageKey]: list });
}

// Count comma-separated words in a word bank field
function countWords(selector) {
  return $(selector)
    .val()
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0).length;
}

// Live combo counter: [unique searches in memory] • [total combos] • [coverage]% pool
async function updateComboStats() {
  const countField = (selector) =>
    Math.max(
      countWords(selector),
      1,
    );
  const descriptors = countField(config.domElements.moodDescriptorsField);
  const categories = countField(config.domElements.categoriesField);
  const extras = countField(config.domElements.extraDetailsField);
  const totalCombinations = descriptors * categories * extras;

  // Unique searches in memory = how many pool indices have been served
  const result = await chrome.storage.local.get("queryPool");
  let uniqueSearches = Array.isArray(result.queryPool?.indices)
    ? result.queryPool.currentQueryIndex
    : 0;

  // Automatic 100% reset: pool exhausted, wipe history so the cycle starts fresh
  if (totalCombinations > 0 && uniqueSearches >= totalCombinations) {
    await chrome.storage.local.set({
      queryPool: { fingerprint: "", indices: [], currentQueryIndex: 0 },
    });
    uniqueSearches = 0;
  }

  $(config.domElements.comboSearches).text(uniqueSearches.toLocaleString());
  $(config.domElements.comboTotal).text(totalCombinations.toLocaleString());

  let coverage = Math.min(100, (uniqueSearches / totalCombinations) * 100);
  let coverageText;
  if (coverage <= 0) {
    coverageText = "0";
  } else if (coverage < 1) {
    coverageText = coverage.toFixed(2);
    if (coverageText === "0.00") coverageText = coverage.toFixed(3);
  } else {
    coverageText = coverage.toFixed(1);
  }
  $(config.domElements.comboPercent).text(`${coverageText}%`);
}

// Auto-save on input (debounced) and change (immediate)
WORD_BANK_FIELDS.forEach(({ id, storageKey }) => {
  $(id).on("input", () => {
    updateComboStats();
    clearTimeout(wordBankSaveTimers[storageKey]);
    wordBankSaveTimers[storageKey] = setTimeout(
      () => saveWordBankField(storageKey, id),
      300,
    );
  });

  $(id).on("change", () => {
    clearTimeout(wordBankSaveTimers[storageKey]);
    saveWordBankField(storageKey, id);
    updateComboStats();
  });
});

// Refresh the combo counter live as searches consume the pool
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    changes.queryPool ||
    changes.moodDescriptors ||
    changes.categories ||
    changes.extraDetails
  ) {
    updateComboStats();
  }
});

// Restore factory settings: word banks, search counts, timers, theme, and pool
$(config.domElements.settingsReset).on("click", async () => {
  // Cancel any pending auto-saves so stale edits cannot overwrite the reset
  Object.values(wordBankSaveTimers).forEach(clearTimeout);

  await chrome.storage.local.set({
    moodDescriptors: DEFAULT_WORD_BANKS.mood,
    categories: DEFAULT_WORD_BANKS.category,
    extraDetails: DEFAULT_WORD_BANKS.detail,
    desktopSearches: DEFAULT_SEARCH_CONFIG.desktop,
    mobileSearches: DEFAULT_SEARCH_CONFIG.mobile,
    millisecondsMin: DEFAULT_SEARCH_CONFIG.millisecondsMin,
    millisecondsMax: DEFAULT_SEARCH_CONFIG.millisecondsMax,
  });
  await chrome.storage.local.remove("darkMode");

  // Rebuild the combination pool and reset its index in the background
  chrome.runtime.sendMessage({ type: "resetPool" }, (response) => {
    if (response && !response.success) {
      console.error("Failed to reset query pool:", response?.error);
    }
  });

  // Refresh the UI immediately
  await loadWordBankFields();
  $(config.domElements.totDesktopSearchesForm).val(
    DEFAULT_SEARCH_CONFIG.desktop,
  );
  $(config.domElements.totMobileSearchesForm).val(
    DEFAULT_SEARCH_CONFIG.mobile,
  );
  $(config.domElements.waitingBetweenSearchesFormMin).val(
    DEFAULT_SEARCH_CONFIG.millisecondsMin,
  );
  $(config.domElements.waitingBetweenSearchesFormMax).val(
    DEFAULT_SEARCH_CONFIG.millisecondsMax,
  );
  applyDarkMode(false);

  updateComboStats();
  flashResetFeedback();
});

// Temporary feedback so the user knows settings were restored
function flashResetFeedback() {
  const button = $(config.domElements.settingsReset);
  clearTimeout(resetFlashTimer);
  button.addClass("reset-success");
  button.find(".reset-label").text("Reset!");
  button
    .find(".reset-icon")
    .removeClass("fa-rotate-left")
    .addClass("fa-check");
  resetFlashTimer = setTimeout(() => {
    button.removeClass("reset-success");
    button.find(".reset-label").text("Restore Factory Settings");
    button
      .find(".reset-icon")
      .removeClass("fa-check")
      .addClass("fa-rotate-left");
  }, 1600);
}

// Theme toggle
$(config.domElements.themeToggle).on("click", () => {
  const enabled = !document.body.classList.contains("dark-mode");
  applyDarkMode(enabled);
  chrome.storage.local.set({ darkMode: enabled });
});

// Start or stop searches
$(config.domElements.desktopButton).on("click", async () => {
  if (isRunning) {
    chrome.runtime.sendMessage({ type: "stopSearches" }, (response) => {
      if (response && response.success) {
        console.log("Searches stopped successfully");
      }
    });
  } else {
    startSearches("desktop");
  }
});

// Start search mobile (hidden UI)
$(config.domElements.mobileButton).on("click", async () => {
  startSearches("mobile");
});

// Start search desktop&mobile (hidden UI)
$(config.domElements.desktopMobileButton).on("click", async () => {
  startSearches("desktopMobile");
});

/**
 * Start searches via background script
 */
async function startSearches(searchType) {
  deactivateForms();

  const searchesValue = $(config.domElements.totDesktopSearchesForm).val();
  const endless = endlessMode || String(searchesValue) === "∞";
  const desktopSearches = endless ? 0 : parseInt(config.searches.desktop);
  const mobileSearches = endless ? 0 : parseInt(config.searches.mobile);

  const settings = {
    desktopSearches: desktopSearches,
    mobileSearches: mobileSearches,
    millisecondsMin: parseInt(config.searches.millisecondsMin),
    millisecondsMax: parseInt(config.searches.millisecondsMax),
    endless: endless,
  };

  await chrome.storage.local.set({ startTime: Date.now() });
  updateStats(0, 0, 0, endless);
  startTimer();

  chrome.runtime.sendMessage(
    {
      type: "startSearches",
      searchType: searchType,
      settings: settings,
    },
    (response) => {
      if (!response || !response.success) {
        console.error("Failed to start searches:", response?.error);
        activateForms();
        stopTimer();
      }
    },
  );
}

/**
 * Set default UI values
 */
function setDefaultUI() {
  // Set the app version number (revealed on hover over the footer tag)
  $(config.domElements.appVersion).find(".text-hover").html(config.general.appVersion);

  // Set default input values
  $(config.domElements.totDesktopSearchesForm).val(config.searches.desktop);
  $(config.domElements.totMobileSearchesForm).val(config.searches.mobile);
  $(config.domElements.waitingBetweenSearchesFormMin).val(
    config.searches.millisecondsMin,
  );
  $(config.domElements.waitingBetweenSearchesFormMax).val(
    config.searches.millisecondsMax,
  );
}

/**
 * Load saved preferences from chrome storage
 */
async function loadPreferences() {
  const result = await chrome.storage.local.get([
    "desktopSearches",
    "mobileSearches",
    "millisecondsMin",
    "millisecondsMax",
    "darkMode",
    "endlessMode",
  ]);

  config.searches.desktop =
    result.desktopSearches ?? config.searches.desktop;
  config.searches.mobile = result.mobileSearches ?? config.searches.mobile;
  config.searches.millisecondsMin =
    result.millisecondsMin ?? config.searches.millisecondsMin;
  config.searches.millisecondsMax =
    result.millisecondsMax ?? config.searches.millisecondsMax;

  $(config.domElements.totDesktopSearchesForm).val(config.searches.desktop);
  $(config.domElements.totMobileSearchesForm).val(config.searches.mobile);
  $(config.domElements.waitingBetweenSearchesFormMin).val(
    config.searches.millisecondsMin,
  );
  $(config.domElements.waitingBetweenSearchesFormMax).val(
    config.searches.millisecondsMax,
  );

  if (result.endlessMode && !endlessMode) setEndlessUI(true);

  applyDarkMode(result.darkMode === true);
}

/**
 * Apply or remove dark mode
 * @param {boolean} enabled
 */
function applyDarkMode(enabled) {
  document.body.classList.toggle("dark-mode", enabled);
  $(config.domElements.themeToggle).find(".icon-moon").toggle(!enabled);
  $(config.domElements.themeToggle).find(".icon-sun").toggle(enabled);
}

/**
 * Switch the action button to "Stop Searches" mode
 */
function deactivateForms() {
  isRunning = true;
  $(config.domElements.desktopButton).addClass("btn-stop");
  $(config.domElements.desktopButton)
    .find("i")
    .removeClass("fa-play")
    .addClass("fa-stop");
  $(config.domElements.desktopButton).find("span").text("Stop Searches");
}

/**
 * Switch the action button back to "Start" mode
 */
function activateForms() {
  isRunning = false;
  $(config.domElements.desktopButton).removeClass("btn-stop");
  $(config.domElements.desktopButton)
    .find("i")
    .removeClass("fa-stop")
    .addClass("fa-play");
  $(config.domElements.desktopButton).find("span").text("Start");
}

/**
 * Update the progress bar fill width
 * @param {*} value
 */
function setProgress(value) {
  progressBar.style.width = value + "%";
}

/**
 * Update the live stats row and progress bar mode
 */
function updateStats(currentSearch, totalSearches, percent, endless) {
  $(config.domElements.statsCount).text(
    endless ? `${currentSearch} / ∞` : `${currentSearch} / ${totalSearches}`,
  );
  $(config.domElements.statsPercent).text(endless ? "Endless" : `${percent}%`);
  progressBar.classList.toggle("endless", !!endless);
}

/**
 * Start the live elapsed-time counter, based on the stored startTime
 */
async function startTimer() {
  const result = await chrome.storage.local.get("startTime");
  startTime = result.startTime || Date.now();
  tickTimer();
  clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  const elapsed = Math.max(0, Date.now() - startTime);
  const minutes = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
  $(config.domElements.statsTimer).text(`${minutes}:${seconds}`);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

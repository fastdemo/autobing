import config from "./config.js";

chrome.runtime.connect({ name: "popup" });

let isRunning = false;

// Progressbar object
var progressBar = document.querySelector(config.domElements.progressBar);

setDefaultUI();
loadPreferences();
checkRunningState();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "progress") {
    setProgress(message.progress);
  } else if (message.type === "phaseChange") {
    console.log(`Phase changed to: ${message.phase}`);
  } else if (message.type === "complete") {
    setProgress(0);
    activateForms();
  } else if (message.type === "stopped") {
    setProgress(0);
    activateForms();
  }
});

// Check if searches are already running when popup opens
function checkRunningState() {
  chrome.runtime.sendMessage({ type: "getState" }, (response) => {
    if (response && response.isRunning) {
      deactivateForms();
    }
  });
}

$(config.domElements.totDesktopSearchesForm).on("change", function () {
  const value = $(config.domElements.totDesktopSearchesForm).val();
  config.searches.desktop = value;
  chrome.storage.local.set({ desktopSearches: value });
});

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

// Auto-save on input (debounced) and change (immediate)
WORD_BANK_FIELDS.forEach(({ id, storageKey }) => {
  $(id).on("input", () => {
    clearTimeout(wordBankSaveTimers[storageKey]);
    wordBankSaveTimers[storageKey] = setTimeout(
      () => saveWordBankField(storageKey, id),
      300,
    );
  });

  $(id).on("change", () => {
    clearTimeout(wordBankSaveTimers[storageKey]);
    saveWordBankField(storageKey, id);
  });
});

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

  const settings = {
    desktopSearches: parseInt(config.searches.desktop),
    mobileSearches: parseInt(config.searches.mobile),
    millisecondsMin: parseInt(config.searches.millisecondsMin),
    millisecondsMax: parseInt(config.searches.millisecondsMax),
  };

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
      }
    },
  );
}

/**
 * Set default UI values
 */
function setDefaultUI() {
  // Set the app version number
  $(config.domElements.appVersion).html(config.general.appVersion);

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

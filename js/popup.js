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

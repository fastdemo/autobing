import config from "./config.js";

chrome.runtime.connect({ name: "popup" });

let isRunning = false;

// Progressbar object
var progressBar = document.querySelector(config.domElements.progressBar);

setDefaultUI();
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
  config.searches.desktop = $(config.domElements.totDesktopSearchesForm).val();
  localStorage.setItem("desktopSearches", config.searches.desktop);
});

$(config.domElements.totMobileSearchesForm).on("change", function () {
  config.searches.mobile = $(config.domElements.totMobileSearchesForm).val();
  localStorage.setItem("mobileSearches", config.searches.mobile);
});

$(config.domElements.waitingBetweenSearchesFormMin).on("change", function () {
  config.searches.millisecondsMin = $(
    config.domElements.waitingBetweenSearchesFormMin,
  ).val();
  localStorage.setItem("millisecondsMin", config.searches.millisecondsMin);
});

$(config.domElements.waitingBetweenSearchesFormMax).on("change", function () {
  config.searches.millisecondsMax = $(
    config.domElements.waitingBetweenSearchesFormMax,
  ).val();
  localStorage.setItem("millisecondsMax", config.searches.millisecondsMax);
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
 * Set default UI values and load saved settings
 */
function setDefaultUI() {
  // Set the app version number
  $(config.domElements.appVersion).html(config.general.appVersion);

  // Load saved values from localStorage or use defaults
  config.searches.desktop =
    localStorage.getItem("desktopSearches") || config.searches.desktop;
  config.searches.mobile =
    localStorage.getItem("mobileSearches") || config.searches.mobile;
  config.searches.millisecondsMin =
    localStorage.getItem("millisecondsMin") || config.searches.millisecondsMin;
  config.searches.millisecondsMax =
    localStorage.getItem("millisecondsMax") || config.searches.millisecondsMax;

  // Set numberOfSearches default values inside the input
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

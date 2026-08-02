// Word banks for dynamic query generation
const MOOD_DESCRIPTORS = [
  "best", "easy", "quick", "top rated", "simple", "healthy", "cheap",
  "affordable", "popular", "trending", "creative", "essential", "ultimate",
  "beginner", "minimalist", "cozy", "modern", "underrated", "budget",
  "smart", "fun", "relaxing", "fast", "great", "cool", "unique", "useful",
  "stylish", "practical", "classic", "clean", "fresh", "quiet", "compact",
  "durable", "lightweight", "portable", "effective", "low cost",
  "high quality", "aesthetic", "comforting", "peaceful", "energizing",
  "tasty", "delicious", "productive", "inspiring", "clever", "handy",
];

const CATEGORIES = [
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
];

const EXTRA_DETAILS = [
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
];

// Runtime word banks - loaded from chrome.storage.local, fall back to the
// preset arrays above when storage is empty or invalid
let wordBanks = {
  mood: MOOD_DESCRIPTORS,
  category: CATEGORIES,
  detail: EXTRA_DETAILS,
};

// Load user-customized word banks from chrome.storage.local
async function loadWordBanks() {
  const result = await chrome.storage.local.get([
    "moodDescriptors",
    "categories",
    "extraDetails",
  ]);
  wordBanks = {
    mood: normalizeWordBank(result.moodDescriptors, MOOD_DESCRIPTORS),
    category: normalizeWordBank(result.categories, CATEGORIES),
    detail: normalizeWordBank(result.extraDetails, EXTRA_DETAILS),
  };
}

function normalizeWordBank(stored, fallback) {
  return Array.isArray(stored) && stored.length > 0 ? stored : fallback;
}

// Configuration
const config = {
  bing: {
    url: "https://bing.com/search?q={q}&form={form}&cvid={cvid}",
    form: "QBRE",
  },
  devices: {
    phone: {
      title: "Samsung Galaxy S21",
      width: 360,
      height: 800,
      deviceScaleFactor: 3,
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      touch: true,
      mobile: true,
    },
    desktop: {
      title: "Dell Xps 15",
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      touch: false,
      mobile: false,
    },
  },
};

// State management - stored in memory, persisted for alarm callbacks
let searchState = {
  isRunning: false,
  currentSearch: 0,
  totalSearches: 0,
  tabId: null,
  searchType: null, // 'desktop', 'mobile', 'desktopMobile'
  phase: null, // 'desktop', 'mobile'
  millisecondsMin: 8000,
  millisecondsMax: 10000,
  desktopSearches: 3,
  mobileSearches: 3,
  usedQueries: new Set(),
  completionPending: false,
};

const ALARM_NAME = "searchAlarm";

// Save state to chrome.storage.local for persistence
async function saveState() {
  await chrome.storage.local.set({ searchState: searchState });
}

// Load state from chrome.storage.local
async function loadState() {
  const result = await chrome.storage.local.get("searchState");
  if (result.searchState) {
    searchState = result.searchState;
    // usedQueries is a Set in memory but serializes as {} through storage
    if (!(searchState.usedQueries instanceof Set)) {
      searchState.usedQueries = new Set(
        Array.isArray(searchState.usedQueries)
          ? searchState.usedQueries
          : [],
      );
    }
  }
}

// Helper functions
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Build a dynamic search query from random word bank combinations
function generateDynamicQuery() {
  const template = Math.floor(Math.random() * 4);
  const mood = pickRandom(wordBanks.mood);
  const category = pickRandom(wordBanks.category);
  const detail = pickRandom(wordBanks.detail);

  switch (template) {
    case 0:
      return `${mood} ${category} ${detail}`;
    case 1:
      return `${mood} ${category}`;
    case 2:
      return `${category} ${detail}`;
    default:
      return `how to find ${mood} ${category}`;
  }
}

// Get a query that has not been used in the current session
function getUniqueQuery() {
  let query = generateDynamicQuery();
  while (searchState.usedQueries.has(query)) {
    query = generateDynamicQuery();
  }
  searchState.usedQueries.add(query);
  return query;
}

function randomDelay() {
  return Math.floor(
    Math.random() *
      (parseInt(searchState.millisecondsMax) -
        parseInt(searchState.millisecondsMin) +
        1) +
      parseInt(searchState.millisecondsMin),
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTabId() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var activeTab = tabs[0];
      var activeTabId = activeTab.id;
      resolve(activeTabId);
    });
  });
}

// Notify popup about state changes
function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup might be closed, ignore error
  });
}

// Enable debugger
async function enableDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.2", function () {
      console.log(`Debugger enabled for tab: ${tabId}`);
      resolve(true);
    });
  });
}

// Disable debugger
async function disableDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.detach({ tabId }, function () {
      console.log(`Debugger disabled for tab: ${tabId}`);
      resolve(true);
    });
  });
}

// Activate mobile user agent
async function activeMobileAgent(tabId) {
  return new Promise((resolve, reject) => {
    // First set the user agent override with full mobile hints
    chrome.debugger.sendCommand(
      {
        tabId: tabId,
      },
      "Network.setUserAgentOverride",
      {
        userAgent: config.devices.phone.userAgent,
        acceptLanguage: "en-US,en;q=0.9",
        platform: "Linux armv8l",
        userAgentMetadata: {
          brands: [
            { brand: "Google Chrome", version: "131" },
            { brand: "Chromium", version: "131" },
            { brand: "Not_A Brand", version: "24" },
          ],
          fullVersionList: [
            { brand: "Google Chrome", version: "131.0.0.0" },
            { brand: "Chromium", version: "131.0.0.0" },
            { brand: "Not_A Brand", version: "24.0.0.0" },
          ],
          platform: "Android",
          platformVersion: "13.0.0",
          architecture: "",
          model: "SM-S908B",
          mobile: true,
          bitness: "",
          wow64: false,
        },
      },
      function () {
        // Then set device metrics
        chrome.debugger.sendCommand(
          {
            tabId: tabId,
          },
          "Emulation.setDeviceMetricsOverride",
          {
            width: config.devices.phone.width,
            height: config.devices.phone.height,
            deviceScaleFactor: config.devices.phone.deviceScaleFactor,
            mobile: config.devices.phone.mobile,
            screenWidth: config.devices.phone.width,
            screenHeight: config.devices.phone.height,
            positionX: 0,
            positionY: 0,
            screenOrientation: { type: "portraitPrimary", angle: 0 },
          },
          function () {
            // Enable touch emulation
            chrome.debugger.sendCommand(
              {
                tabId: tabId,
              },
              "Emulation.setTouchEmulationEnabled",
              {
                enabled: true,
                maxTouchPoints: 5,
              },
              function () {
                resolve(true);
              },
            );
          },
        );
      },
    );
  });
}

// Activate desktop user agent
async function activeDesktopAgent(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      {
        tabId: tabId,
      },
      "Network.setUserAgentOverride",
      {
        userAgent: config.devices.desktop.userAgent,
        acceptLanguage: "en-US,en;q=0.9",
        platform: "Win32",
        userAgentMetadata: {
          brands: [
            { brand: "Google Chrome", version: "131" },
            { brand: "Chromium", version: "131" },
            { brand: "Not_A Brand", version: "24" },
          ],
          fullVersionList: [
            { brand: "Google Chrome", version: "131.0.0.0" },
            { brand: "Chromium", version: "131.0.0.0" },
            { brand: "Not_A Brand", version: "24.0.0.0" },
          ],
          platform: "Windows",
          platformVersion: "15.0.0",
          architecture: "x86",
          model: "",
          mobile: false,
          bitness: "64",
          wow64: false,
        },
      },
      function () {
        chrome.debugger.sendCommand(
          {
            tabId: tabId,
          },
          "Emulation.setDeviceMetricsOverride",
          {
            width: config.devices.desktop.width,
            height: config.devices.desktop.height,
            deviceScaleFactor: config.devices.desktop.deviceScaleFactor,
            mobile: config.devices.desktop.mobile,
            screenWidth: config.devices.desktop.width,
            screenHeight: config.devices.desktop.height,
          },
          function () {
            // Disable touch emulation
            chrome.debugger.sendCommand(
              {
                tabId: tabId,
              },
              "Emulation.setTouchEmulationEnabled",
              {
                enabled: false,
              },
              function () {
                resolve(true);
              },
            );
          },
        );
      },
    );
  });
}

// Perform a single search
async function performSingleSearch() {
  if (!searchState.isRunning) return;

  // Refresh word banks so customizations apply to the current run
  await loadWordBanks();

  const searchUrl = config.bing.url
    .replace("{q}", encodeURIComponent(getUniqueQuery()))
    .replace("{form}", config.bing.form)
    .replace("{cvid}", "");

  console.log("Open new search at:", searchUrl);

  try {
    await chrome.tabs.update(searchState.tabId, { url: searchUrl });
  } catch (error) {
    console.error("Error updating tab:", error);
    stopSearches();
    return;
  }

  searchState.currentSearch++;
  const progress = parseInt(
    (searchState.currentSearch / searchState.totalSearches) * 100,
  );

  notifyPopup({
    type: "progress",
    progress: progress,
    currentSearch: searchState.currentSearch,
    totalSearches: searchState.totalSearches,
    phase: searchState.phase,
  });

  if (searchState.currentSearch < searchState.totalSearches) {
    // Schedule next search using chrome.alarms
    await saveState();
    const delayInMinutes = randomDelay() / 60000; // Convert ms to minutes
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: Math.max(delayInMinutes, 0.1),
    }); // Min 6 seconds
  } else {
    // Final search fired: wait the assigned delay, then complete the run
    searchState.completionPending = true;
    await saveState();
    const delayInMinutes = randomDelay() / 60000;
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: Math.max(delayInMinutes, 0.1),
    });
  }
}

// Handle phase completion
async function handlePhaseComplete() {
  if (searchState.searchType === "desktop") {
    // Desktop only completed
    await completeSearches();
  } else if (searchState.searchType === "mobile") {
    // Mobile only completed
    await activeDesktopAgent(searchState.tabId);
    await disableDebugger(searchState.tabId);
    await completeSearches();
  } else if (searchState.searchType === "desktopMobile") {
    if (searchState.phase === "desktop") {
      // Switch to mobile phase
      searchState.phase = "mobile";
      searchState.currentSearch = 0;
      searchState.totalSearches = searchState.mobileSearches;

      await enableDebugger(searchState.tabId);
      await activeMobileAgent(searchState.tabId);

      notifyPopup({
        type: "phaseChange",
        phase: "mobile",
        totalSearches: searchState.totalSearches,
      });

      // Start mobile searches using chrome.alarms
      await saveState();
      const delayInMinutes = randomDelay() / 60000;
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: Math.max(delayInMinutes, 0.1),
      });
    } else {
      // Mobile phase completed
      await activeDesktopAgent(searchState.tabId);
      await disableDebugger(searchState.tabId);
      await completeSearches();
    }
  }
}

// Complete all searches
async function completeSearches() {
  searchState.isRunning = false;

  notifyPopup({
    type: "complete",
  });

  // Open GitHub profile once the full run finishes
  chrome.tabs.create({ url: "https://github.com/fastdemo" });

  // Reset state
  searchState = {
    ...searchState,
    isRunning: false,
    currentSearch: 0,
    totalSearches: 0,
    tabId: null,
    searchType: null,
    phase: null,
    usedQueries: new Set(),
    completionPending: false,
  };

  // Clear alarm and saved state
  chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.remove("searchState");
}

// Stop searches
async function stopSearches() {
  searchState.isRunning = false;

  notifyPopup({
    type: "stopped",
  });

  // Try to disable debugger if active
  if (
    searchState.tabId &&
    (searchState.searchType === "mobile" ||
      (searchState.searchType === "desktopMobile" &&
        searchState.phase === "mobile"))
  ) {
    disableDebugger(searchState.tabId).catch(() => {});
  }

  searchState = {
    ...searchState,
    isRunning: false,
    currentSearch: 0,
    totalSearches: 0,
    tabId: null,
    searchType: null,
    phase: null,
    usedQueries: new Set(),
    completionPending: false,
  };

  // Clear alarm and saved state
  chrome.alarms.clear(ALARM_NAME);
  await chrome.storage.local.remove("searchState");
}

// Start searches
async function startSearches(type, settings) {
  if (searchState.isRunning) {
    return { success: false, error: "Searches already running" };
  }

  const tabId = await getTabId();

  searchState = {
    isRunning: true,
    currentSearch: 0,
    totalSearches:
      type === "mobile" ? settings.mobileSearches : settings.desktopSearches,
    tabId: tabId,
    searchType: type,
    phase: type === "mobile" ? "mobile" : "desktop",
    millisecondsMin: settings.millisecondsMin,
    millisecondsMax: settings.millisecondsMax,
    desktopSearches: settings.desktopSearches,
    mobileSearches: settings.mobileSearches,
    usedQueries: new Set(),
    completionPending: false,
  };

  // Initialize mobile mode if needed
  if (type === "mobile") {
    await enableDebugger(tabId);
    await activeMobileAgent(tabId);
  }

  // Save state and start the first search
  await saveState();
  performSingleSearch();

  return { success: true };
}

// Alarm listener - this fires even when popup is closed
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await loadState();
    if (searchState.isRunning) {
      if (searchState.completionPending) {
        searchState.completionPending = false;
        await handlePhaseComplete();
      } else {
        performSingleSearch();
      }
    }
  }
});

// Restore state on service worker startup
chrome.runtime.onStartup.addListener(async () => {
  await loadState();
  if (searchState.isRunning) {
    // Resume searches
    performSingleSearch();
  }
});

// Also check on install/update
chrome.runtime.onInstalled.addListener(async () => {
  await loadState();
  if (searchState.isRunning) {
    performSingleSearch();
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "startSearches") {
    startSearches(message.searchType, message.settings).then((result) => {
      sendResponse(result);
    });
    return true; // Indicates async response
  }

  if (message.type === "stopSearches") {
    stopSearches().then(() => {
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }

  if (message.type === "getState") {
    // Load state from storage first to get persisted state
    loadState().then(() => {
      sendResponse({
        isRunning: searchState.isRunning,
        currentSearch: searchState.currentSearch,
        totalSearches: searchState.totalSearches,
        phase: searchState.phase,
        searchType: searchState.searchType,
      });
    });
    return true; // Indicates async response
  }
});

// Close debugger in case is open when popup closes (fallback)
chrome.runtime.onConnect.addListener(async function (port) {
  if (port.name === "popup") {
    port.onDisconnect.addListener(async function () {
      // Only detach debugger if searches are NOT running
      // This allows searches to continue when popup closes
      if (!searchState.isRunning) {
        let tabId = await getTabId();
        chrome.debugger.detach({ tabId }, function () {
          console.log(`Debugger disabled for tab: ${tabId}`);
        });
      }
    });
  }
});

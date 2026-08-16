// Word banks for dynamic query generation
const MOOD_DESCRIPTORS = [
  "best", "easy", "quick", "top rated", "simple", "healthy", "cheap",
  "affordable", "popular", "trending", "creative", "essential", "ultimate",
  "beginner", "minimalist", "cozy", "modern", "rustic", "smart", "fast",
  "premium", "organic", "natural", "sustainable", "compact", "portable",
  "vintage", "retro", "classic", "unique", "custom", "daily", "weekly",
  "monthly", "annual", "local", "global", "online", "digital", "interactive",
  "automated", "efficient", "budget", "luxury", "family", "kid friendly",
  "eco friendly", "DIY", "homemade", "professional", "advanced", "basic",
  "comprehensive", "practical", "fun", "cool", "stylish", "elegant",
  "powerful", "lightweight", "durable", "heavy duty", "safe", "quiet",
  "energetic", "peaceful", "relaxing", "inspiring", "productive", "clever",
  "handy", "versatile", "flexible", "reliable", "innovative", "fresh",
  "original", "seasonal", "festive", "outdoor", "indoor", "urban", "rural",
  "coastal", "tropical", "mountain", "winter", "summer", "spring", "autumn",
  "holiday", "weekend", "evening", "morning", "night", "quick start",
  "step by step", "complete", "master", "low cost",
];

const CATEGORIES = [
  "coffee shops", "dinner recipes", "laptop reviews", "travel destinations",
  "workout routines", "sci-fi movies", "houseplants", "home decor ideas",
  "python tutorials", "podcast recommendations", "hiking trails",
  "photography tips", "gaming setups", "mechanical keyboards",
  "acoustic guitars", "sourdough baking", "skincare routines", "board games",
  "documentary films", "street food", "smartphone accessories",
  "electric vehicles", "urban gardening", "book recommendations",
  "productivity apps", "desk setups", "language learning", "indie video games",
  "jazz music", "camping gear", "yoga practices", "meal prep",
  "sustainable fashion", "interior design", "dog training", "art supplies",
  "smart home devices", "retro gaming", "web development",
  "financial planning", "meditation techniques", "running shoes",
  "espresso machines", "craft beer", "vintage clothing", "graphic design",
  "zero waste tips", "road trip routes", "stargazing", "woodworking",
  "mechanical watches", "pottery", "cocktail recipes", "side hustles",
  "home workout gear", "thrifting", "animation tools", "audiobooks",
  "mindfulness exercises", "drone photography", "container gardening",
  "solo travel", "digital illustration", "tea varieties",
  "mechanical pencils", "room organization", "personal finance",
  "acoustic panels", "smartwatches", "historical fiction",
  "language exchange", "film photography", "calisthenics", "3d printing",
  "camping recipes", "minimalist wardrobe", "podcasting gear",
  "urban exploration", "stationery", "mechanical puzzles",
  "sourdough starters", "desk lamps", "indoor plants",
  "watercolor painting", "coffee beans", "home automation",
  "wireless earbuds", "budget travel", "leather crafting",
  "noise cancelling headphones", "note taking apps", "home brewing",
  "retro consoles", "mechanical switches", "graphic novels",
  "standing desks", "ergonomics", "air purifiers", "mirrorless cameras",
  "smoothie recipes",
];

const EXTRA_DETAILS = [
  "near me", "for beginners", "on a budget", "step by step", "for small spaces",
  "for students", "for remote workers", "for busy people",
  "with low maintenance", "for winter", "for summer", "for apartment living",
  "for family", "for couples", "for solo travelers", "with high ratings",
  "under $50", "under $100", "free download", "open source",
  "step by step guide", "without experience", "with video tutorial",
  "for kids", "for seniors", "for professionals", "with fast shipping",
  "for home office", "for small teams", "for weekends",
  "with natural ingredients", "eco friendly alternatives", "without sugar",
  "gluten free options", "for productivity", "for relaxation", "for focus",
  "with easy cleanup", "for small business", "with long battery life",
  "for travel", "for outdoor use", "for night time", "for morning routines",
  "with minimal tools", "for fast results", "with high reviews",
  "for quiet spaces", "for stress relief", "for pet owners",
  "for college dorms", "with customizable options", "for workout recovery",
  "for creative projects", "for language practice", "for skill building",
  "for daily use", "for special occasions", "with lifetime access",
  "for road trips", "for rainy days", "for small budgets",
  "for quick learning", "with high accuracy", "for beginners guide",
  "with template", "for automated workflows", "for dark mode",
  "for offline use", "for mobile", "for desktop", "for smart tv",
  "for smartwatch", "with active community", "with step by step instructions",
  "for slow mornings", "for late nights", "for holiday gifts",
  "for party planning", "for weekend projects", "for habit building",
  "for energy boost", "for deep work", "for mind mapping",
  "for project management", "for content creators", "for developers",
  "for designers", "for writers", "for artists", "for musicians",
  "for photographers", "for gamers", "for fitness enthusiasts",
  "for foodies", "for book lovers", "for tech lovers",
  "for eco conscious buyers", "to try today", "budget friendly",
];

// Runtime word banks - loaded from chrome.storage.local, fall back to the
// preset arrays above when storage is empty or invalid
let wordBanks = {
  mood: MOOD_DESCRIPTORS,
  category: CATEGORIES,
  detail: EXTRA_DETAILS,
};

// Query pool state - persisted to chrome.storage.local
let queryPool = {
  fingerprint: "",
  indices: [],
  currentQueryIndex: 0,
};
let searchCount = 0;

const WORD_BANK_STORAGE_KEYS = ["moodDescriptors", "categories", "extraDetails"];

// RAM Saver Mode - whether heavy Bing DOM should be hidden during batches
let ramSaverEnabled = false;
let brandingEnabled = true;

const AUTOBING_BACKGROUND_URLS = new Set([
  "https://github.com/fastdemo",
]);
const UNSAFE_DOWNLOAD_EXTENSIONS = /\.(?:7z|apk|bin|crx|dmg|docx?|exe|gz|iso|jar|msi|pkg|rar|tar|xlsx?|zip)(?:$|[?#])/i;

function isSafeVisitUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password &&
      !UNSAFE_DOWNLOAD_EXTENSIONS.test(url.pathname + url.search)
    );
  } catch (error) {
    return false;
  }
}

function keepAutobingTabQuiet(tab) {
  if (!tab?.id || !AUTOBING_BACKGROUND_URLS.has(tab.pendingUrl || tab.url)) {
    return;
  }
  chrome.tabs.update(tab.id, { active: false, muted: true }).catch(() => {});
}

chrome.tabs.onCreated.addListener(keepAutobingTabQuiet);

// Autobing does not initiate downloads. Cancel any download attributed to the
// extension so a malformed or redirected automation URL cannot save a file.
chrome.downloads.onCreated.addListener((item) => {
  const isVisitTab =
    item.tabId === searchState.visitTabId ||
    (searchState.visitTabIds || []).includes(item.tabId);
  if (item.byExtensionId === chrome.runtime.id || isVisitTab) {
    chrome.downloads.cancel(item.id).catch(() => {});
  }
});

// Load user-customized word banks from chrome.storage.local
async function loadWordBanks() {
  await loadQueryPool();
  const result = await chrome.storage.local.get([
    ...WORD_BANK_STORAGE_KEYS,
    "searchCount",
  ]);
  searchCount = Number.isFinite(result.searchCount) ? result.searchCount : searchCount;
  wordBanks = {
    mood: normalizeWordBank(result.moodDescriptors, MOOD_DESCRIPTORS),
    category: normalizeWordBank(result.categories, CATEGORIES),
    detail: normalizeWordBank(result.extraDetails, EXTRA_DETAILS),
  };
  await ensurePoolFresh();
}

function normalizeWordBank(stored, fallback) {
  return Array.isArray(stored) && stored.length > 0 ? stored : fallback;
}

// Load the saved combination pool from chrome.storage.local
async function loadQueryPool() {
  const result = await chrome.storage.local.get("queryPool");
  if (result.queryPool) {
    queryPool = result.queryPool;
  }
}

// Persist the combination pool and current index to chrome.storage.local
async function persistQueryPool() {
  await chrome.storage.local.set({ queryPool: queryPool });
}

// Fingerprint of the exact word lists the current pool was built from
function poolFingerprint() {
  return JSON.stringify([wordBanks.mood, wordBanks.category, wordBanks.detail]);
}

// Total number of possible mood x category x detail combinations
function poolTotal() {
  return (
    wordBanks.mood.length * wordBanks.category.length * wordBanks.detail.length
  );
}

// Build a freshly shuffled index pool for the current word lists
function rebuildPool() {
  const total = poolTotal();
  const indices = new Array(total);
  for (let i = 0; i < total; i++) {
    indices[i] = i;
  }
  // Fisher-Yates shuffle
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  queryPool = {
    fingerprint: poolFingerprint(),
    indices: indices,
    currentQueryIndex: 0,
  };
}

// Rebuild the pool whenever the word lists change, or when pool is missing
async function ensurePoolFresh() {
  if (
    queryPool.fingerprint !== poolFingerprint() ||
    !Array.isArray(queryPool.indices) ||
    queryPool.indices.length !== poolTotal()
  ) {
    rebuildPool();
    await persistQueryPool();
  }
}

// Decode a pool index into a mood/category/detail combination
function decodeCombination(index) {
  const c = wordBanks.category.length;
  const d = wordBanks.detail.length;
  const detailIndex = index % d;
  const categoryIndex = Math.floor(index / d) % c;
  const moodIndex = Math.floor(index / (c * d));
  return `${wordBanks.mood[moodIndex]} ${wordBanks.category[categoryIndex]} ${wordBanks.detail[detailIndex]}`;
}

// Serve the next combination sequentially from the shuffled pool
function nextUniqueQuery() {
  if (!Array.isArray(queryPool.indices) || queryPool.indices.length === 0) {
    rebuildPool();
  }
  if (queryPool.currentQueryIndex >= queryPool.indices.length) {
    // Full cycle exhausted: reshuffle and start a fresh cycle
    for (let i = queryPool.indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = queryPool.indices[i];
      queryPool.indices[i] = queryPool.indices[j];
      queryPool.indices[j] = tmp;
    }
    queryPool.currentQueryIndex = 0;
  }
  const index = queryPool.indices[queryPool.currentQueryIndex];
  queryPool.currentQueryIndex++;
  return decodeCombination(index);
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
  searchStartTime: null,
  nextSearchTime: null,
  endless: false,
  searchMethod: "searchBox",
  visitResults: false,
  pendingResultVisit: false,
  resultVisitScheduled: false,
  visitTabId: null,
  visitTabIds: [],
  visitCloseScheduled: false,
  completionPending: false,
};

const ALARM_NAME = "searchAlarm";
const VISIT_RESULT_ALARM_NAME = "visitResultAlarm";
const VISIT_CLOSE_ALARM_NAME = "visitCloseAlarm";

// Save state to chrome.storage.local for persistence
async function saveState() {
  await chrome.storage.local.set({ searchState: searchState });
}

// Load state from chrome.storage.local
async function loadState() {
  const result = await chrome.storage.local.get([
    "searchState",
    "ramSaverEnabled",
    "brandingEnabled",
  ]);
  if (result.searchState) {
    searchState = result.searchState;
    searchState.searchMethod =
      result.searchState.searchMethod === "url" ? "url" : "searchBox";
  }
  ramSaverEnabled = result.ramSaverEnabled === true;
  brandingEnabled = result.brandingEnabled !== false;
}

// Helper functions
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
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

async function scheduleNextSearch() {
  const delayInMinutes = randomDelay() / 60000;
  searchState.nextSearchTime = Date.now() + delayInMinutes * 60000;
  searchState.completionPending =
    !searchState.endless &&
    searchState.currentSearch >= searchState.totalSearches;
  await saveState();
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: Math.max(delayInMinutes, 0.1),
  });
}

async function scheduleResultVisit() {
  searchState.pendingResultVisit = true;
  searchState.resultVisitScheduled = false;
  await saveState();
  await armResultVisit(searchState.tabId);
}

async function finishResultVisit() {
  if (!searchState.isRunning) return;
  closeVisitTab();
  searchState.pendingResultVisit = false;
  searchState.resultVisitScheduled = false;
  searchState.visitTabId = null;
  searchState.visitCloseScheduled = false;
  await scheduleNextSearch();
}

function closeVisitTab() {
  const tabIds = new Set(searchState.visitTabIds || []);
  if (searchState.visitTabId) tabIds.add(searchState.visitTabId);
  tabIds.forEach((tabId) => chrome.tabs.remove(tabId).catch(() => {}));
  searchState.visitTabId = null;
  searchState.visitTabIds = [];
  searchState.visitCloseScheduled = false;
}

async function armResultVisit(tabId) {
  await loadState();
  if (
    !searchState.isRunning ||
    !searchState.pendingResultVisit ||
    searchState.resultVisitScheduled ||
    searchState.tabId !== tabId
  ) {
    return false;
  }

  searchState.resultVisitScheduled = true;
  const delaySeconds = 5 + Math.floor(Math.random() * 6);
  await saveState();
  await chrome.alarms.create(VISIT_RESULT_ALARM_NAME, {
    delayInMinutes: delaySeconds / 60,
  });
  return true;
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

  const query = nextUniqueQuery();

  // Save the current pool index after every generated query
  await persistQueryPool();

  try {
    if (searchState.searchMethod === "searchBox") {
      const result = await chrome.tabs.sendMessage(searchState.tabId, {
        type: "searchByBox",
        query,
      });
      if (result?.success !== true) {
        throw new Error("Bing search box was not available");
      }
    } else {
      const searchUrl = config.bing.url
        .replace("{q}", encodeURIComponent(query))
        .replace("{form}", config.bing.form)
        .replace("{cvid}", "");
      console.log("Open new search at:", searchUrl);
      await chrome.tabs.update(searchState.tabId, { url: searchUrl });
    }
  } catch (error) {
    console.error("Error updating tab:", error);
    stopSearches();
    return;
  }

  searchState.currentSearch++;
  searchCount++;
  chrome.storage.local.set({ searchCount }).catch(() => {});
  const progress =
    searchState.totalSearches > 0
      ? parseInt(
          (searchState.currentSearch / searchState.totalSearches) * 100,
        )
      : 0;

  const shouldVisitResult =
    searchState.visitResults === true && searchState.currentSearch % 5 === 0;

  if (shouldVisitResult) {
    // Let the target page report when its results have loaded before waiting
    // and clicking, so Eco Mode can be temporarily lifted only in that tab.
    await scheduleResultVisit();
  } else {
    await scheduleNextSearch();
  }

  // Notify the popup AFTER state is persisted so the bar never reads stale data
  notifyPopup({
    type: "progress",
    progress: progress,
    currentSearch: searchState.currentSearch,
    totalSearches: searchState.totalSearches,
    nextSearchTime: searchState.nextSearchTime,
    endless: searchState.endless,
    phase: searchState.phase,
  });
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
        endless: searchState.endless,
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

      if (searchState.endless) {
        // Endless mode: loop back to the desktop phase and keep going
        searchState.phase = "desktop";
        searchState.currentSearch = 0;
        searchState.totalSearches = searchState.desktopSearches;

        notifyPopup({
          type: "phaseChange",
          phase: "desktop",
          totalSearches: searchState.totalSearches,
          endless: searchState.endless,
        });

        await saveState();
        const delayInMinutes = randomDelay() / 60000;
        chrome.alarms.create(ALARM_NAME, {
          delayInMinutes: Math.max(delayInMinutes, 0.1),
        });
      } else {
        await completeSearches();
      }
    }
  }
}

// Complete all searches
async function completeSearches() {
  searchState.isRunning = false;

  notifyPopup({
    type: "complete",
  });

  // Restore normal page DOM before the batch is finished
  if (searchState.tabId) {
    chrome.tabs.sendMessage(searchState.tabId, { type: "ramSaverOff" }).catch(() => {});
  }
  closeVisitTab();

  // Open GitHub profile once the full run finishes
  chrome.tabs.create({
    url: "https://github.com/fastdemo",
    active: false,
  }).then(keepAutobingTabQuiet).catch(() => {});

  // Reset state
  searchState = {
    ...searchState,
    isRunning: false,
    currentSearch: 0,
    totalSearches: 0,
    tabId: null,
    searchType: null,
    phase: null,
    searchStartTime: null,
    nextSearchTime: null,
    endless: false,
    visitResults: false,
    pendingResultVisit: false,
    resultVisitScheduled: false,
    visitTabId: null,
    visitTabIds: [],
    visitCloseScheduled: false,
    completionPending: false,
  };

  // Clear alarm and saved state
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.clear(VISIT_RESULT_ALARM_NAME);
  chrome.alarms.clear(VISIT_CLOSE_ALARM_NAME);
  await chrome.storage.local.remove("searchState");
}

// Stop searches
async function stopSearches() {
  searchState.isRunning = false;

  notifyPopup({
    type: "stopped",
  });

  // Restore normal page DOM immediately so browsing is unblocked
  if (searchState.tabId) {
    chrome.tabs.sendMessage(searchState.tabId, { type: "ramSaverOff" }).catch(() => {});
  }
  closeVisitTab();

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
    visitResults: false,
    pendingResultVisit: false,
    resultVisitScheduled: false,
    visitTabId: null,
    visitTabIds: [],
    visitCloseScheduled: false,
    completionPending: false,
  };

  // Clear alarm and saved state
  chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.clear(VISIT_RESULT_ALARM_NAME);
  chrome.alarms.clear(VISIT_CLOSE_ALARM_NAME);
  await chrome.storage.local.remove("searchState");
}

// Stop an active run when its target tab is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await loadState();
  if (searchState.isRunning && searchState.tabId === tabId) {
    await stopSearches();
  }
  if (searchState.visitTabId === tabId) {
    searchState.visitTabId = null;
  }
  searchState.visitTabIds = (searchState.visitTabIds || []).filter(
    (id) => id !== tabId,
  );
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (
    !tab.id ||
    !searchState.isRunning ||
    !searchState.pendingResultVisit ||
    tab.openerTabId !== searchState.tabId
  ) {
    return;
  }

  searchState.visitTabId = tab.id;
  searchState.visitTabIds = [...new Set([...(searchState.visitTabIds || []), tab.id])];
  chrome.tabs.update(tab.id, { active: false, muted: true }).catch(() => {});
  await saveState();
  chrome.tabs
    .sendMessage(tab.id, {
        type: "visitTabOn",
        ecoMode: ramSaverEnabled === true,
        branding: brandingEnabled === true,
    })
    .catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    armResultVisit(tabId).catch(() => {});
  }
});

// Start searches
async function startSearches(type, settings) {
  if (searchState.isRunning) {
    return { success: false, error: "Searches already running" };
  }

  const tabId = await getTabId();

  // Blank the search page immediately if RAM Saver Mode is on (the content
  // script also self-activates via storage after each navigation)
  if (ramSaverEnabled) {
    chrome.tabs.sendMessage(tabId, { type: "ramSaverOn" }).catch(() => {});
  }

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
    searchStartTime: Date.now(),
    nextSearchTime: null,
    endless: settings.endless === true,
    searchMethod: settings.searchMethod === "searchBox" ? "searchBox" : "url",
    visitResults: settings.visitResults === true,
    pendingResultVisit: false,
    resultVisitScheduled: false,
    visitTabId: null,
    visitTabIds: [],
    visitCloseScheduled: false,
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
  if (alarm.name === VISIT_CLOSE_ALARM_NAME) {
    await loadState();
    await finishResultVisit();
    return;
  }

  if (alarm.name === VISIT_RESULT_ALARM_NAME) {
    await loadState();
    if (
      searchState.isRunning &&
      searchState.pendingResultVisit &&
      searchState.tabId
    ) {
      chrome.tabs
        .sendMessage(searchState.tabId, { type: "visitSearchResult" })
        .then(async () => {
          searchState.visitCloseScheduled = true;
          await saveState();
          chrome.alarms.create(VISIT_CLOSE_ALARM_NAME, {
            delayInMinutes: 10 / 60,
          });
        })
        .catch(async () => {
          searchState.visitCloseScheduled = true;
          await saveState();
          chrome.alarms.create(VISIT_CLOSE_ALARM_NAME, {
            delayInMinutes: 10 / 60,
          });
        });
    }
    return;
  }

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
  if (message.type === "openVisitResult") {
    const sourceTab = sender.tab;
    if (
      !sourceTab?.id ||
      !searchState.isRunning ||
      !searchState.pendingResultVisit ||
      searchState.tabId !== sourceTab.id ||
      !isSafeVisitUrl(message.url)
    ) {
      sendResponse({ success: false });
      return false;
    }

    chrome.tabs.create({
      windowId: sourceTab.windowId,
      url: message.url,
      active: false,
      openerTabId: sourceTab.id,
    }).then((tab) => {
      chrome.tabs.update(tab.id, { active: false, muted: true })
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: true }));
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true;
  }

  if (message.type === "searchPageReady") {
    armResultVisit(sender.tab?.id).then((scheduled) => {
      sendResponse({ success: true, scheduled });
    });
    return true;
  }

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
        progress:
          searchState.totalSearches > 0
            ? parseInt(
                (searchState.currentSearch / searchState.totalSearches) * 100,
              )
            : 0,
        phase: searchState.phase,
        searchType: searchState.searchType,
        searchStartTime: searchState.searchStartTime,
        nextSearchTime: searchState.nextSearchTime,
        endless: searchState.endless,
      });
    });
    return true; // Indicates async response
  }

  if (message.type === "getRamSaverState") {
    loadState().then(() => {
      const tabId = sender.tab?.id;
      const isRunTab = searchState.tabId === tabId;
      const isVisitTab =
        searchState.visitTabId === tabId ||
        (searchState.visitTabIds || []).includes(tabId);
      sendResponse({
        active: ramSaverEnabled === true && searchState.isRunning && isRunTab,
        branded:
          brandingEnabled === true &&
          searchState.isRunning &&
          (isRunTab || isVisitTab),
        eco: ramSaverEnabled === true && searchState.isRunning && (isRunTab || isVisitTab),
      });
    });
    return true;
  }

  if (message.type === "resetPool") {
    // Re-read word lists and rebuild a fresh shuffled pool from index 0
    loadWordBanks().then(() => {
      rebuildPool();
      persistQueryPool().then(() => {
        sendResponse({ success: true });
      });
    });
    return true; // Indicates async response
  }
});

// Re-index the pool safely whenever word lists are edited in Settings
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const keys = Object.keys(changes);
  if (keys.some((key) => WORD_BANK_STORAGE_KEYS.includes(key))) {
    loadWordBanks();
  }
  if (changes.ramSaverEnabled) {
    ramSaverEnabled = changes.ramSaverEnabled.newValue === true;
    if (searchState.isRunning && searchState.tabId) {
      chrome.tabs
        .sendMessage(searchState.tabId, {
          type: ramSaverEnabled ? "ramSaverOn" : "ramSaverOff",
        })
        .catch(() => {});
    }
  }
  if (changes.brandingEnabled) {
    brandingEnabled = changes.brandingEnabled.newValue !== false;
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

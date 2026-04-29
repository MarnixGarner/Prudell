/* ------------------------------------------------------------
   PRUDELL COOKIE BANNER
   HubSpot chat + analytics — single consent controller
   v4: consent-before-script, widget loaded exactly once
------------------------------------------------------------ */
const PRUD_TEMP_DISABLE_HUBSPOT_CONSENT = false;
const PRUD_HUBSPOT_DEBUG = false;
const PRUD_STORAGE_KEY = "prudell_cookie_consent";
const PRUD_HUBSPOT_SRC = "//js-eu1.hs-scripts.com/147587338.js";
const PRUD_HUBSPOT_SCRIPT_TOKEN = "hs-scripts.com/147587338.js";
const PRUD_REQUIRE_INTERACTION_FOR_HUBSPOT = true;
const PRUD_HUBSPOT_FALLBACK_DELAY_MS = 8000;
const PRUD_INITIAL_COOKIE_BANNER_DELAY_MS = 800;

// Always set this as early as possible to avoid eager widget loading.
window.hsConversationsSettings = Object.assign(
  {},
  window.hsConversationsSettings || {},
  { loadImmediately: false }
);

/* ---------- helpers ---------- */
function hsDebugLog(event, data) {
  if (!PRUD_HUBSPOT_DEBUG) return;
  if (typeof console === "undefined") return;
  console.log("[Prudell HubSpot]", event, data || "");
}

function readStoredConsent() {
  try { return JSON.parse(localStorage.getItem(PRUD_STORAGE_KEY)); }
  catch (e) { return null; }
}

function isChatConsentEnabledNow() {
  var c = readStoredConsent();
  return !!(c && c.hsChat === true);
}

function hasHubSpotScriptTag() {
  return Array.from(document.querySelectorAll("script[src]")).some(function (s) {
    return (s.getAttribute("src") || "").indexOf(PRUD_HUBSPOT_SCRIPT_TOKEN) !== -1;
  });
}

function removeDuplicateHubSpotScripts() {
  var scripts = Array.from(document.querySelectorAll("script[src]")).filter(function (s) {
    return (s.getAttribute("src") || "").indexOf(PRUD_HUBSPOT_SCRIPT_TOKEN) !== -1;
  });

  if (scripts.length <= 1) return;

  scripts.slice(1).forEach(function (s) {
    if (s.parentNode) s.parentNode.removeChild(s);
  });

  hsDebugLog("duplicate-hubspot-scripts-removed", {
    removed: scripts.length - 1,
    remaining: 1
  });
}

function removeHubSpotScripts() {
  Array.from(document.querySelectorAll("script[src], script[id]")).forEach(function (s) {
    var src = String(s.getAttribute("src") || "");
    var id = String(s.id || "");

    var isHubSpotScript =
      src.indexOf("hs-scripts.com") !== -1 ||
      src.indexOf("hubspot") !== -1 ||
      id === "hs-script-loader" ||
      id === "hs-analytics" ||
      id === "hubspot-messages-loader" ||
      id.indexOf("cookieBanner-") === 0 ||
      id.indexOf("CollectedForms-") === 0;

    if (isHubSpotScript && s.parentNode) {
      s.parentNode.removeChild(s);
    }
  });
}

function removeHubSpotRuntimeArtifacts() {
  var selectors = [
    "#hubspot-messages-iframe-container",
    "#hubspot-conversations-iframe",
    "iframe[id^='hubspot-']",
    "iframe[src*='hubspot']",
    "div[class*='hubspot']",
    "div[id^='hubspot-']"
  ];

  selectors.forEach(function (sel) {
    Array.from(document.querySelectorAll(sel)).forEach(function (el) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  });
}

function removeHubSpotWhenDisabled() {
  try {
    if (
      window.HubSpotConversations &&
      window.HubSpotConversations.widget &&
      window.HubSpotConversations.widget.remove
    ) {
      window.HubSpotConversations.widget.remove();
    }
  } catch (e) {}

  window.__prudWidgetLoadDone = false;
  window.__prudHsCoreRequested = false;
  removeHubSpotRuntimeArtifacts();
  removeHubSpotScripts();
}

function onFirstInteractionOrTimeout(callback) {
  if (!PRUD_REQUIRE_INTERACTION_FOR_HUBSPOT) {
    callback();
    return;
  }

  if (window.__prudHubSpotInteractionReady) {
    callback();
    return;
  }

  window.__prudHubSpotGateCallbacks = window.__prudHubSpotGateCallbacks || [];
  window.__prudHubSpotGateCallbacks.push(callback);

  if (window.__prudHubSpotGateInstalled) {
    return;
  }
  window.__prudHubSpotGateInstalled = true;

  var fired = false;

  function done(reason) {
    if (fired) return;
    fired = true;
    window.__prudHubSpotInteractionReady = true;

    events.forEach(function (evt) {
      window.removeEventListener(evt, onInteraction, opts);
    });

    clearTimeout(fallbackTimer);
    hsDebugLog("hubspot-interaction-gate-open", { reason: reason });

    var queued = window.__prudHubSpotGateCallbacks || [];
    window.__prudHubSpotGateCallbacks = [];
    queued.forEach(function (fn) {
      try { fn(); } catch (e) {}
    });
  }

  function onInteraction() {
    done("interaction");
  }

  var opts = { passive: true };
  var events = ["pointerdown", "keydown", "touchstart", "scroll"];

  events.forEach(function (evt) {
    window.addEventListener(evt, onInteraction, opts);
  });

  var fallbackTimer = setTimeout(function () {
    done("timeout");
  }, PRUD_HUBSPOT_FALLBACK_DELAY_MS);
}

function installHubSpotScriptDeduper() {
  if (window.__prudHsDeduperInstalled) return;
  window.__prudHsDeduperInstalled = true;

  removeDuplicateHubSpotScripts();

  var observer = new MutationObserver(function () {
    removeDuplicateHubSpotScripts();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  hsDebugLog("hubspot-script-deduper-installed");
}

/* ---------- HubSpot core ---------- */
function initAndLoadHubSpotScript() {
  if (window.__prudHsCoreRequested) return;

  onFirstInteractionOrTimeout(function () {
    if (window.__prudHsCoreRequested) return;
    window.__prudHsCoreRequested = true;

    installHubSpotScriptDeduper();

    /* prevent HubSpot auto-loading chat before consent is processed */
    window.hsConversationsSettings = Object.assign(
      {},
      window.hsConversationsSettings || {},
      { loadImmediately: false }
    );
    window.hsConversationsOnReady = window.hsConversationsOnReady || [];
    hsDebugLog("consent-api-not-used");

    if (!hasHubSpotScriptTag()) {
      var s = document.createElement("script");
      s.src = PRUD_HUBSPOT_SRC;
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
      hsDebugLog("hubspot-script-injected");
    }
  });
}

/* ---------- widget load — called at most ONCE per page ---------- */
function scheduleWidgetLoad() {
  if (window.__prudWidgetLoadDone) {
    hsDebugLog("widget-load-already-done");
    return;
  }

  if (window.HubSpotConversations && window.HubSpotConversations.widget) {
    /* SDK already ready — load directly */
    if (isChatConsentEnabledNow()) {
      window.__prudWidgetLoadDone = true;
      window.HubSpotConversations.widget.load();
      hsDebugLog("widget-load-direct");
    } else {
      hsDebugLog("widget-load-skipped-no-consent");
    }
  } else {
    /* SDK not ready yet — queue once */
    window.hsConversationsOnReady = window.hsConversationsOnReady || [];
    window.hsConversationsOnReady.push(function () {
      if (window.__prudWidgetLoadDone) return;
      if (!isChatConsentEnabledNow()) {
        hsDebugLog("widget-onready-skipped-no-consent");
        return;
      }
      if (window.HubSpotConversations && window.HubSpotConversations.widget && window.HubSpotConversations.widget.load) {
        window.__prudWidgetLoadDone = true;
        window.HubSpotConversations.widget.load();
        hsDebugLog("widget-load-via-onready");
      }
    });
    hsDebugLog("widget-load-queued-onready");
  }
}

/* ---------- main consent application ---------- */
function applyHubSpotConsent(consent) {
  if (!consent || PRUD_TEMP_DISABLE_HUBSPOT_CONSENT) return;

  hsDebugLog("apply-consent", consent);

  var needsHubSpot = !!(consent.hsChat || consent.hsAnalytics);

  if (needsHubSpot) {
    if (!window.__prudHsCoreRequested) {
      /* first time — push consent then load script */
      initAndLoadHubSpotScript();
    } else {
      hsDebugLog("hubspot-core-already-requested");
    }

    if (consent.hsChat) {
      scheduleWidgetLoad();
    } else {
      /* analytics only — remove chat widget if present */
      if (window.HubSpotConversations && window.HubSpotConversations.widget && window.HubSpotConversations.widget.remove) {
        window.__prudWidgetLoadDone = false;
        window.HubSpotConversations.widget.remove();
        hsDebugLog("widget-removed");
      }
    }
  } else {
    /* all off */
    hsDebugLog("chat-disabled-by-consent");
    removeHubSpotWhenDisabled();
    hsDebugLog("widget-removed");
  }
}

/* ---------- banner IIFE ---------- */
(function () {
  if (window.__prudCookieBannerInitDone) {
    hsDebugLog("cookie-banner-init-skipped-duplicate");
    return;
  }
  window.__prudCookieBannerInitDone = true;

  var TEST_MODE =
    typeof window.PRUD_COOKIE_TEST_MODE === "boolean"
      ? window.PRUD_COOKIE_TEST_MODE
      : false;

  var overlay = document.getElementById("pop-up-cookie-window");
  var banner  = document.getElementById("cookie-form");
  var prefs   = document.getElementById("cookie-form-preferences");

  if (!overlay || !banner || !prefs) return;

  var acceptAllBtn = document.getElementById("cookie-accept-all");
  var rejectAllBtn = document.getElementById("cookie-reject-all");
  var manageBtn    = document.getElementById("cookie-manage-pref");
  var saveBtn      = document.getElementById("cookie-save-preferences");
  var closeBtn     = document.getElementById("pop-up-cookie-close");
  var footerLink   = document.getElementById("cookie-preferences");

  var wfAnalyticsToggle = document.getElementById("analytic-cookies");
  var hsAnalyticsToggle = document.getElementById("hs-analytic-cookies");
  var hsChatToggle      = document.getElementById("hubspot-cookies");

  function getConsent() {
    if (TEST_MODE) return null;
    try { return JSON.parse(localStorage.getItem(PRUD_STORAGE_KEY)); }
    catch { return null; }
  }

  function syncPreferenceToggles(c) {
    var consent = c || getConsent() || { wfAnalytics: false, hsAnalytics: false, hsChat: false };
    if (wfAnalyticsToggle) wfAnalyticsToggle.checked = !!consent.wfAnalytics;
    if (hsAnalyticsToggle) hsAnalyticsToggle.checked = !!consent.hsAnalytics;
    if (hsChatToggle)      hsChatToggle.checked      = !!consent.hsChat;
  }

  function setConsent(v) {
    hsDebugLog("set-consent", v);
    if (!TEST_MODE) {
      localStorage.setItem(PRUD_STORAGE_KEY, JSON.stringify(v));
    }
    syncPreferenceToggles(v);
    applyHubSpotConsent(v);
  }

  function showBanner() {
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    prefs.style.display = "none";
    banner.style.display = "block";
    banner.classList.remove("is-visible");
    banner.offsetHeight;
    banner.classList.add("is-visible");
  }

  function showPrefs() {
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";
    banner.style.display = "none";
    prefs.style.display = "block";
    syncPreferenceToggles();
  }

  function hideAll() {
    banner.classList.remove("is-visible");
    overlay.style.display = "none";
    overlay.style.pointerEvents = "none";
    banner.style.display = "none";
    prefs.style.display = "none";
  }

  function showBannerDeferred() {
    window.setTimeout(function () {
      showBanner();
    }, PRUD_INITIAL_COOKIE_BANNER_DELAY_MS);
  }

  var existing = getConsent();
  if (!existing || TEST_MODE) {
    syncPreferenceToggles();
    showBannerDeferred();
  } else {
    syncPreferenceToggles(existing);
    applyHubSpotConsent(existing);
    hideAll();
  }

  if (acceptAllBtn) acceptAllBtn.addEventListener("click", function () {
    setConsent({ wfAnalytics: true, hsAnalytics: true, hsChat: true });
    hideAll();
  });

  if (rejectAllBtn) rejectAllBtn.addEventListener("click", function () {
    setConsent({ wfAnalytics: false, hsAnalytics: false, hsChat: false });
    hideAll();
  });

  if (manageBtn) manageBtn.addEventListener("click", showPrefs);

  if (saveBtn) saveBtn.addEventListener("click", function () {
    setConsent({
      wfAnalytics: wfAnalyticsToggle ? wfAnalyticsToggle.checked : false,
      hsAnalytics: hsAnalyticsToggle ? hsAnalyticsToggle.checked : false,
      hsChat:      hsChatToggle      ? hsChatToggle.checked      : false,
    });
    hideAll();
  });

  if (closeBtn) closeBtn.addEventListener("click", function () {
    setConsent({
      wfAnalytics: wfAnalyticsToggle ? wfAnalyticsToggle.checked : false,
      hsAnalytics: hsAnalyticsToggle ? hsAnalyticsToggle.checked : false,
      hsChat:      hsChatToggle      ? hsChatToggle.checked      : false,
    });
    hideAll();
  });

  if (footerLink) footerLink.addEventListener("click", function (e) {
    e.preventDefault();
    showPrefs();
  });
})();

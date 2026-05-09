/* ------------------------------------------------------------
   PRUDELL CALCULATORS ON-DEMAND LOADER
   Load Calculators.js only when a popup/calculator action is attempted.
   Keep this file globally loaded; remove any static Calculators.js include.
------------------------------------------------------------ */
(function () {
  var SCRIPT_VERSION = "2026-05-09-1";
  var SCRIPT_SRC = "https://cdn.jsdelivr.net/gh/MarnixGarner/Prudell@main/Calculators.js?v=" + SCRIPT_VERSION;
  var SCRIPT_KEY = "__PRUDELL_MAIN_SCRIPT_LOADED__";

  var scriptsLoaded = false;
  var loading = false;
  var pendingTrigger = null;

  function calculatorApiReady() {
    return typeof window.initCalculatorByTarget === "function";
  }

  function waitForCalculatorApi(done) {
    var maxChecks = 80; // ~2s at 25ms interval
    var checks = 0;

    (function tick() {
      if (calculatorApiReady()) {
        scriptsLoaded = true;
        if (done) done();
        return;
      }

      checks += 1;
      if (checks >= maxChecks) {
        if (done) done();
        return;
      }

      setTimeout(tick, 25);
    })();
  }

  function getCalculatorScriptTags() {
    return Array.from(document.querySelectorAll("script[src]")).filter(function (s) {
      return String(s.getAttribute("src") || "").indexOf("/Calculators.js") !== -1;
    });
  }

  function hasAnyCalculatorScriptTag() {
    return getCalculatorScriptTags().length > 0;
  }

  function hasDesiredCalculatorScriptTag() {
    return getCalculatorScriptTags().some(function (s) {
      return String(s.getAttribute("src") || "").indexOf("v=" + SCRIPT_VERSION) !== -1;
    });
  }

  function isLikelyCalculatorTrigger(el) {
    if (!el) return false;

    var id = String(el.id || "");
    var target = String(el.getAttribute("data-open-form") || "");

    // Calculator/adviser IDs used across Prudell
    var idPattern = /^(bp|mf|mr|repay|sd|ip|ma|ra)(-|$)/i;

    // Calculator popup targets only. Adviser/general forms are handled by Prudell-Forms.js.
    var openFormTargets = {
      "Borrowing-Power-Calc": true,
      "Affordability-Calc": true,
      "Repayment-Calc": true,
      "Repayment-Calc-2": true,
      "Stamp-Duty-Calc": true,
      "Mortgage-Finder-Calc": true,
      "Mortgage-Refinance-Calc": true,
      "Insurance-Protection-Calc": true,
      "Risk-Assessment-Calc": true
    };

    return idPattern.test(id) || !!openFormTargets[target];
  }

  function loadCalculatorsScript(done) {
    if (scriptsLoaded && calculatorApiReady()) {
      if (done) done();
      return;
    }

    // If the desired version is already on the page, wait for API readiness.
    if (hasDesiredCalculatorScriptTag() && !loading) {
      loading = true;
      waitForCalculatorApi(function () {
        loading = false;
        if (done) done();

        if (pendingTrigger) {
          var replay = pendingTrigger;
          pendingTrigger = null;
          replay();
        }
      });
      return;
    }

    // If an older/static Calculators.js include is present, force a clean reload
    // of the desired version instead of treating the stale tag as valid.
    if (hasAnyCalculatorScriptTag() && !hasDesiredCalculatorScriptTag()) {
      window[SCRIPT_KEY] = false;
    }

    if (loading) {
      if (done) pendingTrigger = done;
      return;
    }

    loading = true;

    var s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.defer = true;

    s.onload = function () {
      waitForCalculatorApi(function () {
        loading = false;

        if (done) done();

        if (pendingTrigger) {
          var replay = pendingTrigger;
          pendingTrigger = null;
          replay();
        }
      });
    };

    s.onerror = function () {
      loading = false;
      pendingTrigger = null;
      // eslint-disable-next-line no-console
      console.error("[PRUDELL] Failed to load Calculators.js on demand");
    };

    document.body.appendChild(s);
  }

  function interceptAndLoad(e) {
    if (scriptsLoaded) return;

    var trigger = e.target && e.target.closest
      ? e.target.closest("[data-open-form], #bp-adviser, #mf-adviser, #mr-adviser, #repay-adviser, #sd-adviser, #ip-adviser, #ma-adviser, #ra-adviser")
      : null;

    if (!trigger) return;
    if (!isLikelyCalculatorTrigger(trigger)) return;

    if (trigger.dataset.prudellReplayOnce === "true") {
      trigger.dataset.prudellReplayOnce = "false";
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") {
      e.stopImmediatePropagation();
    }

    loadCalculatorsScript(function () {
      trigger.dataset.prudellReplayOnce = "true";
      trigger.click();
    });
  }

  // Start script load slightly earlier on touch/mouse down for better UX.
  document.addEventListener("pointerdown", interceptAndLoad, true);
  document.addEventListener("click", interceptAndLoad, true);
})();

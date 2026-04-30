/* ------------------------------------------------------------
   PRUDELL CALCULATORS ON-DEMAND LOADER
   Load Calculators.js only when a popup/calculator action is attempted.
   Keep this file globally loaded; remove any static Calculators.js include.
------------------------------------------------------------ */
(function () {
  var SCRIPT_SRC = "https://cdn.jsdelivr.net/gh/MarnixGarner/Prudell@main/Calculators.js";

  var scriptsLoaded = false;
  var loading = false;
  var pendingTrigger = null;

  function hasCalculatorScriptTag() {
    return Array.from(document.querySelectorAll("script[src]")).some(function (s) {
      return String(s.getAttribute("src") || "").indexOf("/Calculators.js") !== -1;
    });
  }

  function isLikelyCalcOrPopupTrigger(el) {
    if (!el) return false;

    var id = String(el.id || "");
    var target = String(el.getAttribute("data-open-form") || "");

    // Calculator/adviser IDs used across Prudell
    var idPattern = /^(bp|mf|mr|repay|sd|ip|ma|ra)(-|$)/i;

    // Includes calculators + adviser/general-enquiry popup targets.
    var openFormTargets = {
      "Borrowing-Power-Calc": true,
      "Affordability-Calc": true,
      "Repayment-Calc": true,
      "Repayment-Calc-2": true,
      "Stamp-Duty-Calc": true,
      "Mortgage-Finder-Calc": true,
      "Mortgage-Refinance-Calc": true,
      "Insurance-Protection-Calc": true,
      "Risk-Assessment-Calc": true,
      "Request-Adviser-Contact": true,
      "General-Enquiry": true,
      "General-Enquiries": true
    };

    return idPattern.test(id) || !!openFormTargets[target];
  }

  function loadCalculatorsScript(done) {
    if (scriptsLoaded || hasCalculatorScriptTag()) {
      scriptsLoaded = true;
      if (done) done();
      return;
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
      scriptsLoaded = true;
      loading = false;

      if (done) done();

      if (pendingTrigger) {
        var replay = pendingTrigger;
        pendingTrigger = null;
        replay();
      }
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
    if (!isLikelyCalcOrPopupTrigger(trigger)) return;

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

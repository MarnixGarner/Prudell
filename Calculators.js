window.Webflow = window.Webflow || [];
window.Webflow.push(function () {

  /* ===== GLOBAL CALCULATOR SAFETY GUARD (SCRIPT-SCOPED) ===== */

  const PRUDELL_SCRIPT_KEY = "__PRUDELL_MAIN_SCRIPT_LOADED__";

  const IS_REBIND =
    window[PRUDELL_SCRIPT_KEY] && !window.Webflow?.env?.design;

  window[PRUDELL_SCRIPT_KEY] = true;

  if (IS_REBIND) {
    console.warn("[PRUDELL] Script already initialised — skipping rebind");
    return;
  }

  /* ===== GLOBAL CALCULATOR SAFETY GUARD — END ===== */

  /* ===== DEBUG MODE =====
     Toggle to true when diagnosing issues
  ------------------------------------- */
  const PRUDELL_DEBUG = false; // set true only for diagnostics
  /* ===== DEBUG MODE — END ===== */

  function debug() {
    if (!PRUDELL_DEBUG) return;
    console.log.apply(console, ["[PRUDELL]", ...arguments]);
  }

  const getAdvisorField = function (selector) {
    if (typeof window.getAdvisorField !== "function") return null;
    return window.getAdvisorField(selector);
  };

  const resetAdvisorForm = function (clearMetaContext) {
    if (typeof window.resetAdvisorForm === "function") {
      window.resetAdvisorForm(clearMetaContext);
    }
  };

  const populateAdvisorMeta = function () {
    if (typeof window.populateAdvisorMeta === "function") {
      window.populateAdvisorMeta();
    }
  };

  const openAdvisorFormFromCalculator = function (triggerEl) {
    if (typeof window.openAdvisorFormFromCalculator === "function") {
      window.openAdvisorFormFromCalculator(triggerEl);
    }
  };

  function describeTriggerElement(el) {
    if (!el) return { exists: false };
    return {
      exists: true,
      tag: (el.tagName || "").toLowerCase(),
      id: el.id || "",
      dataOpenForm: el.getAttribute?.("data-open-form") || "",
      classes: el.className || "",
      href: el.getAttribute?.("href") || ""
    };
  }

  /* ===== DEFENSIVE DOM GUARDS (GLOBAL) ===== */

  function mustGet(id, scope = document) {
    const el =
      scope === document
        ? document.getElementById(id)
        : scope.querySelector(`#${id}`);

    if (!el) {
      console.error(`[PRUDELL][MISSING ID] #${id}`);
      return null;
    }
    return el;
  }

  function guardInit(calcName, requiredIds) {
    let ok = true;
    requiredIds.forEach(id => {
      if (!document.getElementById(id)) {
        console.error(`[PRUDELL][${calcName}] Missing required ID → #${id}`);
        ok = false;
      }
    });

    if (!ok) {
      console.warn(`[PRUDELL][${calcName}] Initialisation aborted`);
    }
    return ok;
  }

  function setAdvisorMetaOnRoot(root, advisorName, advisorRole) {
    if (!root) return;

    const formSelectors = [
      '#advisor-request-form',
      '#contact-advisor-form',
      '#Advisor-Contact-Form',
      '#wf-form-Advisor-Callback-Form',
      'form[name="wf-form-Advisor-Request-Form"]',
      'form[name="wf-form-Contact-Advisor-Form"]',
      'form[name="wf-form-Advisor-Form"]',
      'form[name="wf-form-Advisor-Callback-Form"]'
    ];

    formSelectors.forEach(sel => {
      root.querySelectorAll(sel).forEach(form => {
        const nameEl = form.querySelector('input#Advisor-Name, input[name="Advisor-Name"], input[name="advisor_name"]');
        const roleEl = form.querySelector('input#Advisor-Role, input[name="Advisor-Role"], input[name="advisor_role"]');

        if (nameEl) {
          nameEl.value = advisorName || "";
          const nameWrap = nameEl.closest(".form-field-wrapper");
          if (nameWrap) nameWrap.style.display = advisorName ? "block" : "none";
        }

        if (roleEl) {
          roleEl.value = advisorRole || "";
          const roleWrap = roleEl.closest(".form-field-wrapper");
          if (roleWrap) roleWrap.style.display = advisorRole ? "block" : "none";
        }
      });
    });
  }

  function setAdvisorMetaEverywhere(advisorName, advisorRole) {
    const roots = [
      document,
      document.getElementById("Request-Adviser-Contact"),
      document.getElementById("Pop-Up-Advisor-Window")
    ];

    roots.forEach(root => setAdvisorMetaOnRoot(root, advisorName, advisorRole));
  }

  function injectWebflowFocusNormalization() {
    const styleId = "prud-webflow-focus-normalization";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .pop-up-form .w-input:focus,
      .pop-up-form .w-select:focus,
      .pop-up-form .text-field:focus,
      .pop-up-form textarea:focus,
      .pop-up-form input[type="number"]:focus,
      .pop-up-form input[type="text"]:focus,
      .pop-up-form input[type="email"]:focus,
      .pop-up-form input[type="tel"]:focus {
        outline: none !important;
        box-shadow: none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function makeDivButtonAccessible(el) {
    if (!el) return;

    const tag = (el.tagName || "").toLowerCase();
    const isNativeInteractive =
      tag === "button" ||
      tag === "a" ||
      tag === "input" ||
      tag === "select" ||
      tag === "textarea";

    if (isNativeInteractive) return;

    el.setAttribute("role", "button");

    if (!el.hasAttribute("tabindex")) {
      el.setAttribute("tabindex", "0");
    }

    if (el.dataset.prudKeyboardButtonBound === "true") return;
    el.dataset.prudKeyboardButtonBound = "true";

    el.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;

      e.preventDefault();
      this.click();
    });
  }

  function fmtGBP(v) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(v);
  }

  /* ===== REPAYMENT HELPER (MF / SHARED) ===== */
  function repaymentMonthly(P, annualRate, years) {
    const r = annualRate / 100 / 12;
    const n = years * 12;
    if (r <= 0 || n <= 0) return 0;
    return (P * r) / (1 - Math.pow(1 + r, -n));
  }
  /* ===== END REPAYMENT HELPER ===== */

  function norm(v) {
    return String(v || "")
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .trim();
  }

  function line(...args) {
    return args.filter(Boolean).join("\n");
  }

  function block(title){
    return "------------------------------------------------------------\n"
      + title
      + "\n------------------------------------------------------------\n";
  }

  function buildAdvisorSummary(resultsText, userInputText) {
    const separator = "------------------------------------------------------------";
    const cleanResults = String(resultsText || "").trim();
    const resultsBlock = cleanResults.startsWith(separator)
      ? cleanResults
      : `${separator}\n${cleanResults}`;

    return `
${resultsBlock}

${block("USER INPUT")}${String(userInputText || "").trim()}

${block("CUSTOMER DETAILS")}`;
  }

  // convert plain-text newlines into HTML breaks for Webflow's HTML email
  // (Webflow injects the summary into an HTML blob, which collapses \n).
  // if the form ever switches back to plaintext the <br> tags will render
  // literally, so this helper can be removed later.
  function htmlify(str) {
    const compact = String(str || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\n+$/g, "");

    return compact.replace(/\n/g, "<br>");
  }

  function scrollSmooth(el) {
    const box = el.closest(".pop-up-form");
    if (!box) return;
    setTimeout(() => {
      box.scrollTo({ top: el.offsetTop - 10, behavior: "smooth" });
    }, 40);
  }

  /* ===== GLOBAL NUMBER INPUT — AUTO-SELECT ON FOCUS ===== */
  document.addEventListener("focusin", ev => {
    const el = ev.target;
    if (el && el.tagName === "INPUT" && el.type === "number") {
      setTimeout(() => el.select(), 0);
    }
  });
  /* ===== END GLOBAL NUMBER INPUT FIX ===== */

  /* ===== 02. GLOBAL CURRENCY FORMATTING — CLEANED ===== */

  function bindCurrencyFormatting(container) {
    if (!container) return;

    const fields = container.querySelectorAll("input.currency");

    fields.forEach(input => {
      input.addEventListener("input", function () {
        let raw = this.value.replace(/[^\d]/g, "");
        this.value = raw ? Number(raw).toLocaleString("en-GB") : "";
      });

      input.addEventListener("focus", function () {
        if (this.value === "0") this.value = "";
      });

      input.addEventListener("blur", function () {
        let raw = this.value.replace(/[^\d]/g, "");
        if (!raw) return;
        this.value = Number(raw).toLocaleString("en-GB");
      });
    });
  }

  /* ===== 03. POPUP SYSTEM — CLEANED (WITH GUARDED INITS) ===== */

  let savedScrollY = 0;
  let bpInitialised = false; // Borrowing Power
  let maInitialised = false; // Affordability
  const repayInitialisedIds = new Set(); // Repayment (per panel)
  let sdInitialised = false; // Stamp Duty
  let mymInitialised = false; // Monitor Your Mortgage
  let mfInitialised = false; // Mortgage Finder
  let mrInitialised = false; // Mortgage Refinance
  let ipInitialised = false; // Insurance Protection
  let raInitialised = false; // Risk Assessment

  const DEFERRED_CALCULATOR_CONFIG = {
    "Borrowing-Power-Calc": {
      type: "borrowing",
      containerId: "calc-borrowing-container"
    },
    "Mortgage-Finder-Calc": {
      type: "mortgage-finder",
      containerId: "calc-mortgage-finder-container"
    },
    "Mortgage-Refinance-Calc": {
      type: "refinance",
      containerId: "calc-refinance-container"
    },
    "Insurance-Protection-Calc": {
      type: "insurance",
      containerId: "calc-insurance-container"
    },
    "Risk-Assessment-Calc": {
      type: "risk",
      containerId: "calc-risk-container"
    }
  };

  const DEFERRED_TYPE_TO_TARGET = Object.entries(DEFERRED_CALCULATOR_CONFIG).reduce(
    (acc, [targetId, cfg]) => {
      acc[cfg.type] = targetId;
      return acc;
    },
    {}
  );

  const deferredCalculatorPanels = new Map();

  function deferCalculatorPanels() {
    Object.entries(DEFERRED_CALCULATOR_CONFIG).forEach(([targetId, cfg]) => {
      if (deferredCalculatorPanels.has(targetId)) return;

      const panel = document.getElementById(targetId);
      if (!panel || !panel.parentNode) return;

      const parent = panel.parentNode;
      const nextSibling = panel.nextSibling;

      const placeholder = document.createElement("div");
      placeholder.id = cfg.containerId;
      placeholder.setAttribute("data-calc-placeholder", "true");
      placeholder.style.display = "none";

      parent.insertBefore(placeholder, panel);
      panel.remove();

      deferredCalculatorPanels.set(targetId, {
        panel,
        parent,
        nextSibling,
        placeholder,
        loaded: false
      });
    });
  }

  function ensureDeferredCalculatorPanel(targetId) {
    const record = deferredCalculatorPanels.get(targetId);
    if (!record) return document.getElementById(targetId);

    const existing = document.getElementById(targetId);
    if (existing) return existing;

    const parent =
      (record.placeholder && record.placeholder.parentNode) ||
      record.parent ||
      document.getElementById("animation-wrapper");

    if (!parent) return null;

    const insertBeforeNode =
      (record.placeholder && record.placeholder.nextSibling) || record.nextSibling || null;

    parent.insertBefore(record.panel, insertBeforeNode);
    record.loaded = true;

    if (record.placeholder) {
      record.placeholder.dataset.loaded = "true";
    }

    return record.panel;
  }

  function initCalculatorByTarget(targetId) {
    if (targetId === "Borrowing-Power-Calc" && !bpInitialised) {
      initBorrowingPower();
      bpInitialised = true;
      return;
    }

    if (targetId === "Affordability-Calc" && !maInitialised) {
      initAffordability();
      maInitialised = true;
      return;
    }

    if (
      (targetId === "Repayment-Calc" || targetId === "Repayment-Calc-2") &&
      !repayInitialisedIds.has(targetId)
    ) {
      initRepayment(targetId);
      repayInitialisedIds.add(targetId);
      return;
    }

    if (targetId === "Stamp-Duty-Calc" && !sdInitialised) {
      initStampDuty();
      sdInitialised = true;
      return;
    }

    if (
      targetId === "Monitor-your-Mortgage-Dashly" &&
      typeof initMonitorYourMortgage === "function" &&
      !mymInitialised
    ) {
      initMonitorYourMortgage();
      mymInitialised = true;
      return;
    }

    if (targetId === "Mortgage-Finder-Calc" && !mfInitialised) {
      initMortgageFinder();
      mfInitialised = true;
      return;
    }

    if (targetId === "Mortgage-Refinance-Calc" && !mrInitialised) {
      initMortgageRefinance();
      mrInitialised = true;
      return;
    }

    if (targetId === "Insurance-Protection-Calc" && !ipInitialised) {
      initInsuranceProtectionCalc();
      ipInitialised = true;
      return;
    }

    if (targetId === "Risk-Assessment-Calc" && !raInitialised) {
      initRiskAssessment();
      raInitialised = true;
    }
  }

  window.initCalculator = function (type) {
    const targetId = DEFERRED_TYPE_TO_TARGET[type];
    if (!targetId) return;
    ensureDeferredCalculatorPanel(targetId);
    initCalculatorByTarget(targetId);
  };

  window.ensureDeferredCalculatorPanel = ensureDeferredCalculatorPanel;
  window.initCalculatorByTarget = initCalculatorByTarget;

  /*
    NOTE (MF INITIAL STATE):
    -----------------------
    Mortgage Finder results are hidden via CSS:
      #mf-results { display: none; }
  
    JS must NOT pre-hide or defensively hide MF results.
    JS only reveals results after successful calculation.
  */

  // helper used to undo Webflow's post‑submission state (success/fail)
  function initBorrowingPower() {

    const wrap = document.getElementById("Borrowing-Power-Calc");
    if (!wrap) return;

    const form = wrap.querySelector("form");
    const results = wrap.querySelector("#results");
    const errorBox = wrap.querySelector("#bp-error-messages") || document.getElementById("bp-error-messages");

    bindCurrencyFormatting(form);
    results.style.display = "none";
    if (errorBox) {
      errorBox.style.display = "none";
      errorBox.innerHTML = "";
    }

    const income1 = form.querySelector("#income1");
    const income2 = form.querySelector("#income2");
    const other = form.querySelector("#other");
    const appType = form.querySelector("#app-type");
    const app2Wrap = form.querySelector("#bp-app2-wrap");

    const mult = form.querySelector("#multiple");
    const dep = form.querySelector("#deposit");
    const desired = form.querySelector("#prop-price");
    const calcBtn = form.querySelector("#calc");

    const outLoan = results.querySelector("#max-loan");
    const outExplain = results.querySelector("#explain");
    const outPurchase = results.querySelector("#purchase-example");

    app2Wrap.style.display = "none";

    function hideBorrowingPowerErrors() {
      if (!errorBox) return;
      errorBox.style.display = "none";
      errorBox.innerHTML = "";
    }

    function showBorrowingPowerErrors(errors) {
      if (!errorBox || !errors?.length) return;
      errorBox.innerHTML = errors.map(msg => `<div>${msg}</div>`).join("");
      errorBox.style.display = "block";

      /* Determine which field caused the error */
      let targetField = null;
      const inc1 = num(income1);
      const inc2 = num(income2);

      if (inc1 <= 0) {
        targetField = income1;
      } else if (appType.value === "joint" && inc2 <= 0) {
        targetField = income2;
      }

      focusErrorMessage(errorBox, targetField);
    }

    function validateBorrowingPowerInputs() {
      const errors = [];
      const inc1 = num(income1);
      const inc2 = num(income2);

      if (inc1 <= 0) {
        errors.push("Please enter <span class='semi-bold-text'>Applicant 1: Gross Annual Income</span> greater than £0.");
      }

      if (appType.value === "joint" && inc2 <= 0) {
        errors.push("Please enter <span class='semi-bold-text'>Applicant 2: Gross Annual Income</span> greater than £0 for joint applications.");
      }

      return errors;
    }

    /* ============ MASTER CALCULATION FUNCTION ============ */

    function runBorrowingPowerCalculation() {
      const validationErrors = validateBorrowingPowerInputs();
      if (validationErrors.length) {
        results.style.display = "none";
        hideBorrowingPowerErrors();
        showBorrowingPowerErrors(validationErrors);
        return;
      }

      hideBorrowingPowerErrors();

      const inc1 = num(income1);
      const inc2 = (appType.value === "joint") ? num(income2) : 0;
      const oth = num(other);

      const total = inc1 + inc2 + oth;
      const dp = num(dep);
      const des = num(desired);
      const mlt = num(mult, 4.5);

      const maxLoan = Math.round(total * mlt);
      const estPrice = maxLoan + dp;

      /* CLEAN OUTPUT — NO CLASSES ADDED */

      outLoan.textContent = fmtGBP(maxLoan);

      outExplain.innerHTML =
        `Based on a combined income of <span class="txt-amount">£${total.toLocaleString("en-GB")}</span>,
       using a multiplier of <span class="txt-amount">${mlt}</span>.`;

      if (des > 0) {
        const needed = des - dp;
        outPurchase.innerHTML =
          `Desired property: <span class="txt-amount">${fmtGBP(des)}</span>,
         deposit: <span class="txt-amount">${fmtGBP(dp)}</span>,
         required loan: <span class="txt-amount">${fmtGBP(needed)}</span>.`;
      } else {
        outPurchase.innerHTML =
          `With a deposit of <span class="txt-amount">${fmtGBP(dp)}</span>,
         your estimated max property price is <span class="txt-amount">${fmtGBP(estPrice)}</span>.`;
      }

      results.style.display = "block";

      /* ---- STATE STORAGE FOR ADVISER ---- */
      window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
      window.PRUD_CALC_STATE.borrowingPower = {
        inputs: {
          income1: inc1,
          income2: inc2,
          otherIncome: oth,
          deposit: dp,
          desiredPrice: des,
          multiplier: mlt,
          applicationType: appType.value
        },
        results: {
          maxLoan: outLoan.textContent,
          estimatedMaxPrice: estPrice
        }
      };

      scrollSmooth(results);
    }

    /* ========== EVENT LISTENERS ========== */

    /* ---- Calculate Button ---- */
    calcBtn.addEventListener("click", ev => {
      ev.preventDefault();
      runBorrowingPowerCalculation();
    });

    /* ---- Live Update Listeners ---- */
    income1.addEventListener("input", () => {
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    income2.addEventListener("input", () => {
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    other.addEventListener("input", () => {
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    mult.addEventListener("input", () => {
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    dep.addEventListener("input", () => {
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    desired.addEventListener("input", () => {
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    appType.addEventListener("change", () => {
      app2Wrap.style.display = appType.value === "joint" ? "block" : "none";
      hideBorrowingPowerErrors();
      if (results.style.display === "block") {
        runBorrowingPowerCalculation();
      }
    });

    income1.addEventListener("input", hideBorrowingPowerErrors);
    income2.addEventListener("input", hideBorrowingPowerErrors);

    document.getElementById("bp-reset").addEventListener("click", () => {
      form.reset();
      app2Wrap.style.display = "none";
      results.style.display = "none";
      hideBorrowingPowerErrors();
    });
  }

  /* ===== 05. AFFORDABILITY CALCULATOR — FINAL CLEAN FIXED VERSION ===== */


  function convertIncome(form, toMode) {
    const fields = [
      form.querySelector("#ma-inc1"),
      form.querySelector("#ma-inc2"),
      form.querySelector("#ma-other")
    ];

    fields.forEach(f => {
      if (!f) return;
      let value = num(f);
      if (!value) return;

      if (toMode === "annual") value *= 12;
      if (toMode === "monthly") value /= 12;

      f.value = Math.round(value).toLocaleString("en-GB");
    });
  }

  function initAffordability() {

    const wrap = document.getElementById("Affordability-Calc");
    if (!wrap) return;

    const form = wrap.querySelector("#afford-form");
    const results = wrap.querySelector("#ma-results");

    bindCurrencyFormatting(form);
    results.style.display = "none";

    /* ------------------- INCOME MODE SWITCH ------------------- */
    const monthlyBtn = form.querySelector("#freq-monthly");
    const annualBtn = form.querySelector("#freq-annual");

    form.dataset.frequency = "monthly";

    function activateMonthly() {
      monthlyBtn.classList.add("active-1");
      annualBtn.classList.remove("active-2");
    }
    function activateAnnual() {
      annualBtn.classList.add("active-2");
      monthlyBtn.classList.remove("active-1");
    }
    activateMonthly();

    /* ------------------- JOINT APPLICANT ------------------- */
    const appType = form.querySelector("#ma-app-type");
    const app2Wrap = form.querySelector("#ma-app2-wrap");

    app2Wrap.style.display = "none";

    /* ------------------- SIMPLE vs ADVANCED OUTGOINGS ------------------- */
    const simpleWrap = form.querySelector("#simple-monthly-outgoings");
    const advWrap = form.querySelector("#adv-outgoings-wrap");

    const simpleBtnWrap = form.querySelector("#simple-monthly-outgoings-button-wrapper");
    const advBtnWrap = form.querySelector("#advanced-monthly-outgoings-button-wrapper");

    const simpleBtn = form.querySelector("#simple-outgoings-button");
    const advBtn = form.querySelector("#adv-outgoings-button");

    advWrap.style.height = "0px";
    advWrap.style.overflow = "hidden";

    const advFields = [
      form.querySelector("#adv-bills"),
      form.querySelector("#adv-travel"),
      form.querySelector("#adv-food"),
      form.querySelector("#adv-kids"),
      form.querySelector("#adv-other"),
      form.querySelector("#adv-council"),
      form.querySelector("#adv-insurance"),
      form.querySelector("#adv-subscriptions")
    ];

    const advTotal = form.querySelector("#ma-monthly-outgoings-total");
    advTotal.readOnly = true;

    function updateAdvTotal() {
      const t = advFields.map(num).reduce((a, b) => a + b, 0);
      advTotal.value = t.toLocaleString("en-GB");
    }
    advFields.forEach(f => f.addEventListener("input", updateAdvTotal));

    advBtn.addEventListener("click", () => {
      simpleWrap.style.display = "none";
      simpleBtnWrap.style.display = "block";

      advBtnWrap.style.display = "none";
      advWrap.style.height = advWrap.scrollHeight + "px";
      advWrap.style.overflow = "visible";

      updateAdvTotal();
    });

    simpleBtn.addEventListener("click", () => {
      simpleWrap.style.display = "block";
      simpleBtnWrap.style.display = "none";

      advBtnWrap.style.display = "block";
      advWrap.style.height = "0px";
      advWrap.style.overflow = "hidden";
    });

    /* ------------------- INFO BOXES ------------------- */
    function setupInfo(btn, box) {
      const b = form.querySelector(btn);
      const x = form.querySelector(box);
      if (!x) return;

      x.style.height = "0px";
      x.style.overflow = "hidden";

      makeDivButtonAccessible(b);

      b?.addEventListener("click", () => {
        if (x.style.height === "0px") {
          x.style.height = x.scrollHeight + "px";
          x.style.overflow = "visible";
        } else {
          x.style.height = "0px";
          x.style.overflow = "hidden";
        }
      });
    }

    setupInfo("#stress-info-btn", "#stress-info-box");
    setupInfo("#debt-info-btn", "#debt-info-box");
    setupInfo("#mortgage-term-info-btn", "#mortgage-term-info-box");
    setupInfo("#existing-mortgage-info-btn", "#existing-mortgage-info-box");

    /* ============ MASTER CALCULATION FUNCTION ============ */

    function runAffordabilityCalculation() {
      const mode = form.dataset.frequency;
      const term = num(termField, 30);

      const totalIncome = num(inc1) + num(inc2) + num(incOther);
      const monthlyIncome = (mode === "annual") ? totalIncome / 12 : totalIncome;

      const basicOutgoings = num(simpleOut);
      const advOut =
        (advWrap.style.height !== "0px")
          ? advFields.map(num).reduce((a, b) => a + b, 0)
          : 0;

      const debtVal = num(debts);
      const existVal = num(existing);

      const mAvail = monthlyIncome - basicOutgoings - advOut - debtVal - existVal;

      function loanFromMonthly(m, rate, years) {
        const r = rate / 100 / 12;
        const n = years * 12;
        if (r <= 0) return m * n;
        return (m * (1 - Math.pow(1 + r, -n))) / r;
      }

      /* A — Stress-Tested Loan */
      const A = Math.round(
        loanFromMonthly(Math.max(mAvail, 0), num(stressRate), term)
      );

      /* B — ALWAYS based on ANNUAL income */
      const annualIncome =
        (mode === "monthly")
          ? totalIncome * 12
          : totalIncome;

      const B = Math.round(annualIncome * num(incomeMult));

      outA.textContent = fmtGBP(A);
      outB.textContent = fmtGBP(B);

      /* ------------------- STRESS BARS ------------------- */
      const maxVal = Math.max(A, B) || 1;
      const pctA = Math.max((A / maxVal) * 100, 3);
      const pctB = Math.max((B / maxVal) * 100, 3);

      function stressColour(p) {
        if (p >= 70) return "#1FB46A";
        if (p >= 40) return "#FFB547";
        return "#E54B4B";
      }

      barA.style.width = pctA + "%";
      barA.style.background = stressColour(pctA);

      barB.style.width = pctB + "%";
      barB.style.background = "#42b1df";

      /* ------------------- FINAL LOAN ------------------- */
      const finalLoan = Math.min(A, B);
      const finalEl = document.getElementById("ma-final-loan");
      if (finalEl) {
        finalEl.textContent = fmtGBP(finalLoan);
      }

      /* ---------------- EXPLAIN SECTION (clean, no nested divs) ----------- */
      const explainEl = document.getElementById("ma-a-explain");
      if (explainEl) {
        explainEl.innerHTML = `
        <p class="explain">
          Your maximum stress-tested loan is
          <span class="txt-amount">${fmtGBP(A)}</span>.
        </p>
        <p class="explain">
          Based on the income multiple, your maximum loan is
          <span class="txt-amount">${fmtGBP(B)}</span>.
        </p>
        <p class="explain">
          Lenders typically use the lower of these two figures.
        </p>
      `;
      }

      /* ---------------- APPROVAL INDICATOR ---------------- */
      let likelihoodText = "";
      let dot = "";

      if (pctA >= 70) {
        likelihoodText = "Your affordability result is strong, suggesting a high chance of approval.";
        dot = "🟢";
      }
      else if (pctA >= 40) {
        likelihoodText = "Your affordability result is moderate. Approval is possible but may include conditions.";
        dot = "🟠";
      }
      else {
        likelihoodText = "Your affordability result suggests a lower likelihood of approval.";
        dot = "🔴";
      }

      const approvalEl = document.getElementById("ma-a-approval");
      if (approvalEl) {
        approvalEl.innerHTML = `
        <p class="explain">
          <span class="dot-indicator">${dot}</span>
          <span class="txt-strong">${likelihoodText}</span>
        </p>
      `;
      }

      results.style.display = "block";

      /* ---- STATE STORAGE FOR ADVISER ---- */
      window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
      window.PRUD_CALC_STATE.affordability = {
        inputs: {
          income1: num(inc1),
          income2: num(inc2),
          otherIncome: num(incOther),
          totalIncome: totalIncome,
          frequency: mode,
          applicationType: appType,
          simpleOutgoings: basicOutgoings,
          advancedOutgoings: advOut,
          debts: debtVal,
          existingMortgagePayment: existVal,
          stressRate: num(stressRate),
          incomeMultiplier: num(incomeMult),
          mortgageTerm: term
        },
        results: {
          stressTestedLoan: loanA,
          incomeMultipleLoan: loanB,
          recommendedMaxLoan: finalLoan
        }
      };

      scrollSmooth(results);
    }

    /* ========== EVENT LISTENERS ========== */

    /* ---- Calculate Button ---- */
    calcBtn.addEventListener("click", ev => {
      ev.preventDefault();
      runAffordabilityCalculation();
    });

    /* ---- Live Update Listeners ---- */
    inc1.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    inc2.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    incOther.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    simpleOut.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    debts.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    existing.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    stressRate.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    incomeMult.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    termField.addEventListener("input", () => {
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    /* ---- Mode Switch (Monthly/Annual) ---- */
    monthlyBtn.addEventListener("click", ev => {
      ev.preventDefault();
      if (form.dataset.frequency === "annual") {
        convertIncome(form, "monthly");
      }
      form.dataset.frequency = "monthly";
      activateMonthly();
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    annualBtn.addEventListener("click", ev => {
      ev.preventDefault();
      if (form.dataset.frequency === "monthly") {
        convertIncome(form, "annual");
      }
      form.dataset.frequency = "annual";
      activateAnnual();
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    /* ---- Joint Applicant Type ---- */
    appType.addEventListener("change", () => {
      app2Wrap.style.display = (appType.value === "joint") ? "block" : "none";
      if (results.style.display === "block") {
        runAffordabilityCalculation();
      }
    });

    /* ---- Advanced Fields ---- */
    advFields.forEach(f => {
      f.addEventListener("input", () => {
        updateAdvTotal();
        if (results.style.display === "block") {
          runAffordabilityCalculation();
        }
      });
    });

    /* ------------------- RESET ------------------- */
    form.querySelector("#ma-reset").addEventListener("click", () => {
      form.reset();
      results.style.display = "none";

      form.dataset.frequency = "monthly";
      activateMonthly();

      advWrap.style.height = "0px";
      advTotal.value = "0";

      app2Wrap.style.display = "none";
      barA.style.width = "0%";
      barB.style.width = "0%";
    });
  }

  /* ===== 06. STAMP DUTY CALCULATOR (ENGLAND, WALES, SCOTLAND) — CLEANED VERSION ===== */


  function initStampDuty() {

    const wrap = document.getElementById("Stamp-Duty-Calc");
    if (!wrap) return;

    /* CORE ELEMENTS */
    const form = document.getElementById("sd-form");
    const priceEl = form.querySelector("#sd-price");
    const countryEl = form.querySelector("#sd-country");
    const buyerEl = form.querySelector("#sd-buyer-type");

    const replaceWrap = form.querySelector("#sd-checkbox-wrap");
    const replaceMain = form.querySelector("#sd-replace-main");

    const calcBtn = form.querySelector("#sd-calc-btn");
    const resetBtn = form.querySelector("#sd-reset");

    /* OUTPUT AREAS */
    const outWrap = document.getElementById("sd-results");
    const outTotal = document.getElementById("sd-output-total");
    const outBreak = document.getElementById("sd-output-breakdown");
    const outNotes = document.getElementById("sd-output-notes");

    bindCurrencyFormatting(form);

    outWrap.style.display = "none";
    replaceWrap.style.display = "none";

    /* SHOW / HIDE "Replacing Main Residence?"
       Only applies for England & NI *and only* for Additional property */

    function updateReplacingVisibility() {
      const country = countryEl.value;
      const buyer = buyerEl.value;

      // Wales & Scotland never show the checkbox
      if (country === "Wales" || country === "Scotland") {
        replaceMain.checked = false;
        replaceWrap.style.display = "none";
        return;
      }

      // England & NI: Show only for Additional Property
      if (country === "England & NI" && buyer === "additional") {
        replaceWrap.style.display = "block";
      } else {
        replaceMain.checked = false;
        replaceWrap.style.display = "none";
      }
    }

    buyerEl.addEventListener("change", updateReplacingVisibility);
    countryEl.addEventListener("change", updateReplacingVisibility);
    updateReplacingVisibility();


    /* ============ MASTER CALCULATION FUNCTION ============ */

    function runStampDutyCalculation() {
      const price = num(priceEl);
      const country = countryEl.value;
      const buyer = buyerEl.value;
      const replacing = replaceMain.checked;

      const err = document.getElementById("sd-valid-property-price");

      if (price <= 0) {
        /* Hide numeric result to avoid spacing */
        outTotal.style.display = "none";

        if (err) {
          err.textContent = "Please enter a valid property price.";
          err.style.display = "block";
          focusErrorMessage(err, priceEl);
        }

        outBreak.innerHTML = "";
        outNotes.innerHTML = "";

        outWrap.style.display = "block";
        return;
      }

      /* Restore numeric output */
      if (err) err.style.display = "none";
      outTotal.style.display = "block";

      let result;

      /* --- COUNTRY ROUTING --- */
      if (country === "England & NI") {
        result = calcSDLT_England(price, buyer, replacing);
      }
      else if (country === "Wales") {
        result = calcSDLT_Wales(price, buyer);
      }
      else if (country === "Scotland") {
        result = calcSDLT_Scotland(price, buyer);
      }
      else {
        outTotal.textContent = "Unsupported country selection.";
        outWrap.style.display = "block";
        scrollSmooth(outWrap);
        return;
      }

      /* ---------------- TOTAL (Clean, no wrapping classes) ---------------- */
      outTotal.textContent = fmtGBP(result.total);

      /* ---------------- BREAKDOWN (using your `.explain` class) ---------- */
      outBreak.innerHTML = `
      <div class="explain">
        ${result.breakdownHTML}
      </div>
    `;

      /* ---------------- NOTES (also `.explain`) -------------------------- */
      outNotes.innerHTML = `
      <div class="explain">
        ${result.notesHTML}
      </div>
    `;

      outWrap.style.display = "block";

      /* ---- STATE STORAGE FOR ADVISER ---- */
      window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
      window.PRUD_CALC_STATE.stampDuty = {
        inputs: {
          propertyPrice: price,
          country: country,
          buyerType: buyer,
          replacing: replacing
        },
        results: {
          stampDutyPayable: outTotal.textContent
        }
      };

      scrollSmooth(outWrap);
    }

    /* ========== EVENT LISTENERS ========== */

    /* ---- Calculate Button ---- */
    calcBtn.addEventListener("click", ev => {
      ev.preventDefault();
      runStampDutyCalculation();
    });

    /* ---- Live Update Listeners ---- */
    priceEl.addEventListener("input", () => {
      if (outWrap.style.display === "block") {
        runStampDutyCalculation();
      }
    });

    countryEl.addEventListener("change", () => {
      if (outWrap.style.display === "block") {
        runStampDutyCalculation();
      }
    });

    buyerEl.addEventListener("change", () => {
      if (outWrap.style.display === "block") {
        runStampDutyCalculation();
      }
    });

    replaceMain.addEventListener("change", () => {
      if (outWrap.style.display === "block") {
        runStampDutyCalculation();
      }
    });

    /* RESET BUTTON */

    resetBtn.addEventListener("click", () => {
      form.reset();
      outWrap.style.display = "none";
      replaceWrap.style.display = "none";
    });
  }

  /* ===== SDLT LOGIC — ENGLAND & NORTHERN IRELAND ===== */

  function calcSDLT_England(price, buyerType, replacing) {

    let total = 0;
    let breakdown = [];
    let notes = [];

    /* SURCHARGE (3%) */
    let surcharge = 0;

    if (buyerType === "additional" && !replacing) {
      surcharge = 0.03;
      notes.push(`<span class="txt-strong">3% Surcharge </span>has been applied as it's an additional property.`);
    }
    if (buyerType === "additional" && replacing) {
      notes.push(`<span class="txt-strong">3% surcharge </span>has been removed as it's replacing the main residence.`);
    }

    /* FIRST-TIME BUYER RELIEF */
    let isFTB = (buyerType === "ftb");

    if (isFTB) {
      if (price > 500000) {
        notes.push(`<span class="txt-strong">First-Time Buyer Relief </span>has been removed as the property is over £500,000.`);
        isFTB = false;
      } else {
        notes.push(`<span class="txt-strong">First-Time Buyer Relief </span>has been applied with the first £300,000 being tax-free.`);
      }
    }

    function addSlice(amount, rate, label) {
      const tax = amount * (rate + surcharge);
      total += tax;
      breakdown.push(`${label} @ ${(rate + surcharge) * 100}% 
      = <span class="txt-amount">${fmtGBP(Math.round(tax))}</span>`);
    }

    /* FTB Bands */
    if (isFTB) {
      addSlice(Math.min(price, 300000), 0, "£0–£300,000 (FTB)");

      if (price > 300000) {
        addSlice(
          Math.min(price - 300000, 200000),
          0.05,
          "£300,001–£500,000"
        );
      }

      return {
        total: Math.round(total),
        breakdownHTML: breakdown.join("<br>"),
        notesHTML: notes.join("<br>")
      };
    }

    /* Standard SDLT Bands */
    let remaining = price;

    function band(cap, rate, label) {
      if (remaining <= 0) return;
      const taxable = Math.min(remaining, cap);
      addSlice(taxable, rate, label);
      remaining -= taxable;
    }

    band(125000, 0.00, "£0–£125,000");
    band(125000, 0.02, "£125,001–£250,000");
    band(675000, 0.05, "£250,001–£925,000");
    band(575000, 0.10, "£925,001–£1.5m");

    if (remaining > 0) {
      addSlice(remaining, 0.12, "£1.5m+");
    }

    return {
      total: Math.round(total),
      breakdownHTML: breakdown.join("<br>"),
      notesHTML: notes.join("<br>")
    };
  }


  /* ===== LTT LOGIC — WALES ===== */

  function calcSDLT_Wales(price, buyerType) {

    let total = 0;
    let breakdown = [];
    let notes = [];

    const isAdditional = (buyerType === "additional");
    const surcharge = isAdditional ? 0.04 : 0;

    if (isAdditional) {
      notes.push(`<span class="txt-strong">4% additional property surcharge applied</span>.`);
    }

    if (buyerType === "ftb") {
      notes.push(`<span class="txt-strong">Note:</span> First-Time Buyer Relief does not apply in Wales.`);
    }

    let remaining = price;

    function addSlice(amount, rate, label) {
      const tax = amount * (rate + surcharge);
      total += tax;
      breakdown.push(`${label} @ ${(rate + surcharge) * 100}%
      = <span class="txt-amount">${fmtGBP(Math.round(tax))}</span>`);
    }

    function band(cap, rate, label) {
      if (remaining <= 0) return;
      const taxable = Math.min(remaining, cap);
      addSlice(taxable, rate, label);
      remaining -= taxable;
    }

    /* Welsh LTT Bands (2025) */
    band(180000, 0.00, "£0–£180,000");
    band(70000, 0.035, "£180,001–£250,000");
    band(150000, 0.065, "£250,001–£400,000");
    band(350000, 0.075, "£400,001–£750,000");
    band(250000, 0.10, "£750,001–£1m");

    if (remaining > 0) {
      addSlice(remaining, 0.12, "£1m+");
    }

    return {
      total: Math.round(total),
      breakdownHTML: breakdown.join("<br>"),
      notesHTML: notes.join("<br>")
    };
  }


  /* ===== LBTT LOGIC — SCOTLAND ===== */

  function calcSDLT_Scotland(price, buyerType) {

    let total = 0;
    let breakdown = [];
    let notes = [];

    const isAdditional = (buyerType === "additional");
    const surcharge = isAdditional ? 0.06 : 0;

    if (isAdditional) {
      notes.push(`<span class="txt-strong">6% Additional Dwelling Supplement applied</span>.`);
    }

    if (buyerType === "ftb") {
      notes.push(`<span class="txt-strong">Note:</span> First-Time Buyer Relief does not apply in Scotland.`);
    }

    let remaining = price;

    function addSlice(amount, rate, label) {
      const tax = amount * (rate + surcharge);
      total += tax;
      breakdown.push(`${label} @ ${(rate + surcharge) * 100}%
      = <span class="txt-amount">${fmtGBP(Math.round(tax))}</span>`);
    }

    function band(cap, rate, label) {
      if (remaining <= 0) return;
      const taxable = Math.min(remaining, cap);
      addSlice(taxable, rate, label);
      remaining -= taxable;
    }

    /* Scottish LBTT Bands (2025) */
    band(145000, 0.00, "£0–£145,000");
    band(105000, 0.02, "£145,001–£250,000");
    band(75000, 0.05, "£250,001–£325,000");
    band(425000, 0.10, "£325,001–£750,000");

    if (remaining > 0) {
      addSlice(remaining, 0.12, "£750,001+");
    }

    return {
      total: Math.round(total),
      breakdownHTML: breakdown.join("<br>"),
      notesHTML: notes.join("<br>")
    };
  }

  /* ===== 07. REPAYMENT CALCULATOR — CLEANED VERSION ===== */

  function initRepayment(panelId) {

    const wrap = panelId
      ? document.getElementById(panelId)
      : (document.getElementById("Repayment-Calc") ||
        document.getElementById("Repayment-Calc-2"));
    if (!wrap) return;

    const inWrap = id =>
      wrap.querySelector(`#${id}`) || document.getElementById(id);

    const form = wrap.querySelector("form");
    bindCurrencyFormatting(form);

    const results = inWrap("repay-results");
    const loanEl = inWrap("repay-loan");
    const rateEl = inWrap("repay-rate");
    const termEl = inWrap("repay-term");
    const typeEl = inWrap("repay-type");
    const mortgageEl = inWrap("repay-mortgage-type");
    const propertyValueEl = inWrap("repay-property-value");
    const calcBtn = inWrap("repay-calc");
    const outMonthly = inWrap("repay-monthly");
    const outTotal = inWrap("repay-total");
    const outInterest = inWrap("repay-total-interest");
    const amortWrap = inWrap("amort-table-wrap");
    const amortBody = inWrap("repay-amort-body");
    const explainer = inWrap("repay-interest-explainer");
    const typeFieldContainer = inWrap("repay-type-field-container");
    const voluntaryContainer = inWrap("repay-voluntary-container");
    const voluntaryPaymentEl = inWrap("repay-voluntary-payment");
    const projectionTitle = inWrap("repay-loan-projection-title");
    const result1Label = inWrap("repay-result-1");
    const result2Label = inWrap("repay-result-2");
    const result3Label = inWrap("repay-result-3");
    const resultBox1Label = inWrap("repay-box-1");
    const resultBox2Label = inWrap("repay-box-2");
    const resultBox3Label = inWrap("repay-box-3");
    const errorBox = inWrap("repay-error-messages");

    if (results) results.style.display = "none";
    if (amortWrap) amortWrap.style.display = "none";
    if (errorBox) {
      errorBox.style.display = "none";
      errorBox.innerHTML = "";
    }

    function hideRepaymentErrors() {
      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.innerHTML = "";
      }
    }

    function showRepaymentErrors(errors, targetField) {
      if (!errors?.length || !errorBox) return;

      const markup = errors
        .map(err => `<div>${err}</div>`)
        .join("");

      errorBox.innerHTML = markup;
      errorBox.style.display = "block";

      focusErrorMessage(errorBox, targetField || loanEl);
    }

    /* ---------------- DYNAMIC UI SWITCH ---------------- */

    function getLabelTextTarget(el) {
      if (!el) return null;

      const tag = (el.tagName || "").toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "span") {
        return el;
      }

      return (
        el.querySelector(".digital-tools-label") ||
        el.querySelector("h1, h2, h3, h4, span") ||
        el
      );
    }

    function syncResultLabelStyles() {
      const pairs = [
        [result1Label, resultBox1Label],
        [result2Label, resultBox2Label],
        [result3Label, resultBox3Label]
      ];

      pairs.forEach(([sourceEl, targetEl]) => {
        const sourceNode = getLabelTextTarget(sourceEl);
        const targetNode = getLabelTextTarget(targetEl);

        if (!sourceNode || !targetNode || sourceNode === targetNode) return;
        targetNode.className = sourceNode.className;
        targetNode.style.cssText = sourceNode.style.cssText;
      });
    }

    function setResultLabels(label1, label2, label3) {
      const leftA = getLabelTextTarget(result1Label);
      const midA = getLabelTextTarget(result2Label);
      const rightA = getLabelTextTarget(result3Label);
      const leftB = getLabelTextTarget(resultBox1Label);
      const midB = getLabelTextTarget(resultBox2Label);
      const rightB = getLabelTextTarget(resultBox3Label);

      const setLabelContent = (el, label) => {
        if (!el) return;
        if (String(label).includes("<br>")) {
          el.innerHTML = label;
          return;
        }
        el.textContent = label;
      };

      setLabelContent(leftA, label1);
      setLabelContent(midA, label2);
      setLabelContent(rightA, label3);

      setLabelContent(leftB, label1);
      setLabelContent(midB, label2);
      setLabelContent(rightB, label3);
    }

    function updateUI() {

      const mortgageType = mortgageEl?.value || "";

      if (typeFieldContainer) typeFieldContainer.style.display = "block";
      if (voluntaryContainer) voluntaryContainer.style.display = "none";
      if (amortWrap) amortWrap.style.display = "none";
      if (explainer) explainer.style.display = "none";

      if (projectionTitle) projectionTitle.textContent = "Loan Term";

      setResultLabels("Monthly Payment", "Total Interest", "Total Cost");

      if (mortgageType === "Retirement Interest Only Mortgage") {
        if (typeFieldContainer) typeFieldContainer.style.display = "none";
      }

      if (mortgageType === "Lifetime Mortgage") {

        if (typeFieldContainer) typeFieldContainer.style.display = "none";
        if (voluntaryContainer) voluntaryContainer.style.display = "block";
        if (amortWrap) amortWrap.style.display = "none";

        if (projectionTitle) projectionTitle.textContent = "Projection Period";

        setResultLabels(
          "Projected<br>Loan Balance",
          "Total<br>Interest Added",
          "Interest vs<br>Original Loan"
        );

        if (explainer) {
          explainer.textContent =
            "As no monthly payments are required, interest is added to the loan each year, which increases the total amount owed over time. This may reduce the value of your estate.";
          explainer.style.display = "block";
        }
      }
    }

    syncResultLabelStyles();

    /* ============ MASTER CALCULATION FUNCTION ============ */

    function runRepaymentCalculation() {

      const P = num(loanEl);
      const rate = num(rateEl);
      const years = num(termEl);
      const mortgageType = mortgageEl.value;
      const repaymentType = typeEl?.value?.toLowerCase();
      const propertyValue = num(propertyValueEl);
      const voluntary = num(voluntaryPaymentEl);

      const validation = createValidationTracker();
      const validationErrors = validation.errors;

      function addValidationError(message, field) {
        validation.add(message, field);
      }

      if (P <= 0) {
        addValidationError("Please enter a <span class='semi-bold-text'>Loan Amount</span> greater than £0.", loanEl);
      }
      if (rate <= 0) {
        addValidationError("Please enter an <span class='semi-bold-text'>Annual Interest Rate</span> greater than 0%.", rateEl);
      }
      if (years <= 0) {
        addValidationError("Please enter a <span class='semi-bold-text'>Projection Period</span> greater than 0 years.", termEl);
      }
      if (propertyValue < 0) {
        addValidationError("<span class='semi-bold-text'>Current Property Value</span> cannot be negative.", propertyValueEl);
      }
      if (mortgageType === "Lifetime Mortgage" && voluntary < 0) {
        addValidationError("<span class='semi-bold-text'>Annual Voluntary Payment</span> cannot be negative.", voluntaryPaymentEl);
      }
      if (mortgageType === "Lifetime Mortgage") {
        if (propertyValue <= 0) {
          addValidationError("Please enter your <span class='semi-bold-text'>Current Property Value</span>.", propertyValueEl);
        }
        if (P >= propertyValue && propertyValue > 0) {
          addValidationError("The <span class='semi-bold-text'>Loan Amount</span> must be lower than the <span class='semi-bold-text'>Current Property Value</span>.", loanEl);
        }
      }
      if (
        mortgageType !== "Lifetime Mortgage" &&
        mortgageType !== "Retirement Interest Only Mortgage" &&
        !repaymentType
      ) {
        addValidationError("Please select a <span class='semi-bold-text'>Repayment Type</span>.", typeEl);
      }

      if (validationErrors.length) {
        if (results) results.style.display = "none";
        if (amortWrap) amortWrap.style.display = "none";
        hideRepaymentErrors();
        showRepaymentErrors(validationErrors, validation.firstTarget(loanEl));
        return;
      }

      hideRepaymentErrors();

      const r = rate / 100 / 12;
      const n = years * 12;

      amortBody.innerHTML = "";

      /* ===== LIFETIME MORTGAGE ===== */

      if (mortgageType === "Lifetime Mortgage") {

        const annualRate = rate / 100;
        const growthRate = 0.025;

        let balance = P;

        for (let y = 1; y <= years; y++) {

          balance = balance * (1 + annualRate);

          if (voluntary > 0) {
            balance -= voluntary;
          }

          if (balance < 0) {
            balance = 0;
            break;
          }
        }

        const finalBalance = balance;
        const interestAdded = finalBalance - P;
        const growthPct = P > 0 ? (interestAdded / P) * 100 : 0;

        outMonthly.textContent = fmtGBP(Math.round(finalBalance));
        outInterest.textContent = fmtGBP(Math.round(interestAdded));
        outTotal.textContent = growthPct.toFixed(1) + "%";

        let extraLine = "";

        if (!voluntary || voluntary <= 0) {
          extraLine = " This balance can be reduced if you choose to make an annual voluntary payment.";
        } else {
          extraLine = ` This includes an annual voluntary payment of <span class="txt-amount">${fmtGBP(Math.round(voluntary))}</span>.`;
        }

        let ltv = 0;
        let currentEquity = 0;
        let futureProperty = 0;
        let remainingEquity = 0;

        if (propertyValue > 0) {
          ltv = (P / propertyValue) * 100;
          currentEquity = propertyValue - P;
          futureProperty = propertyValue * Math.pow(1 + growthRate, years);
          remainingEquity = futureProperty - finalBalance;
        }

        explainer.innerHTML = `
    <p class="explain">
      Interest is added to the loan and will increase the amount owed over time.
      This may reduce the value of your estate.
      Your outstanding balance after <strong>${years} years</strong> will be
      <span class="txt-amount">${fmtGBP(Math.round(finalBalance))}</span>.
      ${extraLine}
    </p>

    ${propertyValue > 0 ? `
        <h3 class="digital-tools-label">Your Loan Compared to Property Value</h3>
        <p class="explain">
          Based on a current property value of
          <span class="txt-amount">${fmtGBP(Math.round(propertyValue))}</span>,
          your starting <strong>Loan-to-Value</strong> would be
          <span class="txt-amount">${ltv.toFixed(1)}%</span>,
          leaving approximately
          <span class="txt-amount">${fmtGBP(Math.round(currentEquity))}</span>
          in equity.
        </p>

        <h3 class="digital-tools-label">Estimated Remaining Equity</h3>
        <p class="explain">
          This estimate helps illustrate how much of your property’s value may remain — which may form part of your estate and could contribute towards any inheritance you choose to leave. Assuming property values increase at <strong>2.5% per year</strong>,
          the estimated property value after
          <strong>${years} years</strong> could be
          <span class="txt-amount">${fmtGBP(Math.round(futureProperty))}</span>.
          After repaying the loan, the estimated remaining equity would be
          <span class="txt-amount">${fmtGBP(Math.round(remainingEquity))}</span>.
        </p>
      ` : ""
          }
  `;

        explainer.style.display = "block";
        amortWrap.style.display = "none";
        results.style.display = "block";
        scrollSmooth(results);
        return;
      }

      /* ===== RETIREMENT INTEREST ONLY ===== */

      if (mortgageType === "Retirement Interest Only Mortgage") {

        const propertyValue = num(propertyValueEl);
        const growthRate = 0.025;

        const monthly = P * r;
        const totalInterest = monthly * n;
        const totalCost = P + totalInterest;

        outMonthly.textContent = fmtGBP(Math.round(monthly));
        outInterest.textContent = fmtGBP(Math.round(totalInterest));
        outTotal.textContent = fmtGBP(Math.round(totalCost));

        let propertyParagraph = "";

        if (propertyValue > 0) {

          const ltv = (P / propertyValue) * 100;
          const currentEquity = propertyValue - P;

          const futureProperty = propertyValue * Math.pow(1 + growthRate, years);
          const remainingEquity = futureProperty - P;

          propertyParagraph = `
      <h3 class="digital-tools-label">Your Loan Compared to Property Value</h3>
      <p class="explain">
        Based on a current property value of
        <span class="txt-amount">${fmtGBP(Math.round(propertyValue))}</span>,
        your starting <strong>Loan-to-Value</strong> would be
        <span class="txt-amount">${ltv.toFixed(1)}%</span>,
        leaving approximately
        <span class="txt-amount">${fmtGBP(Math.round(currentEquity))}</span>
        in equity.
      </p>

      <h3 class="digital-tools-label">Estimated Remaining Equity</h3>
      <p class="explain">
        This estimate helps illustrate how much of your property’s value may remain — which may form part of your estate and could contribute towards any inheritance you choose to leave. Assuming property values increase at <strong>2.5% per year</strong>,
        the estimated property value after
        <strong>${years} years</strong> could be
        <span class="txt-amount">${fmtGBP(Math.round(futureProperty))}</span>.
        After repaying the loan, the estimated remaining equity would be
        <span class="txt-amount">${fmtGBP(Math.round(remainingEquity))}</span>.
      </p>
    `;
        }

        explainer.innerHTML = `
    <p class="explain">
      Interest-only mortgages do not repay capital.
      You will pay
      <span class="txt-amount">${fmtGBP(Math.round(totalInterest))}</span>
      in interest over <strong>${years} years</strong> and be left with an outstanding balance of
      <span class="txt-amount">${fmtGBP(Math.round(P))}</span>.
    </p>
    ${propertyParagraph}
  `;

        explainer.style.display = "block";
        amortWrap.style.display = "none";
        results.style.display = "block";
        scrollSmooth(results);
        return;
      }

      /* ===== STANDARD MORTGAGE ===== */

      if (repaymentType === "interest-only") {
        const monthly = P * r;
        const total = monthly * n;

        outMonthly.textContent = fmtGBP(Math.round(monthly));
        outTotal.textContent = fmtGBP(Math.round(total));
        outInterest.textContent = fmtGBP(Math.round(total));

        let propertyParagraph = "";

        if (propertyValue > 0) {
          const ltv = (P / propertyValue) * 100;
          const currentEquity = propertyValue - P;

          propertyParagraph = `
      <h3 class="digital-tools-label">Your Loan Compared to Property Value</h3>
      <p class="explain">
        Based on a current property value of 
        <span class="txt-amount">${fmtGBP(Math.round(propertyValue))}</span>, 
        your starting <strong>Loan-to-Value</strong> would be 
        <span class="txt-amount">${ltv.toFixed(1)}%</span>, 
        leaving approximately 
        <span class="txt-amount">${fmtGBP(Math.round(currentEquity))}</span> in equity.
      </p>
    `;
        }

        explainer.innerHTML = `
    <h3 class="digital-tools-label">Repayment Summary</h3>
    <p class="explain">
      Interest-only repayments do not reduce the capital balance during the term.
    </p>
    ${propertyParagraph}
  `;
        explainer.style.display = "block";

        amortWrap.style.display = "none";
        results.style.display = "block";
        scrollSmooth(results);
        return;
      }

      /* ---- CAPITAL REPAYMENT ---- */

      const monthly =
        (P * r) / (1 - Math.pow(1 + r, -n));

      const total = monthly * n;
      const intTot = total - P;

      outMonthly.textContent = fmtGBP(Math.round(monthly));
      outTotal.textContent = fmtGBP(Math.round(total));
      outInterest.textContent = fmtGBP(Math.round(intTot));

      let balance = P;

      for (let y = 1; y <= years; y++) {
        let yearInterest = 0;
        let yearPrincipal = 0;

        for (let m = 0; m < 12; m++) {
          const interestMonth = balance * r;
          const principalMonth = monthly - interestMonth;

          yearInterest += interestMonth;
          yearPrincipal += principalMonth;
          balance -= principalMonth;
        }

        const bg = (y % 2 === 0)
          ? "rgba(0,141,199,0.08)"
          : "transparent";

        amortBody.insertAdjacentHTML("beforeend", `
    <div class="amort-row" style="padding:4px 0;background:${bg}">
      <div class="amort-col txt-year">${y}</div>
      <div class="amort-col txt-amount">${fmtGBP(Math.round(yearInterest))}</div>
      <div class="amort-col txt-amount">${fmtGBP(Math.round(yearPrincipal))}</div>
      <div class="amort-col txt-amount">${fmtGBP(Math.round(balance))}</div>
    </div>
  `);
      }

      let propertyParagraph = "";

      if (propertyValue > 0) {
        const ltv = (P / propertyValue) * 100;
        const currentEquity = propertyValue - P;

        propertyParagraph = `
    <h3 class="digital-tools-label">Your Loan Compared to Property Value</h3>
    <p class="explain">
      Based on a current property value of 
      <span class="txt-amount">${fmtGBP(Math.round(propertyValue))}</span>, 
      your starting <strong>Loan-to-Value</strong> would be 
      <span class="txt-amount">${ltv.toFixed(1)}%</span>, 
      leaving approximately 
      <span class="txt-amount">${fmtGBP(Math.round(currentEquity))}</span> in equity.
    </p>
  `;
      }

      explainer.innerHTML = `
  <h3 class="digital-tools-label">Repayment Summary</h3>
  <p class="explain">
    Your monthly payments gradually repay the loan balance over time, 
    reducing the amount owed to 
    <span class="txt-amount">£0</span> 
    by the end of the term.
  </p>
  ${propertyParagraph}
`;
      explainer.style.display = "block";

      amortWrap.style.display = "block";
      results.style.display = "block";

      /* ---- STATE STORAGE FOR ADVISER ---- */
      window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
      window.PRUD_CALC_STATE.repayment = {
        inputs: {
          loanAmount: P,
          interestRate: rate,
          mortgageTerm: years,
          mortgageType: mortgageType,
          repaymentType: repaymentType,
          propertyValue: num(propertyValueEl),
          voluntaryPayment: num(voluntaryPaymentEl)
        },
        results: {
          monthlyPayment: outMonthly.textContent,
          totalRepaid: outTotal.textContent,
          totalInterest: outInterest.textContent
        }
      };

      scrollSmooth(results);
    }

    function markRepaymentDirty() {
      hideRepaymentErrors();

      if (results) results.style.display = "none";
      if (amortWrap) amortWrap.style.display = "none";
      if (amortBody) amortBody.innerHTML = "";
      if (explainer) explainer.style.display = "none";

      window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
      window.PRUD_CALC_STATE.repayment = null;
    }

    /* ========== EVENT LISTENERS ========== */

    mortgageEl.addEventListener("change", () => {
      updateUI();
      markRepaymentDirty();
    });

    termEl.addEventListener("input", () => {
      updateUI();
      markRepaymentDirty();
    });

    /* ---- Calculate Button ---- */
    calcBtn.addEventListener("click", ev => {
      ev.preventDefault();
      runRepaymentCalculation();
    });

    /* ---- Live Update Listeners ---- */
    loanEl.addEventListener("input", () => {
      markRepaymentDirty();
    });

    rateEl.addEventListener("input", () => {
      markRepaymentDirty();
    });

    typeEl.addEventListener("change", () => {
      markRepaymentDirty();
    });

    propertyValueEl.addEventListener("input", () => {
      markRepaymentDirty();
    });

    voluntaryPaymentEl.addEventListener("input", () => {
      markRepaymentDirty();
    });

    /* ---- Reset Button ---- */
    const resetBtn = inWrap("repay-reset");
    resetBtn?.addEventListener("click", () => {
      form.reset();
      hideRepaymentErrors();

      results.style.display = "none";
      amortWrap.style.display = "none";
      amortBody.innerHTML = "";

      outMonthly.textContent = "—";
      outTotal.textContent = "—";
      outInterest.textContent = "—";

      updateUI();
    });

    updateUI();

    debug("Repayment calculator initialised");
  }

  /* END Repayment Calc */


  /* ===== 08. MORTGAGE FINDER — TABLE-DRIVEN (HTML-ALIGNED) ===== */

  function initMortgageFinder() {

    /* 🔒 MF VISIBILITY RULE (LOCKED)
       Initial hidden state is owned by CSS.
       JS must never hide MF results on init or popup open.
       JS only reveals results after calculation. */

    if (!guardInit("Mortgage Finder", [
      "Mortgage-Finder-Calc",
      "mf-form",
      "mf-find-mortgage-button",
      "mf-rate-tables",
      "mf-fee-tables",
      "mf-rate-preference"
    ])) return;

    const wrap = document.getElementById("Mortgage-Finder-Calc");
    const form = wrap?.querySelector("#mf-form");
    if (!wrap || !form) return;

    const resultsWrap = wrap.querySelector("#mf-results");
    const errorBox = wrap.querySelector("#mf-deposit-error");
    // initial state owned by CSS

    bindCurrencyFormatting(form);

    /* ---------------- INPUTS ---------------- */

    const priceEl = form.querySelector("#mf-prop-price");
    const depEl = form.querySelector("#mf-deposit");
    const termEl = form.querySelector("#mf-mortgage-term");

    const mortgageType = form.querySelector("#mf-mortgage-type");
    const ratePreference = form.querySelector("#mf-rate-preference");

    const findBtn = form.querySelector("#mf-find-mortgage-button");
    const resetBtn = form.querySelector("#mf-reset");

    /* ---------------- OUTPUTS ---------------- */

    const cards = {
      LMP: {
        payment: wrap.querySelector("#mf-lowest-monthly-payment"),
        rate: wrap.querySelector("#mf-LMP-interest-rate"),
        bullets: wrap.querySelector("#mf-LMP-bullet-points"),
        fee: wrap.querySelector("#mf-lmp-product-fee")
      },
      LUC: {
        payment: wrap.querySelector("#mf-lower-upfront-costs"),
        rate: wrap.querySelector("#mf-LUC-interest-rate"),
        bullets: wrap.querySelector("#mf-LUC-bullet-points"),
        fee: wrap.querySelector("#mf-LUC-product-fee")
      },
      LTS: {
        payment: wrap.querySelector("#mf-longer-term-stability"),
        rate: wrap.querySelector("#mf-LTS-interest-rate"),
        bullets: wrap.querySelector("#mf-LTS-bullet-points"),
        fee: wrap.querySelector("#mf-LTS-product-fee")
      }
    };

    /* ---------- OUTPUT GUARD (ACTIVE INSTANCE ONLY) ---------- */

    if (
      !cards.LMP.payment ||
      !cards.LUC.payment ||
      !cards.LTS.payment
    ) {
      console.warn("[PRUDELL][MF] Output targets missing in active instance — render aborted");
      return;
    }

    /* ---------- OUTPUT GUARD — END ---------- */

    /* ---------------- TABLE DATA ---------------- */

    const rateRows = Array.from(
      document.querySelectorAll("#mf-rate-tables [data-journey]")
    ).map(r => ({
      journey: r.dataset.journey,
      rateType: r.dataset.rateType,
      ltv: Number(r.dataset.ltv),
      baseRate: parseFloat(r.querySelector(".table-cell:last-child")?.innerText)
    })).filter(r => !isNaN(r.baseRate) && !isNaN(r.ltv));

    const feeRows = Array.from(
      document.querySelectorAll("#mf-fee-tables [data-fee-tier]")
    ).map(r => ({
      journey: r.dataset.category || r.dataset.journey,
      rateType: r.dataset.rateType,
      tier: r.dataset.feeTier,
      productFee: parseFloat(r.children[1]?.innerText) || 0,
      cashback: parseFloat(r.children[4]?.innerText) || 0,
      rateAdjust: parseFloat(r.children[5]?.innerText) || 0
    }));

    function feesFor(journey, rateType) {

      // FTB deliberately uses RESIDENTIAL fee tables
      const feeJourney =
        journey === "first_time_buyer"
          ? "residential"
          : journey;

      return feeRows.filter(f =>
        norm(f.journey) === norm(feeJourney) &&
        f.rateType === rateType
      );
    }

    /* =====================================================================
       MF — BULLET + CASHBACK RENDERING (LOCKED)
       • Cashback only exists on fee-based products
       • Cashback NEVER appears on no-fee deals
       • Cashback bullet MUST appear FIRST
    ===================================================================== */

    function renderFee(el, fee) {
      if (!el) return;
      el.innerHTML = fee > 0
        ? `<strong>Product fee:</strong> <span class="txt-amount">${fmtGBP(fee)}</span>`
        : "<strong>No product fee</strong>";
    }

    /* ---------- MF BULLETS (CASHBACK RULED) ----------
       RULES (LOCKED):
       • Cashback only exists on fee-based products
       • Cashback NEVER appears on no-fee deals
       • Cashback bullet MUST appear FIRST
    -------------------------------------------------- */
    function renderBullets(el, items, cashback = 0) {
      if (!el) return;
      el.innerHTML = "";

      // Cashback always first (if present)
      if (cashback > 0) {
        const li = document.createElement("li");
        li.innerHTML =
          `<strong>Cashback:</strong> <span class="txt-amount">${fmtGBP(cashback)}</span>`;
        el.appendChild(li);
      }

      items.forEach(t => {
        const li = document.createElement("li");
        li.innerHTML = t;
        el.appendChild(li);
      });
    }

    function renderRate(el, rate, rateType, term) {
      if (!el) return;
      el.innerHTML =
        `Typical interest rates<br>
     from around <span class="txt-amount">${rate.toFixed(2)}%</span><br>
     based on a<br>
     <span style="font-weight:600">${rateType === "fixed"
          ? `${term} year fixed-rate`
          : "variable-rate"
        }</span> mortgage`;
    }

    /* ---------------- CALCULATE ---------------- */

    findBtn.addEventListener("click", ev => {
      ev.preventDefault();

      debug("MF CLICK");

      if (errorBox) errorBox.style.display = "none";

      const price = num(priceEl);
      const dep = num(depEl);

      debug("price / deposit", price, dep);

      const v = mortgageType.value.toLowerCase();
      debug("mortgageType.value =", mortgageType.value);

      const journey =
        v.includes("first") ? "first_time_buyer" :
          v.includes("new") ? "new_mortgage" :
            v.includes("remortgage") ? "remortgage" :
              v.includes("buy") ? "buy_to_let" :
                null;

      debug("journey =", journey);

      if (!journey) {
        console.error("MF STOP → journey unresolved");
        return;
      }

      /* ----- DEPOSIT VALIDATION (AGREED RULES) ----- */

      if (dep >= price) {
        if (errorBox) {
          errorBox.textContent =
            "Your deposit must be lower than the property price.";
          errorBox.style.display = "block";
          focusErrorMessage(errorBox, depEl);
        }
        console.error("MF STOP → deposit >= price", { price, dep });
        return;
      }

      const availableLTVs = rateRows
        .filter(r => r.journey === journey)
        .map(r => r.ltv);

      debug("availableLTVs =", availableLTVs);

      if (!availableLTVs.length) {
        console.error("MF STOP → no rate rows for journey");
        return;
      }

      const maxAvailableLTV = Math.max(...availableLTVs);
      const minDeposit = Math.ceil(price * (100 - maxAvailableLTV) / 100);

      debug("maxAvailableLTV =", maxAvailableLTV, "minDeposit =", minDeposit);

      if (dep < minDeposit) {
        if (errorBox) {
          errorBox.innerHTML =
            `Based on your property price and the available <strong>Loan-to-Value</strong> options, the minimum deposit required is ${fmtGBP(minDeposit)}.`;
          errorBox.style.display = "block";
          focusErrorMessage(errorBox, depEl);
        }
        console.error("MF STOP → deposit below min");
        return;
      }

      /* ----- CORE CALCS ----- */

      const loan = price - dep;
      const ltv = Math.floor((loan / price) * 100);
      const years = num(termEl, 25);

      debug("loan =", loan, "ltv =", ltv, "years =", years);

      const pref = norm(ratePreference.value);
      const wantsVariable = pref.includes("variable");
      const wantsFixed = !wantsVariable;

      debug("ratePreference =", ratePreference.value, "pref =", pref);

      let fixedTerms = [];
      if (wantsFixed) {
        if (pref.includes("2")) fixedTerms = [2];
        else if (pref.includes("3")) fixedTerms = [3];
        else if (pref.includes("5")) fixedTerms = [5];
        else if (pref.includes("10")) fixedTerms = [10];
        else fixedTerms = [2, 3, 5, 10];
      }

      debug("fixedTerms =", fixedTerms, "wantsVariable =", wantsVariable);

      const basePool = rateRows.filter(r =>
        r.journey === journey &&
        ltv <= r.ltv
      );

      debug("basePool =", basePool);

      if (!basePool.length) {
        console.error("MF STOP → no rates after LTV filter");
        return;
      }

      const adjRow = document.querySelector(
        `[data-adjustment-row="fixed-term"][data-journey="${journey}"]`
      ) || document.querySelector('[data-adjustment-row="fixed-term"]');

      debug("adjRow found =", !!adjRow);

      const journeyFees = feesFor(
        journey,
        wantsVariable ? "variable" : "fixed"
      );

      debug("journeyFees =", journeyFees);

      if (!journeyFees.length) {
        console.error("MF STOP → no fee rows for journey + rate type");
        return;
      }

      const deals = [];

      basePool.forEach(r => {
        journeyFees.forEach(feeProfile => {
          if (r.rateType === "variable") {
            const rate = r.baseRate + feeProfile.rateAdjust;
            deals.push({
              ...r,
              term: null,
              rate,
              monthly: repaymentMonthly(loan, rate, years),
              feeProfile
            });
          } else {
            [2, 3, 5, 10].forEach(t => {
              let rate = r.baseRate;
              const uplift = parseFloat(
                adjRow?.querySelector(`[data-term="${t}"] .table-text`)?.textContent
              );
              if (!isNaN(uplift)) rate += uplift;

              rate += feeProfile.rateAdjust;

              deals.push({
                ...r,
                term: t,
                rate,
                monthly: repaymentMonthly(loan, rate, years),
                feeProfile
              });
            });
          }
        });
      });

      debug("deals =", deals);

      const eligibleDeals = deals.filter(d =>
        wantsVariable || fixedTerms.includes(d.term)
      );

      debug("eligibleDeals =", eligibleDeals);

      if (!eligibleDeals.length) {
        console.error("MF STOP → no eligible deals after filtering");
        return;
      }

      /* ---------- LMP ---------- */

      const lmpDeal = [...eligibleDeals]
        .sort((a, b) => a.monthly - b.monthly)[0];

      /* ---------- LUC ---------- */

      const lucDeal = [...eligibleDeals]
        .sort((a, b) => {
          const netA = a.feeProfile.productFee - a.feeProfile.cashback;
          const netB = b.feeProfile.productFee - b.feeProfile.cashback;
          if (netA !== netB) return netA - netB;
          return a.rate - b.rate;
        })[0];

      /* =====================================================================
       🔒 LTS (LONGER-TERM STABILITY) — DO NOT CHANGE THIS LOGIC 🔒
    
       LOCKED BUSINESS RULES (AGREED):
    
       • LTS MUST ALWAYS be a LONG-TERM FIXED mortgage.
       • LTS is NEVER allowed to show 2-year or 3-year deals.
       • Only 5-year or 10-year fixed rates are valid.
    
       TERM PROMOTION RULES:
       ---------------------
       • 2y / 3y selected → best of 5y or 10y
       • 5y selected      → FORCE 10y
       • 10y selected     → 10y
    
       CRITICAL IMPLEMENTATION RULE:
       -----------------------------
       LTS MUST NOT be derived from `eligibleDeals`
       because `eligibleDeals` is filtered by user preference.
    
       Any change here must be explicitly re-agreed.
    ===================================================================== */

      /* ---------- LTS POOL (IGNORES USER TERM FILTERING) ---------- */

      const ltsPool = deals.filter(d =>
        d.rateType === "fixed" &&
        (d.term === 5 || d.term === 10)
      );

      let ltsCandidates = [...ltsPool];

      /* ---------- TERM PROMOTION ---------- */

      if (fixedTerms.length === 1) {
        const t = fixedTerms[0];

        if (t === 5 || t === 10) {
          // 🔒 RULE: 5y OR 10y selection MUST show 10y for LTS
          ltsCandidates = ltsCandidates.filter(d => d.term === 10);
        }
        // 2y / 3y / all-fixed → best of 5y or 10y
      }

      /* ---------- FINAL PICK ---------- */

      ltsCandidates.sort((a, b) => a.rate - b.rate);

      let ltsDeal = ltsCandidates[0] || null;

      /* ---------- DEFENSIVE FALLBACKS (SHOULD NEVER HIT) ---------- */

      if (!ltsDeal) {
        ltsDeal =
          deals
            .filter(d => d.rateType === "fixed")
            .sort((a, b) => b.term - a.term || a.rate - b.rate)[0] || null;
      }

      if (!ltsDeal) {
        ltsDeal =
          deals
            .filter(d => d.rateType === "variable")
            .sort((a, b) => a.rate - b.rate)[0] || null;
      }

      /* --------------- single-line debug probe ----------------- */

      console.log("[MF PROBE]", {
        LMP: cards.LMP.payment,
        LUC: cards.LUC.payment,
        LTS: cards.LTS.payment
      });

      /* ---------- RENDER ---------- */

      cards.LMP.payment.textContent = fmtGBP(Math.round(lmpDeal.monthly));
      renderRate(cards.LMP.rate, lmpDeal.rate, lmpDeal.rateType, lmpDeal.term);
      renderFee(cards.LMP.fee, lmpDeal.feeProfile.productFee);
      renderBullets(
        cards.LMP.bullets,
        [
          "Lowest interest rate available",
          "Designed to minimise your monthly repayments"
        ],
        lmpDeal.feeProfile.cashback
      );

      cards.LUC.payment.textContent = fmtGBP(Math.round(lucDeal.monthly));
      renderRate(cards.LUC.rate, lucDeal.rate, lucDeal.rateType, lucDeal.term);
      renderFee(cards.LUC.fee, lucDeal.feeProfile.productFee);
      renderBullets(
        cards.LUC.bullets,
        [
          "Lower upfront costs at completion",
          "Popular for buyers prioritising cash flow"
        ],
        lucDeal.feeProfile.cashback
      );

      if (ltsDeal) {
        cards.LTS.payment.textContent = fmtGBP(Math.round(ltsDeal.monthly));
        renderRate(cards.LTS.rate, ltsDeal.rate, ltsDeal.rateType, ltsDeal.term);
        renderFee(cards.LTS.fee, ltsDeal.feeProfile.productFee);
        renderBullets(
          cards.LTS.bullets,
          [
            "Protection against future interest rate rises",
            "Often chosen for long-term peace of mind"
          ],
          ltsDeal?.feeProfile.cashback
        );

      } else {
        cards.LTS.payment.textContent = "—";
        cards.LTS.rate.innerHTML = "Not available for this selection";
        cards.LTS.fee.innerHTML = "";
        cards.LTS.bullets.innerHTML = "";
      }

      /* ---------- STATE (FIXED) ---------- */

      window.PRUD_CALC_STATE.mortgageFinder = {
        inputs: {
          price,
          deposit: dep,
          loan,
          ltv,
          mortgageType: mortgageType.value,
          mortgageTermYears: Number(termEl?.value || 0),
          ratePreference: ratePreference.value
        },
        cards: {
          LMP: {
            payment: fmtGBP(Math.round(lmpDeal.monthly)),
            rate: lmpDeal.rate,
            term: lmpDeal.term,
            rateType: lmpDeal.rateType,
            fee: lmpDeal.feeProfile.productFee,
            cashback: lmpDeal.feeProfile.cashback
          },
          LUC: {
            payment: fmtGBP(Math.round(lucDeal.monthly)),
            rate: lucDeal.rate,
            term: lucDeal.term,
            rateType: lucDeal.rateType,
            fee: lucDeal.feeProfile.productFee,
            cashback: lucDeal.feeProfile.cashback
          },
          LTS: ltsDeal
            ? {
              payment: fmtGBP(Math.round(ltsDeal.monthly)),
              rate: ltsDeal.rate,
              term: ltsDeal.term,
              rateType: ltsDeal.rateType,
              fee: ltsDeal.feeProfile.productFee,
              cashback: ltsDeal.feeProfile.cashback
            }
            : null
        }
      };

      resultsWrap.style.display = "block";
      scrollSmooth(resultsWrap);
    });

    /* ---- Hide Results On Input Change ---- */
    priceEl.addEventListener("input", () => {
      if (resultsWrap && resultsWrap.style.display === "block") {
        resultsWrap.style.display = "none";
      }
      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
      }
    });

    depEl.addEventListener("input", () => {
      if (resultsWrap && resultsWrap.style.display === "block") {
        resultsWrap.style.display = "none";
      }
      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
      }
    });

    termEl.addEventListener("input", () => {
      if (resultsWrap && resultsWrap.style.display === "block") {
        resultsWrap.style.display = "none";
      }
      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
      }
    });

    mortgageType.addEventListener("change", () => {
      if (resultsWrap && resultsWrap.style.display === "block") {
        resultsWrap.style.display = "none";
      }
      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
      }
    });

    ratePreference.addEventListener("change", () => {
      if (resultsWrap && resultsWrap.style.display === "block") {
        resultsWrap.style.display = "none";
      }
      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
      }
    });

    resetBtn?.addEventListener("click", () => {
      form.reset();

      if (resultsWrap) {
        resultsWrap.style.display = "none"; // return to CSS-owned initial state
      }

      if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
      }

      window.PRUD_CALC_STATE.mortgageFinder = null;
    });
  }

  /* ===== END MORTGAGE FINDER ===== */


  /* ===== 09. MORTGAGE REFINANCE CALCULATOR — CLEAN VERSION =====
     Capital + Interest mortgages only
     Uses .row template for interest-saved list
  --------------------------------------------------------------- */

  function initMortgageRefinance() {

    const CALC = "Mortgage Refinance";

    if (!guardInit(CALC, [
      "Mortgage-Refinance-Calc",
      "mr-remaining-loan",
      "mr-current-interest-rate",
      "mr-mortgage-term-years",
      "mr-mortgage-term-months",
      "mr-new-interest-rate",
      "mr-product-fee",
      "mr-repayment-fee",
      "mr-error-messages",
      "mr-calculate-button",
      "mr-reset",
      "mr-results",
      "mr-interest-saved-list"
    ])) return;

    const wrap = mustGet("Mortgage-Refinance-Calc");
    const form = wrap.querySelector("form");
    if (!form) return;

    bindCurrencyFormatting(form);

    /* ---------------- INPUTS ---------------- */

    const curLoanEl = document.getElementById("mr-remaining-loan");
    const curRateEl = document.getElementById("mr-current-interest-rate");
    const termYearsEl = document.getElementById("mr-mortgage-term-years");
    const termMonthsEl = document.getElementById("mr-mortgage-term-months");

    const newRateEl = document.getElementById("mr-new-interest-rate");
    const productFeeEl = document.getElementById("mr-product-fee");
    const repayFeeEl = document.getElementById("mr-repayment-fee");

    const extraBtn = document.getElementById("mr-borrow-extra-cell");
    const extraWrap = document.getElementById("mr-borrow-amount-cell");
    const extraLoanEl = extraWrap?.querySelector("input");

    /* ---------------- OUTPUTS ---------------- */

    const outMonthly = document.getElementById("mr-new-monthly-payment");
    const outSaving = document.getElementById("mr-monthly-saving");
    const outBEYear = document.getElementById("mr-break-even-year");
    const outBEMonths = document.getElementById("mr-break-even-months");

    const explainEl = document.getElementById("mr-explain-savings");
    const resultsWrap = document.getElementById("mr-results");
    const errorBox = document.getElementById("mr-error-messages");

    const listEl = document.getElementById("mr-interest-saved-list");
    const templateRow = listEl?.querySelector(".row");

    if (resultsWrap) resultsWrap.style.display = "none";
    if (errorBox) {
      errorBox.style.display = "none";
      errorBox.textContent = "";
    }

    function hideError() {
      if (!errorBox) return;
      errorBox.style.display = "none";
      errorBox.textContent = "";
    }

    function showErrors(errors, targetField) {
      if (!errorBox || !errors?.length) return;
      errorBox.innerHTML = errors.map(err => `<div>${err}</div>`).join("");
      errorBox.style.display = "block";
      focusErrorMessage(errorBox, targetField || curLoanEl || errorBox);
    }

    /* ---------------- EXTRA BORROW (OPTIONAL) ---------------- */

    if (extraWrap) {
      extraWrap.style.display = "none";
      extraWrap.style.height = "0px";
      extraWrap.style.overflow = "hidden";
    }

    extraBtn?.addEventListener("click", e => {
      e.preventDefault();
      if (!extraWrap) return;

      extraBtn.style.display = "none";
      extraWrap.style.display = "block";
      extraWrap.style.height = extraWrap.scrollHeight + "px";
      extraWrap.style.overflow = "visible";
    });

    /* ---------------- HELPERS ---------------- */

    function monthlyPayment(P, rate, months) {
      const r = rate / 100 / 12;
      if (r <= 0) return P / months;
      return (P * r) / (1 - Math.pow(1 + r, -months));
    }

    /* ============ MASTER CALCULATION FUNCTION ============ */

    function runRefinanceCalculation() {
      const curLoan = num(curLoanEl);
      const curRate = num(curRateEl);
      const years = num(termYearsEl);
      const months = num(termMonthsEl);
      const newRate = num(newRateEl);

      const productFee = num(productFeeEl);
      const repayFee = num(repayFeeEl);

      const validation = createValidationTracker();
      const validationErrors = validation.errors;

      function addValidationError(message, field) {
        validation.add(message, field);
      }

      if (curLoan <= 0) addValidationError("Please enter a Remaining Loan Amount greater than £0.", curLoanEl);
      if (curRate <= 0) addValidationError("Please enter a Current Interest Rate greater than 0%.", curRateEl);
      if (newRate <= 0) addValidationError("Please enter a New Interest Rate greater than 0%.", newRateEl);
      if (years < 0 || months < 0) addValidationError("Mortgage term values cannot be negative.", years < 0 ? termYearsEl : termMonthsEl);
      if (months > 11) addValidationError("Remaining Mortgage Term months must be between 0 and 11.", termMonthsEl);
      if (productFee < 0) addValidationError("Product Fee cannot be negative.", productFeeEl);
      if (repayFee < 0) addValidationError("Early Repayment Fee cannot be negative.", repayFeeEl);

      const totalMonths = years * 12 + months;
      if (totalMonths <= 0) addValidationError("Please enter a Remaining Mortgage Term greater than 0 months.", termYearsEl || termMonthsEl);

      const extraLoan =
        extraWrap && extraWrap.style.display === "block"
          ? num(extraLoanEl)
          : 0;

      if (extraLoan < 0) addValidationError("Extra borrowing amount cannot be negative.", extraLoanEl);

      if (validationErrors.length) {
        if (resultsWrap) resultsWrap.style.display = "none";
        showErrors(validationErrors, validation.firstTarget(curLoanEl));
        return;
      }

      hideError();

      const newLoan = curLoan + extraLoan;

      const curMonthly = monthlyPayment(curLoan, curRate, totalMonths);
      const newMonthly = monthlyPayment(newLoan, newRate, totalMonths);

      const monthlySaving = curMonthly - newMonthly;

      /* -------- BREAK EVEN -------- */

      let breakevenMonths = null;
      const totalFees = productFee + repayFee;
      const breakEvenWithinTerm = monthlySaving > 0 && totalFees > 0
        ? (totalFees / monthlySaving) <= totalMonths
        : true;

      const notFinanciallyBeneficial = monthlySaving <= 0 || !breakEvenWithinTerm;

      if (notFinanciallyBeneficial) {
        if (listEl) {
          listEl.innerHTML = "";
          listEl.style.display = "none";
        }

        if (explainEl) explainEl.textContent = "";

        if (resultsWrap) resultsWrap.style.display = "none";

        let nonBenefitMessage =
          "Based on the information entered, switching to this new rate would not result in a financial saving.";

        if (!breakEvenWithinTerm) {
          nonBenefitMessage =
            "Your product fee and/or early repayment charge are too high for this refinance to deliver a financial saving within your remaining term.";
        } else if (extraLoan > 0 && monthlySaving <= 0) {
          nonBenefitMessage =
            "The extra borrowing entered outweighs the refinance benefit, so this option would not save money.";
        }

        showErrors([
          nonBenefitMessage
        ]);

        window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
        window.PRUD_CALC_STATE.mortgageRefinance = null;
        return;
      }

      outMonthly.textContent = fmtGBP(Math.round(newMonthly));
      outSaving.textContent = fmtGBP(Math.round(monthlySaving));

      if (monthlySaving > 0) {
        breakevenMonths = totalFees > 0 ? totalFees / monthlySaving : 0;
      }

      if (breakevenMonths !== null && breakevenMonths < 1) {
        outBEYear.textContent = "Immediate";
        outBEMonths.textContent = "";
      } else if (breakevenMonths !== null && !breakEvenWithinTerm) {
        outBEYear.textContent = "Not within term";
        outBEMonths.textContent = "";
      } else if (breakevenMonths) {
        const y = Math.floor(breakevenMonths / 12);
        const m = Math.round(breakevenMonths % 12);
        outBEYear.textContent = y ? `${y} Year${y !== 1 ? "s" : ""}` : "";
        outBEMonths.textContent = m ? `${m} Month${m !== 1 ? "s" : ""}` : "";
      } else {
        outBEYear.textContent = "—";
        outBEMonths.textContent = "—";
      }

      /* -------- INTEREST SAVED LIST (3 YEARS AFTER BREAK-EVEN) -------- */

      if (listEl && templateRow) {
        listEl.innerHTML = "";
        // hide by default; reveal only when we append rows
        listEl.style.display = "none";

        if (monthlySaving > 0 && breakevenMonths !== null && breakEvenWithinTerm) {
          listEl.style.display = "block";
          const startYear = breakevenMonths < 12 ? 1 : Math.ceil(breakevenMonths / 12);

          for (let i = 0; i < 3; i++) {
            const year = startYear + i;
            const row = templateRow.cloneNode(true);

            row.querySelector(".mr-interest-text").textContent =
              `Interest saved after ${year} year${year !== 1 ? "s" : ""}:`;

            row.querySelector(".mr-interest-amount").textContent =
              fmtGBP(Math.round(monthlySaving * 12 * year));

            listEl.appendChild(row);
          }
        }
      }

      /* -------- EXPLAIN TEXT -------- */

      if (explainEl) {
        if (monthlySaving > 0 && breakevenMonths !== null) {
          if (breakevenMonths === 0) {
            explainEl.textContent =
              "You will immediately recover the cost of refinancing compared to staying on your current mortgage. Below, you can see how your interest savings build over the subsequent three years.";
          } else {
            const y = Math.floor(breakevenMonths / 12);
            const m = Math.round(breakevenMonths % 12);

            const time =
              y && m
                ? `\u003cstrong\u003e${y} year${y !== 1 ? "s" : ""}\u003c/strong\u003e and \u003cstrong\u003e${m} month${m !== 1 ? "s" : ""}\u003c/strong\u003e`
                : y
                  ? `\u003cstrong\u003e${y} year${y !== 1 ? "s" : ""}\u003c/strong\u003e`
                  : `\u003cstrong\u003e${m} month${m !== 1 ? "s" : ""}\u003c/strong\u003e`;

            explainEl.innerHTML =
              `After ${time}, you will recover the cost of refinancing compared to staying on your current mortgage. Below, you can see how your interest savings build over the subsequent three years.`;
          }
        } else {
          explainEl.textContent =
            "Based on the information entered, switching to this new rate would not result in a financial saving.";
        }
      }

      if (resultsWrap) {
        /* ---- STATE STORAGE FOR ADVISER ---- */
        window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
        window.PRUD_CALC_STATE.mortgageRefinance = {
          inputs: {
            remainingLoan: curLoan,
            currentRate: curRate,
            mortgageTerm: totalMonths,
            newRate: newRate,
            productFee: productFee,
            repaymentFee: repayFee,
            extraBorrow: extraLoan
          },
          results: {
            newMonthlyPayment: outMonthly.textContent,
            monthlySaving: outSaving.textContent,
            breakEvenYear: outBEYear.textContent,
            breakEvenMonths: outBEMonths.textContent
          }
        };

        resultsWrap.style.display = "block";
        scrollSmooth(resultsWrap);
      }
    }

    /* ========== EVENT LISTENERS ========== */

    /* ---- Calculate Button ---- */
    const calcBtn = document.getElementById("mr-calculate-button");
    if (calcBtn) {
      calcBtn.addEventListener("click", e => {
        e.preventDefault();
        runRefinanceCalculation();
      });
    }

    /* ---- Live Update Listeners ---- */
    curLoanEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    curRateEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    termYearsEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    termMonthsEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    newRateEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    productFeeEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    repayFeeEl.addEventListener("input", () => {
      hideError();
      if (resultsWrap && resultsWrap.style.display === "block") {
        runRefinanceCalculation();
      }
    });

    if (extraLoanEl) {
      extraLoanEl.addEventListener("input", () => {
        hideError();
        if (resultsWrap && resultsWrap.style.display === "block") {
          runRefinanceCalculation();
        }
      });
    }

    /* ---- Reset Button ---- */

    document.getElementById("mr-reset")?.addEventListener("click", () => {
      form.reset();

      if (extraWrap) {
        extraWrap.style.display = "none";
        extraWrap.style.height = "0px";
        extraWrap.style.overflow = "hidden";
      }
      if (extraBtn) {
        extraBtn.style.display = "block";
      }

      outMonthly.textContent = "—";
      outSaving.textContent = "—";
      outBEYear.textContent = "—";
      outBEMonths.textContent = "—";

      if (listEl) {
        listEl.innerHTML = "";
        listEl.style.display = "none";
      }
      if (explainEl) explainEl.textContent = "";

      if (resultsWrap) resultsWrap.style.display = "none";
      hideError();
    });

    debug("✔ Mortgage Refinance Calculator Ready");

  }

  /* ------------------ INTEREST LABEL NORMALISATION ------------------
     Converts boolean values to human-readable wording
     for email / CRM / adviser summaries.
  ------------------------------------------------------------------- */

  /* ============================================================
     10. INSURANCE PROTECTION — CALCULATE + RESULTS
     STATE-DRIVEN (ADVISER SAFE)
  ============================================================ */

  /* ================= RECOMMENDATION COPY ================= */

  /*
    NOTE (LOCKED):
    Recommendation copy is only shown in Scenario B
    when a meaningful, product-led recommendation exists.
  */

  const REC_LI = `
<p class="txt-explain">
  Based on your outstanding mortgage, a lump-sum <span class="semi-bold-text">Life Insurance</span> policy
  is commonly used to help clear the mortgage balance in the event of death.
</p>
`;

  const REC_CIC = `
<p class="txt-explain">
  Based on your outstanding mortgage, <span class="semi-bold-text">Critical Illness Cover</span> may be
  appropriate to help clear the mortgage balance if you are diagnosed
  with a qualifying serious illness.
</p>
`;

  const REC_FIB = `
<p class="txt-explain">
  Based on your income and dependants, <span class="semi-bold-text">Family Income Benefit</span> may be
  appropriate to help provide an ongoing income for your household
  during the selected term.
</p>
`;

  const REC_IP = `
<p class="txt-explain">
  Based on your income, <span class="semi-bold-text">Income Protection</span> may be appropriate to help
  replace a proportion of your earnings until your selected retirement age
  if you are unable to work due to illness or injury.
</p>
`;

  const REC_GUIDANCE_ONLY = `
<p class="txt-explain">
  As you have no outstanding mortgage or significant financial commitments,
  no mortgage-related protection requirement has been identified.
</p>
`;

  /* ================= END RECOMMENDATION COPY ================= */


  function initInsuranceProtectionCalc() {

    const wrap = document.getElementById("Insurance-Protection-Calc");
    if (!wrap) return;

    /* 🔒 REBIND GUARD — PREVENT DUPLICATE EVENT HANDLERS */
    if (wrap.dataset.ipBound === "true") return;
    wrap.dataset.ipBound = "true";

    if (!guardInit("Insurance Protection", [
      "Insurance-Protection-Calc",
      "ip-calculate-button",
      "ip-reset",
      "ip-error-messages"
    ])) return;

    const form = wrap?.querySelector("form");
    const results = wrap.querySelector("#ip-results");
    const errorBox = wrap.querySelector("#ip-error-messages");


    if (!wrap || !form) {
      console.error("[PRUDELL] Insurance Protection: Missing form or wrap element");
      return;
    }

    bindCurrencyFormatting(form);

    /* ================= INPUTS ================= */

    const ageEl = document.getElementById("ip-age");
    const incomeEl = document.getElementById("ip-gross-income");
    const mortgageEl = document.getElementById("ip-outstanding-mortgage");
    const debtsEl = document.getElementById("ip-other-debts");

    const dependantsWrap =
      document.getElementById("ip-number-dependants-wrapper");
    const dependantsEl =
      dependantsWrap?.querySelector("input");

    const youngestWrap =
      document.getElementById("ip-youngest-dependants-age-wrapper");
    const youngestEl =
      youngestWrap?.querySelector("input");

    const retireWrap =
      document.getElementById("ip-retirement-age-wrapper");
    const retireAgeEl =
      retireWrap?.querySelector("input");

    const healthEl =
      document.getElementById("ip-general-health");

    const familySituationEl =
      document.getElementById("ip-family-situation");

    const smokerYes = document.getElementById("ip-smoker-yes");
    const smokerNo = document.getElementById("ip-smoker-no");

    const termRet = document.getElementById("ip-until-retirement");
    const term21 = document.getElementById("ip-youngest-21");

    /* ================= PROTECTION TYPES ================= */

    const lifeEl = document.getElementById("ip-life-insurance-cover");
    const ciEl = document.getElementById("ip-critical-illness-cover");
    const fibEl = document.getElementById("ip-family-income-benefit-cover");
    const ipEl = document.getElementById("ip-income-protection-cover");

    /* ---------- TERM21 AVAILABILITY (locked rule) ----------
       ‘Until youngest is 21’ is only valid when Family Income Benefit
       has been selected.  Rather than wait for validation errors we
       proactively disable/hide the radio and clear it if the user
       deselects FIB.
    ---------------------------------------------------------- */
    function updateTerm21Availability() {
      const allowed = fibEl && fibEl.checked;
      if (term21) {
        term21.disabled = !allowed;
        const lab = term21.closest("label");
        if (lab) lab.style.opacity = allowed ? "" : "0.5";
        if (!allowed && term21.checked) {
          // revert back to retirement option
          if (termRet) termRet.checked = true;
          if (retireWrap) retireWrap.style.display = "block";
          if (retireAgeEl && !retireAgeEl.value) retireAgeEl.value = "65";
        }
      }
    }

    fibEl?.addEventListener("change", updateTerm21Availability);
    // run once on init to set correct state
    updateTerm21Availability();

    /* ================= EXISTING COVER ================= */

    const existingYes = document.getElementById("ip-existing-insurance-protection-yes");
    const existingNo = document.getElementById("ip-existing-insurance-protection-no");

    const existingCoverWrap =
      document.getElementById("ip-protect-cover-amount-wrapper");

    const existingCoverInput =
      document.getElementById("ip-protection-cover-amount");


    /* ================= RESULT TARGETS ================= */

    const breakdownSpan =
      wrap.querySelector("#ip-breakdown span");

    const assumptionsSpan =
      wrap.querySelector("#ip-assumptions span");

    const monthlyBlock =
      wrap.querySelector("#ip-monthly-cost");

    const recommendationWrap =
      wrap.querySelector("#ip-recommendation-wrapper");

    const recommendationSpan =
      recommendationWrap?.querySelector("span");

    /* ---------- OUTPUT GUARD (ACTIVE INSTANCE ONLY) ---------- */

    if (
      !results ||
      !monthlyBlock ||
      !breakdownSpan ||
      !assumptionsSpan ||
      !recommendationWrap
    ) {
      console.warn("[PRUDELL][IP] Output targets missing in active instance — render aborted");
      return;
    }

    /* ---------- OUTPUT GUARD — END ---------- */

    /* ================= INITIAL STATE ================= */

    [results, errorBox, recommendationWrap, existingCoverWrap,
      dependantsWrap, youngestWrap, retireWrap]
      .forEach(el => {
        if (el) el.style.display = "none";
      });

    /* ================= HELPERS ================= */

    function showResults() {
      if (!results) return;
      results.style.display = "block";
      scrollSmooth(results);
    }

    function clearErrors() {
      errorBox.innerHTML = "";
      errorBox.style.display = "none";
    }

    function radioSync(yes, no) {
      yes.checked = true;
      no.checked = false;
    }

    function ageLoading(age) {
      if (!age || age <= 0) return 1;
      if (age < 30) return 1.0;
      if (age < 40) return 1.1;
      if (age < 50) return 1.25;
      if (age < 60) return 1.5;
      return 1.9;
    }

    /* ---------- SMOKER ---------- */

    smokerYes?.addEventListener("click", () => radioSync(smokerYes, smokerNo));
    smokerNo?.addEventListener("click", () => radioSync(smokerNo, smokerYes));

    /* ---------- EXISTING INSURANCE ---------- */

    existingYes?.addEventListener("change", () => {
      if (!existingYes.checked) return;
      radioSync(existingYes, existingNo);
      if (existingCoverWrap) existingCoverWrap.style.display = "block";
    });

    existingNo?.addEventListener("change", () => {
      if (!existingNo.checked) return;
      radioSync(existingNo, existingYes);
      if (existingCoverWrap) existingCoverWrap.style.display = "none";
      if (existingCoverInput) existingCoverInput.value = "";
    });

    /* ---------- TERM SELECTION (RADIO-SAFE) ---------- */

    termRet?.addEventListener("change", () => {
      if (!termRet.checked) return;

      if (term21) term21.checked = false;
      if (retireWrap) retireWrap.style.display = "block";

      // ✅ Default retirement age (user may adjust)
      if (retireAgeEl && !retireAgeEl.value) {
        retireAgeEl.value = "65";
      }
    });

    term21?.addEventListener("change", () => {
      if (!term21.checked) return;

      if (termRet) termRet.checked = false;
      if (retireWrap) retireWrap.style.display = "none";
      if (retireAgeEl) retireAgeEl.value = "";
    });

    /* ================= FAMILY SITUATION ================= */

    function updateFamilySituation() {

      if (!familySituationEl) return;
      const v = familySituationEl.value;

      const SHOW_DEPENDANTS =
        v === "Married / Partner with dependants" ||
        v === "Single parent" ||
        v === "Supporting others";

      const SHOW_YOUNGEST =
        v === "Married / Partner with dependants" ||
        v === "Single parent";

      if (dependantsWrap) {
        dependantsWrap.style.display = SHOW_DEPENDANTS ? "block" : "none";
        if (!SHOW_DEPENDANTS && dependantsEl) dependantsEl.value = "";
      }

      if (youngestWrap) {
        youngestWrap.style.display = SHOW_YOUNGEST ? "block" : "none";
        if (!SHOW_YOUNGEST && youngestEl) youngestEl.value = "";
      }
    }

    familySituationEl?.addEventListener("change", updateFamilySituation);
    updateFamilySituation();

    /* ================= INFO BOXES (SAFE INIT) ================= */

    [
      ["ip-info-general-health-btn", "ip-info-box-general-health"],
      ["ip-info-existing-insurance-protection-btn", "ip-info-box-existing-insurance-protection"],
      ["ip-info-life-insurance-cover", "ip-info-box-life-insurance-cover"],
      ["ip-info-critical-illness-cover", "ip-info-box-critical-illness-cover"],
      ["ip-info-family-income-benefit-cover", "ip-info-box-family-income-benefit-cover"],
      ["ip-info-income-protection-cover", "ip-info-box-income-protection-cover"]
    ].forEach(([btnId, boxId]) => {

      const btn = document.getElementById(btnId);
      const box = document.getElementById(boxId);

      if (!btn || !box) return;

      /* 🔒 HARD HIDE ON INIT */
      box.style.display = "none";

      /* 🔒 RESTORE UX (THIS WAS LOST) */
      btn.style.cursor = "pointer";
      btn.style.userSelect = "none";

      makeDivButtonAccessible(btn);

      btn.addEventListener("click", e => {
        e.preventDefault();
        box.style.display =
          box.style.display === "none" ? "block" : "none";
      });
    });

    /* ================= END INFO BOXES ================= */

    /* ================= CALCULATION ================= */

    form.querySelector("#ip-calculate-button")?.addEventListener("click", e => {
      e.preventDefault();
      clearErrors();

      // Reset prior checkbox-group invalid visuals before each validation pass.
      form.querySelectorAll('.checkbox-group input[type="checkbox"], .checkbox-group input[type="radio"]').forEach(el => {
        el.removeAttribute("aria-invalid");
      });

      if (recommendationWrap) recommendationWrap.style.display = "none";
      if (recommendationSpan) recommendationSpan.innerHTML = "";
      if (breakdownSpan) breakdownSpan.innerHTML = "";
      if (assumptionsSpan) assumptionsSpan.innerHTML = "";

      const validation = createValidationTracker();
      const errors = validation.errors;

      function addError(message, targetInput) {
        validation.add(message, targetInput);
      }

      function flagCheckboxGroupInputs(inputs) {
        const list = (inputs || []).filter(Boolean);
        const target = list[0] || null;
        if (!target) return target;

        list.forEach(el => el.setAttribute("aria-invalid", "true"));

        return focusFieldBoxArea(target) || target;
      }

      /* ================= INPUT VALUES ================= */

      const age = num(ageEl);
      const income = num(incomeEl);
      const mortgage = num(mortgageEl);
      const debts = num(debtsEl);
      const dependants = num(dependantsEl);
      const youngest = num(youngestEl);
      const retireAge = num(retireAgeEl);
      const existingCoverAmount = num(existingCoverInput);

      const selected = {
        life: lifeEl.checked,
        ci: ciEl.checked,
        fib: fibEl.checked,
        ip: ipEl.checked
      };

      /* ================= SCENARIO FLAGS (LOCKED) ================= */

      /*
        Scenario A:
        • No outstanding mortgage
        • No material debt (below £10,000)
        • Life and/or Critical Illness selected
      */
      const isScenarioA =
        mortgage <= 0 &&
        (!debts || debts < 10000) &&
        (selected.life || selected.ci);

      /*
        Scenario B:
        • Mortgage and/or material debt exists
      */
      const isScenarioB = !isScenarioA;

      /* ================= END SCENARIO FLAGS ================= */

      const termRequired =
        selected.life || selected.ci || selected.fib;

      const retirementSelected = termRet.checked;
      const youngestSelected = term21.checked;

      /* ================= VALIDATION ================= */

      /* ---------- ORDERED BY FORM ---------- */

      /* 1. Smoker */
      if (!smokerYes.checked && !smokerNo.checked)
        addError(
          "Please confirm whether you <span class='semi-bold-text'>smoke</span>.",
          flagCheckboxGroupInputs([smokerYes, smokerNo])
        );

      /* 2. Gross Annual Income */
      if (!income || income <= 0)
        addError(
          "Please enter your <span class='semi-bold-text'>Gross Annual Income</span>.",
          incomeEl
        );

      /* 3. Existing Insurance Protection */
      if (!existingYes.checked && !existingNo.checked)
        addError(
          "Please confirm whether you have existing <span class='semi-bold-text'>Insurance Protection</span>.",
          flagCheckboxGroupInputs([existingYes, existingNo])
        );

      if (existingYes.checked && (!existingCoverAmount || existingCoverAmount <= 0))
        addError(
          "Please enter your <span class='semi-bold-text'>Existing Protection Cover Amount</span>.",
          existingCoverInput
        );

      /* 4. Protection Type */
      if (!Object.values(selected).some(Boolean))
        addError(
          "Please select at least one type of <span class='semi-bold-text'>Protection</span>.",
          flagCheckboxGroupInputs([lifeEl, ciEl, fibEl, ipEl])
        );

      /* 5. Insurance Protection Term */
      if (termRequired && !retirementSelected && !youngestSelected)
        addError(
          "Please select an <span class='semi-bold-text'>Insurance Protection Term</span>.",
          flagCheckboxGroupInputs([termRet, term21])
        );

      /* 6. Retirement Age */
      if (retirementSelected && termRequired) {
        const effectiveRetireAge = retireAge || 65;
        if (effectiveRetireAge <= age || effectiveRetireAge > 75)
          addError(
            "Please enter a valid <span class='semi-bold-text'>Retirement Age</span>.",
            retireAgeEl
          );
      }

      /* 7. Dependants / Youngest Child */
      if (youngestSelected) {

        if (!selected.fib)
          addError(
            "‘Until youngest is 21’ only applies to <span class='semi-bold-text'>Family Income Benefit</span>.",
            term21
          );

        if (!dependants)
          addError(
            "Please enter the <span class='semi-bold-text'>Number of Dependants</span>.",
            dependantsEl
          );

        if (!youngest)
          addError(
            "Please enter the <span class='semi-bold-text'>Youngest Dependant’s Age</span>.",
            youngestEl
          );
      }

      if (errors.length) {
        errorBox.innerHTML = errors.map(e => `<div>${e}</div>`).join("");
        errorBox.style.display = "block";
        focusErrorMessage(errorBox, validation.firstTarget(ageEl));
        return;
      }

      /* ================= COVER CALCULATIONS ================= */

      let lifeCover = 0;
      let ciCover = 0;
      let fibYears = 0;

      /* ---------- Existing cover ---------- */

      const existingCover =
        existingYes.checked ? existingCoverAmount : 0;

      let lumpSumCover = 0;

      /* ---------- Life Insurance (Mortgage-only) ---------- */
      if (selected.life) {
        lifeCover = mortgage;
      }

      /* ---------- Critical Illness (Mortgage-only, Model A) ---------- */
      if (selected.ci) {
        ciCover = mortgage;
      }

      /* ---------- Lump-sum total (minus existing cover) ---------- */

      const rawLumpSumCover =
        (selected.life ? lifeCover : 0) +
        (selected.ci ? ciCover : 0);

      lumpSumCover = Math.max(
        0,
        rawLumpSumCover - existingCover
      );

      /* ---------- Family Income Benefit (Income-only) ---------- */
      if (selected.fib) {
        fibYears = retirementSelected
          ? Math.max(0, (retireAge || 65) - age)
          : Math.max(0, 21 - youngest);
      }

      /* ================= MONTHLY CALCULATION ================= */

      let monthlyTotal = 0;

      /* ---------- Life Insurance ---------- */
      if (selected.life && lifeCover)
        monthlyTotal += (lifeCover / 1000) * 0.05;

      /* ---------- Critical Illness ---------- */
      if (selected.ci && ciCover)
        monthlyTotal += (ciCover / 1000) * 0.12;

      /* ---------- Family Income Benefit ---------- */
      if (selected.fib && fibYears)
        monthlyTotal += (income / 1000) * 0.003 * fibYears;

      /* ---------- Income Protection (Income-led — LOCKED) ---------- */

      if (selected.ip) {
        const ipMonthly =
          (income * 0.6) / 12; // 60% income replacement (illustrative)

        monthlyTotal += Math.max(
          35,
          ipMonthly * 0.03
        );
      }

      /* ---------- Loadings ---------- */

      if (smokerYes.checked) monthlyTotal *= 1.35;
      if (healthEl?.value === "Average") monthlyTotal *= 1.15;
      if (healthEl?.value === "Poor") monthlyTotal *= 1.35;

      /* ---------- Age Loading ---------- */
      monthlyTotal *= ageLoading(age);

      const minMonthly = Math.round(monthlyTotal * 0.85);
      const maxMonthly = Math.round(monthlyTotal * 1.15);

      /* ---------- Income Protection Duration ---------- */

      const ipYears =
        selected.ip && retirementSelected
          ? Math.max(0, (retireAge || 65) - age)
          : null;

      /* ================= RESULTS OUTPUT ================= */

      /* ================= SCENARIO A — HARD HIDE UNUSED SECTIONS =================
      
         RULE (LOCKED):
         Scenario A = no outstanding mortgage + no material debt.
         In this scenario:
         ✅ ONLY show #ip-recommendation-wrapper
         ❌ Hide ALL other result sections (DO NOT clear content)
      -------------------------------------------------------------------------- */

      if (isScenarioA) {

        const HIDE_IDS = [
          "ip-estimated-cover",
          "ip-monthly-cost",
          "ip-breakdown",
          "ip-assumptions"
        ];

        HIDE_IDS.forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;

          el.style.display = "none";
          el.style.margin = "0";
          el.style.padding = "0";
        });

        if (recommendationWrap) {
          recommendationWrap.style.display = "block";
          recommendationWrap.style.margin = "";
          recommendationWrap.style.padding = "";
        }

        showResults(); // required
      }

      const hasLumpSum = selected.life || selected.ci;
      const hasIP = selected.ip;
      const hasFIB = selected.fib;

      /* ---------- ESTIMATED COVER (LUMP SUM ONLY) ---------- */

      const estCoverBlock = wrap.querySelector("#ip-estimated-cover");

      if (estCoverBlock) {

        if (isScenarioA && (selected.life || selected.ci)) {
          estCoverBlock.style.display = "none";
          estCoverBlock.innerHTML = "";
        }

        /* ---- STANDARD CALCULATED RESULT ---- */
        else if (hasLumpSum && lumpSumCover > 0) {
          estCoverBlock.style.display = "block";
          estCoverBlock.innerHTML = `
      <div class="digital-tools-label">Mortgage Protection Estimate</div>
      <p class="txt-explain">
        <span class="result-figure">${fmtGBP(lumpSumCover)}</span>
        is the estimated amount designed to help clear your outstanding
        mortgage through
        ${[
              selected.life && '<span class="semi-bold-text">Life Insurance</span>',
              selected.ci && '<span class="semi-bold-text">Critical Illness Cover</span>'
            ].filter(Boolean).join(" and ")}.
      </p>
    `;
        }

        /* ---- HIDE OTHERWISE ---- */
        else {
          estCoverBlock.style.display = "none";
          estCoverBlock.innerHTML = "";
        }
      }

      /* ---------- MONTHLY COST ---------- */

      if (monthlyBlock) {

        if (isScenarioA) {
          monthlyBlock.style.display = "none";
        } else {

          const monthlyText =
            minMonthly === maxMonthly
              ? fmtGBP(minMonthly)
              : `${fmtGBP(minMonthly)} – ${fmtGBP(maxMonthly)}`;

          monthlyBlock.innerHTML = `
      <div class="digital-tools-label">Estimated Monthly Cost</div>
      <p class="txt-explain">
        <span class="small-result-figure">
          ${monthlyText}
        </span>
        is your estimated monthly cost.
      </p>
    `;
        }
      }

      /* ---------- PROTECTION BREAKDOWN & PAYOUT ---------- */

      if (breakdownSpan) {

        if (isScenarioA && (selected.life || selected.ci)) {
          breakdownSpan.innerHTML = "";
        } else {

          breakdownSpan.innerHTML = `
      <div class="digital-tools-label">Protection Breakdown and Payout</div>
      <ul class="results-list">

        ${(selected.life || selected.ci) && mortgage > 0
              ? `<li>
                <strong>Mortgage balance:</strong>
                <span class="txt-amount">${fmtGBP(mortgage)}</span>
              </li>`
              : ""
            }

        ${selected.fib
              ? `<li>
                <strong>Gross Annual Income:</strong>
                <span class="txt-amount">${fmtGBP(income)}</span>
              </li>
              <li>
                <strong>Family Income Benefit:</strong>
                <span class="txt-explain">
                  <span class="txt-amount">${fmtGBP(income)}</span> per year, payable for ${fibYears} year${fibYears !== 1 ? "s" : ""}
                  (${retirementSelected ? "until retirement" : "until youngest reaches age 21"}).
                </span>
              </li>`
              : ""
            }

        ${selected.ip
              ? `<li>
                <strong>Gross Annual Income:</strong>
                <span class="txt-amount">${fmtGBP(income)}</span>
              </li>
              <li>
                <strong>Income Protection:</strong>
                <span class="txt-explain">
                  Up to <span class="txt-amount">${fmtGBP(Math.round(income * 0.6))}</span> per year,
                  payable monthly until retirement age of ${retireAge || 65}.
                </span>
              </li>`
              : ""
            }

        ${(selected.life || selected.ci) && lumpSumCover > 0
              ? `<li>
                <strong>Total protection required (lump sum):</strong>
                <span class="txt-amount">${fmtGBP(lumpSumCover)}</span>
              </li>`
              : ""
            }

        ${existingYes.checked && existingCover > 0
              ? `<li>
                <strong>Existing protection:</strong>
                <span class="txt-amount">–${fmtGBP(existingCover)}</span>
              </li>`
              : ""
            }

      </ul>
    `;
        }
      }

      /* ---------- IMPORTANT INFORMATION ---------- */

      if (assumptionsSpan) {

        if (isScenarioA) {
          assumptionsSpan.innerHTML = "";
          const assumptionsBlock = wrap.querySelector("#ip-assumptions");
          if (assumptionsBlock) {
            assumptionsBlock.style.display = "none";
          }
        } else {

          let infoText = "";

          if (selected.life) {
            infoText += `
    <p class="txt-explain">
      These figures for <span class="semi-bold-text">Life Insurance</span>
      are illustrative only and are intended to provide an indication of
      lump-sum protection designed to help cover or clear only your
      mortgage in the event of death, based on the information you have
      provided.
    </p>
  `;
          }

          if (selected.ci) {
            infoText += `
    <p class="txt-explain">
      These figures for <span class="semi-bold-text">Critical Illness Cover</span>
      are illustrative only and are intended to provide an indication of
      lump-sum protection designed to help cover or clear only your
      mortgage in the event of a qualifying critical illness, based on the
      information you have provided.
    </p>
  `;
          }

          if (selected.fib) {
            infoText += `
    <p class="txt-explain">
      These figures for <span class="semi-bold-text">Family Income Benefit</span>
      are illustrative only and are intended to provide an indication of a
      fixed annual income payable for the selected term to help support
      your household in the event of death, based on the information you
      have provided.
    </p>
<p class="txt-explain">
  This calculation does not take into account tax treatment, inflation,
  household expenditure, existing benefits, or affordability, and does
  not represent a personalised recommendation.
</p>
  `;
          }

          if (selected.ip) {
            infoText += `
    <p class="txt-explain">
      These figures for <span class="semi-bold-text">Income Protection</span>
      are illustrative only and are intended to provide an indication of
      income-based protection designed to help replace a proportion of
      your earnings until your selected retirement age if you are unable
      to work due to illness or injury.
    </p>
  `;
          }

          assumptionsSpan.innerHTML = `
      <div class="digital-tools-label">Important Information</div>
      ${infoText}
      <p class="txt-explain">
        Actual cover amounts, policy terms, and premiums will depend on
        individual circumstances, medical disclosures, and insurer
        underwriting criteria. A full review with an adviser can help
        determine the most appropriate level of protection for your needs.
      </p>
    `;
        }
      }

      /* ---------- RECOMMENDATION OUTPUT ---------- */

      let recommendationPlain = "";

      if (recommendationWrap && recommendationSpan) {

        let recommendationText = "";

        if (isScenarioA) {
          recommendationText = REC_GUIDANCE_ONLY;
          recommendationPlain =
            "No mortgage-related protection requirement identified.";
        } else {
          /* ===== NEW RECOMMENDATION LOGIC =====
             Phase 2 smart upgrade per brief
          ------------------------------------- */

          // 🟦 STEP 1 — detect financial needs (exposure, not selection)
          const needs = {
            life: mortgage > 0,
            ci: mortgage > 0,
            fib: dependants > 0,
            ip: income > 0
          };

          // 🟩 STEP 2 — two buckets
          const recommendationBlocks = [];
          const confirmationBlocks = [];

          // helper to push a reinforced copy for confirmations
          function confirm(text) {
            confirmationBlocks.push(text);
          }

          // 🟨 STEP 3 — product rules

          // Life Insurance
          if (needs.life || selected.life) {
            const reinforced =
              `<p class="txt-explain">
                You have selected <span class="semi-bold-text">Life Insurance</span>, which is commonly used to help clear the mortgage balance in the event of death.
              </p>`;
            if (needs.life) {
              if (selected.life) confirm(reinforced);
              else recommendationBlocks.push(REC_LI);
            } else if (selected.life) {
              // edge case: selected without need
              confirm(reinforced);
            }
          }

          // Critical Illness Cover
          if (needs.ci || selected.ci) {
            const reinforced =
              `<p class="txt-explain">
                You have selected <span class="semi-bold-text">Critical Illness Cover</span>, which may be appropriate to help clear the mortgage balance if you are diagnosed with a qualifying serious illness.
              </p>`;
            if (needs.ci) {
              if (selected.ci) confirm(reinforced);
              else recommendationBlocks.push(REC_CIC);
            } else if (selected.ci) {
              confirm(reinforced);
            }
          }

          // Family Income Benefit
          if (needs.fib || selected.fib) {
            const reinforced =
              `<p class="txt-explain">
                You have selected <span class="semi-bold-text">Family Income Benefit</span>, which may be appropriate to help provide an ongoing income for your household during the selected term.
              </p>`;
            if (needs.fib) {
              if (selected.fib) confirm(reinforced);
              else recommendationBlocks.push(REC_FIB);
            } else if (selected.fib) {
              confirm(reinforced);
            }
          }

          // Income Protection
          if (needs.ip || selected.ip) {
            const reinforced =
              `<p class="txt-explain">
                You have selected <span class="semi-bold-text">Income Protection</span>, which may be appropriate to help replace a proportion of your earnings until your selected retirement age if you are unable to work due to illness or injury.
              </p>`;
            if (needs.ip) {
              if (selected.ip) confirm(reinforced);
              else recommendationBlocks.push(REC_IP);
            } else if (selected.ip) {
              confirm(reinforced);
            }
          }

          // 🟪 STEP 4 — assemble output (missing first, then confirmations)
          recommendationText =
            `${recommendationBlocks.join("")}${confirmationBlocks.join("")}`;

          recommendationPlain = recommendationText
            .replace(/<[^>]+>/g, "")
            .trim();
        }

        if (recommendationText) {
          recommendationSpan.innerHTML = `
      <div class="digital-tools-label">Our Recommendation</div>
      ${recommendationText}
    `;
          recommendationWrap.style.display = "block";
        } else {
          recommendationWrap.style.display = "none";
        }
      }

      /* ---------- END RECOMMENDATION OUTPUT ---------- */

      /* ---------- STATE WRITE (LOCKED) ---------- */

      window.PRUD_CALC_STATE.insuranceProtection = {
        inputs: {
          age,
          smoker: smokerYes.checked ? "Yes" : "No",
          health: healthEl?.value || "—",
          family: familySituationEl?.value || "—",
          dependants: dependants || 0,
          youngest: youngest || null,
          income: fmtGBP(income),
          mortgage: fmtGBP(mortgage),
          debts: fmtGBP(debts),
          existing: existingYes.checked
            ? fmtGBP(existingCover)
            : "None",
          existingCoverAmount: existingYes.checked
            ? fmtGBP(existingCover)
            : "None"
        },
        results: {
          cover: hasLumpSum ? fmtGBP(lumpSumCover) : "—",
          monthly: `${fmtGBP(minMonthly)} – ${fmtGBP(maxMonthly)}`,
          breakdown: breakdownSpan?.innerText || "",
          assumptions: assumptionsSpan?.innerText || "",
          recommendation: recommendationPlain
        }
      };

      if (!isScenarioA && results) {

        results.style.display = "block";

        [
          "ip-estimated-cover",
          "ip-monthly-cost",
          "ip-breakdown",
          "ip-assumptions",
          "ip-recommendation-wrapper"
        ].forEach(id => {
          const el = wrap.querySelector(`#${id}`);
          if (!el) return;

          el.style.setProperty("display", "block", "important");
          el.style.margin = "";
          el.style.padding = "";
        });

        scrollSmooth(results);
      }
    });

    /* ---- Hide Results On Input Change ---- */
    function hideResultsAndErrors() {
      if (results && results.style.display === "block") {
        results.style.display = "none";
      }
      clearErrors();
    }

    if (ageEl) {
      ageEl.addEventListener("input", hideResultsAndErrors);
    }

    if (incomeEl) {
      incomeEl.addEventListener("input", hideResultsAndErrors);
    }

    if (mortgageEl) {
      mortgageEl.addEventListener("input", hideResultsAndErrors);
    }

    if (debtsEl) {
      debtsEl.addEventListener("input", hideResultsAndErrors);
    }

    if (dependantsEl) {
      dependantsEl.addEventListener("input", hideResultsAndErrors);
    }

    if (youngestEl) {
      youngestEl.addEventListener("input", hideResultsAndErrors);
    }

    if (retireAgeEl) {
      retireAgeEl.addEventListener("input", hideResultsAndErrors);
    }

    if (healthEl) {
      healthEl.addEventListener("change", hideResultsAndErrors);
    }

    if (familySituationEl) {
      familySituationEl.addEventListener("change", hideResultsAndErrors);
    }

    smokerYes.addEventListener("change", hideResultsAndErrors);
    smokerNo.addEventListener("change", hideResultsAndErrors);

    termRet.addEventListener("change", hideResultsAndErrors);
    term21.addEventListener("change", hideResultsAndErrors);

    lifeEl.addEventListener("change", hideResultsAndErrors);
    ciEl.addEventListener("change", hideResultsAndErrors);
    fibEl.addEventListener("change", hideResultsAndErrors);
    ipEl.addEventListener("change", hideResultsAndErrors);

    existingYes.addEventListener("change", hideResultsAndErrors);
    existingNo.addEventListener("change", hideResultsAndErrors);

    if (existingCoverInput) {
      existingCoverInput.addEventListener("input", hideResultsAndErrors);
    }

    /* ================= RESET ================= */

    const ipResetBtn = form.querySelector("#ip-reset");
    if (ipResetBtn) {
      ipResetBtn.addEventListener("click", function (e) {
        e.preventDefault();

        form.reset();

        if (results) results.style.display = "none";
        if (errorBox) errorBox.style.display = "none";

        if (recommendationWrap) {
          recommendationWrap.style.display = "none";
          const span = recommendationWrap.querySelector("span");
          if (span) span.innerHTML = "";
        }

        if (existingCoverWrap) existingCoverWrap.style.display = "none";
        if (dependantsWrap) dependantsWrap.style.display = "none";
        if (youngestWrap) youngestWrap.style.display = "none";
        if (retireWrap) retireWrap.style.display = "none";

        window.PRUD_CALC_STATE.insuranceProtection = null;
      });
    }

    /* ================= END RESET ================= */

  } // ✅ END initInsuranceProtectionCalc

  /* ============================================================
     END INSURANCE PROTECTION UI LOGIC
  ============================================================ */

  /* ============================================================
     11. RISK ASSESSMENT — APPLICATION SECTION
  ============================================================ */

  function initRiskAssessment() {

    const CALC = "Risk Assessment";

    if (!guardInit(CALC, [
      "Risk-Assessment-Calc",
      "ra-app-type",
      "ra-results",
      "ra-calc",
      "ra-reset",
      "ra-error-messages"
    ])) return;

    const wrap = document.getElementById("Risk-Assessment-Calc");
    const form = wrap?.querySelector("form");
    const results = wrap.querySelector("#ra-results");
    const errorBox = wrap.querySelector("#ra-error-messages");
    const appType = document.getElementById("ra-app-type");
    const app2Wrap = document.getElementById("ra-applicant-2");

    if (!wrap || !form) {
      console.error("[PRUDELL][RA] Missing wrap or form");
      return;
    }

    bindCurrencyFormatting(form);

    if (results) results.style.display = "none";
    if (errorBox) errorBox.style.display = "none";
    if (app2Wrap) app2Wrap.style.display = "none";

    /* ================= SINGLE SELECT ENFORCEMENT ================= */

    function forcePair(idA, idB) {
      const a = document.getElementById(idA);
      const b = document.getElementById(idB);
      if (!a || !b) return;

      a.addEventListener("change", function () {
        if (this.checked) b.checked = false;
      });

      b.addEventListener("change", function () {
        if (this.checked) a.checked = false;
      });
    }

    // Applicant 1
    forcePair("ra-1-gender-male", "ra-1-gender-female");
    forcePair("ra-1-smoker-yes", "ra-1-smoker-no");
    forcePair("ra-dependants-yes", "ra-dependants-no");
    forcePair("ra-existing-mortgage-yes", "ra-existing-mortgage-no");

    // Applicant 2 (Partner)
    forcePair("ra-2-gender-male", "ra-2-gender-female");
    forcePair("ra-2-smoker-yes", "ra-2-smoker-no");

    /* ================= APPLICATION TYPE ================= */

    appType?.addEventListener("change", function () {

      const val = String(this.value).trim().toLowerCase();

      if (val === "joint") {
        app2Wrap.style.display = "block";
      } else {
        app2Wrap.style.display = "none";
        wrap.querySelectorAll("#ra-applicant-2 input")
          .forEach(el => {
            if (el.type === "checkbox") el.checked = false;
            else el.value = "";
          });
      }
    });

    /* ================= MORTGAGE TOGGLE ================= */

    const mortgageYes = document.getElementById("ra-existing-mortgage-yes");
    const mortgageNo = document.getElementById("ra-existing-mortgage-no");
    const mortgageWrap = document.getElementById("ra-mortgage-balance-container");

    if (mortgageWrap) mortgageWrap.style.display = "none";

    mortgageYes?.addEventListener("change", function () {
      if (this.checked) mortgageWrap.style.display = "block";
    });

    mortgageNo?.addEventListener("change", function () {
      if (this.checked) {
        mortgageWrap.style.display = "none";
        const bal = document.getElementById("ra-mortgage-balance");
        if (bal) bal.value = "";
      }
    });

    /* ================= CALCULATE ================= */

    document.getElementById("ra-calc")?.addEventListener("click", function (e) {
      e.preventDefault();

      if (results) results.style.display = "none";
      if (errorBox) {
        errorBox.innerHTML = "";
        errorBox.style.display = "none";
      }

      // Clear previous group-level invalid visuals before re-validating.
      form.querySelectorAll('.checkbox-group input[type="checkbox"], .checkbox-group input[type="radio"]').forEach(el => {
        el.removeAttribute("aria-invalid");
      });

      try {

        const val = String(appType.value).trim().toLowerCase();

        const income1 = num(document.getElementById("ra-1-income"));
        const income2 = val === "joint"
          ? num(document.getElementById("ra-2-income"))
          : 0;

        const totalIncome = income1 + income2;

        const hasMortgage = mortgageYes?.checked;
        const mortgageBal = hasMortgage
          ? num(document.getElementById("ra-mortgage-balance"))
          : 0;

        /* ================= VALIDATION ================= */

        const validation = createValidationTracker();
        const errors = validation.errors;

        function addError(message, targetInput) {
          validation.add(message, targetInput);
        }

        function flagCheckboxGroup(inputA, inputB) {
          const target = inputA || inputB || null;
          if (!target) return target;

          [inputA, inputB].forEach(el => {
            if (el) el.setAttribute("aria-invalid", "true");
          });

          return focusFieldBoxArea(target) || target;
        }

        if (!appType.value)
          addError('Please select <span class="semi-bold-text">Application Type</span>.', appType);

        if (!income1 || income1 <= 0)
          addError('Please enter your <span class="semi-bold-text">Income</span>.', document.getElementById("ra-1-income"));

        if (val === "joint" && (!income2 || income2 <= 0))
          addError('Please enter your <span class="semi-bold-text">Partner Income</span>.', document.getElementById("ra-2-income"));

        const g1MaleInput = document.getElementById("ra-1-gender-male");
        const g1FemaleInput = document.getElementById("ra-1-gender-female");
        const g1Male = g1MaleInput?.checked;
        const g1Female = g1FemaleInput?.checked;
        if (!g1Male && !g1Female)
          addError(
            'Please select your <span class="semi-bold-text">Gender</span>.',
            flagCheckboxGroup(g1MaleInput, g1FemaleInput)
          );

        const s1YesInput = document.getElementById("ra-1-smoker-yes");
        const s1NoInput = document.getElementById("ra-1-smoker-no");
        const s1Yes = s1YesInput?.checked;
        const s1No = s1NoInput?.checked;
        if (!s1Yes && !s1No)
          addError(
            'Please confirm whether you <span class="semi-bold-text">Smoke</span>.',
            flagCheckboxGroup(s1YesInput, s1NoInput)
          );

        const d1YesInput = document.getElementById("ra-dependants-yes");
        const d1NoInput = document.getElementById("ra-dependants-no");
        const d1Yes = d1YesInput?.checked;
        const d1No = d1NoInput?.checked;
        if (!d1Yes && !d1No)
          addError(
            'Please confirm if you have <span class="semi-bold-text">Dependants</span>.',
            flagCheckboxGroup(d1YesInput, d1NoInput)
          );

        if (!mortgageYes?.checked && !mortgageNo?.checked)
          addError(
            'Please confirm if you have an <span class="semi-bold-text">Existing Mortgage</span>.',
            flagCheckboxGroup(mortgageYes, mortgageNo)
          );

        if (hasMortgage && (!mortgageBal || mortgageBal <= 0))
          addError('Please enter your <span class="semi-bold-text">Outstanding Mortgage Balance</span>.', document.getElementById("ra-mortgage-balance"));

        if (val === "joint") {
          const g2MaleInput = document.getElementById("ra-2-gender-male");
          const g2FemaleInput = document.getElementById("ra-2-gender-female");
          const g2Male = g2MaleInput?.checked;
          const g2Female = g2FemaleInput?.checked;

          if (!g2Male && !g2Female)
            addError(
              'Please select your <span class="semi-bold-text">Partner Gender</span>.',
              flagCheckboxGroup(g2MaleInput, g2FemaleInput)
            );

          const s2YesInput = document.getElementById("ra-2-smoker-yes");
          const s2NoInput = document.getElementById("ra-2-smoker-no");
          const s2Yes = s2YesInput?.checked;
          const s2No = s2NoInput?.checked;

          if (!s2Yes && !s2No)
            addError(
              'Please confirm if your <span class="semi-bold-text">Partner Smokes</span>.',
              flagCheckboxGroup(s2YesInput, s2NoInput)
            );
        }

        if (errors.length) {
          errorBox.innerHTML = errors.map(e => `<div>${e}</div>`).join("");
          errorBox.style.display = "block";
          focusErrorMessage(errorBox, validation.firstTarget(form.querySelector("#ra-1-income")));
          return;
        }

        /* ================= RISK MODELLING (UNCHANGED BELOW HERE) ================= */

        /* === Core Inputs === */

        const age1 = num(document.getElementById("ra-1-age"));
        const retAge1 = num(document.getElementById("ra-1-retirement-age"));
        const yearsToRet1 = Math.max(retAge1 - age1, 0);

        const age2 = val === "joint" ? num(document.getElementById("ra-2-age")) : 0;
        const retAge2 = val === "joint" ? num(document.getElementById("ra-2-retirement-age")) : 0;
        const yearsToRet2 = val === "joint" ? Math.max(retAge2 - age2, 0) : 0;

        const longestRetWindow = Math.max(yearsToRet1, yearsToRet2);

        const smoker2 = val === "joint"
          ? document.getElementById("ra-2-smoker-yes")?.checked
          : false;

        const male1 = document.getElementById("ra-1-gender-male")?.checked;
        const male2 = val === "joint"
          ? document.getElementById("ra-2-gender-male")?.checked
          : false;

        const incomeShare1 = totalIncome ? income1 / totalIncome : 1;
        const incomeShare2 = totalIncome ? income2 / totalIncome : 0;

        const mortgageRatio = (hasMortgage && totalIncome)
          ? mortgageBal / totalIncome
          : 0;

        /* === Age Band Helper === */

        function ageBand(age, type) {
          if (type === "work") {
            if (age < 30) return 0.28;
            if (age < 40) return 0.35;
            if (age < 50) return 0.45;
            return 0.55;
          }
          if (type === "illness") {
            if (age < 30) return 0.08;
            if (age < 40) return 0.12;
            if (age < 50) return 0.20;
            return 0.32;
          }
          if (type === "death") {
            if (age < 30) return 0.04;
            if (age < 40) return 0.06;
            if (age < 50) return 0.10;
            return 0.18;
          }
          return 0;
        }

        /* === Build Individual Probability === */

        function buildProb(age, smoker, male, yearsToRet, type) {

          let p = ageBand(age, type);

          if (smoker) p += (type === "death" ? 0.07 : 0.05);
          if (male) p += (type === "death" ? 0.04 : 0.02);
          if (yearsToRet > 25) p += 0.03;

          if (type === "work") p = Math.min(p, 0.75);
          if (type === "illness") p = Math.min(p, 0.60);
          if (type === "death") p = Math.min(p, 0.50);

          return p;
        }

        /* === Individual Risks === */

        const work1 = buildProb(age1, s1Yes, male1, yearsToRet1, "work");
        const illness1 = buildProb(age1, s1Yes, male1, yearsToRet1, "illness");
        const death1 = buildProb(age1, s1Yes, male1, yearsToRet1, "death");

        let riskWork, riskIllness, riskDeath;

        if (val === "joint") {
          const work2 = buildProb(age2, smoker2, male2, yearsToRet2, "work");
          const illness2 = buildProb(age2, smoker2, male2, yearsToRet2, "illness");
          const death2 = buildProb(age2, smoker2, male2, yearsToRet2, "death");

          riskWork = 1 - ((1 - work1) * (1 - work2));
          riskIllness = 1 - ((1 - illness1) * (1 - illness2));
          riskDeath = 1 - ((1 - death1) * (1 - death2));
        } else {
          riskWork = work1;
          riskIllness = illness1;
          riskDeath = death1;
        }

        /* === Impact Score === */

        let impact = 0;

        /* Income Reliance */
        if (val !== "joint") {
          impact += 0.20;
        } else {
          const dominant = Math.max(incomeShare1, incomeShare2);
          if (dominant > 0.70) impact += 0.18;
          else if (dominant > 0.60) impact += 0.12;
          else impact += 0.05;
        }

        /* Mortgage Ratio */
        if (mortgageRatio > 4) impact += 0.25;
        else if (mortgageRatio > 3) impact += 0.18;
        else if (mortgageRatio > 2) impact += 0.10;
        else if (mortgageRatio > 0) impact += 0.05;

        /* Dependants */
        if (d1Yes) impact += 0.20;

        /* Retirement Window */
        if (longestRetWindow > 25) impact += 0.10;
        else if (longestRetWindow > 15) impact += 0.07;
        else impact += 0.03;

        impact = Math.min(impact, 0.75);

        /* === Overall Hybrid Risk === */

        const combinedProbability =
          1 - ((1 - riskWork) * (1 - riskIllness) * (1 - riskDeath));

        const overallRiskRaw =
          combinedProbability * (1 + (impact * 0.6));

        const overallRisk = Math.min(overallRiskRaw, 1);

        /* ================= WRITE TO RESULT IDS ================= */

        const pctWork = Math.round(riskWork * 100);
        const pctIllness = Math.round(riskIllness * 100);
        const pctDeath = Math.round(riskDeath * 100);
        const pctOverall = Math.round(overallRisk * 100);

        /* Tier helper */

        function tier(p) {
          if (p <= 0.25) return "small";
          if (p <= 0.50) return "significant";
          if (p <= 0.75) return "high";
          return "extreme";
        }

        /* Colour logic */

        function applyColour(el, value) {
          const t = tier(value);
          el.style.color =
            t === "small" ? "#FFFFFF" :
              t === "significant" ? "#F5C518" :
                t === "high" ? "#F28C28" :
                  "#D32F2F";
        }

        /* Percent Figures */

        function writePercent(id, value) {
          const el = wrap.querySelector(id);
          if (!el) return;

          const span = el.querySelector("span") || el;
          span.textContent = Math.round(value * 100) + "%";
          applyColour(span, value);
        }

        writePercent("#ra-percent-inability", riskWork);
        writePercent("#ra-percent-illness", riskIllness);
        writePercent("#ra-percent-death", riskDeath);
        writePercent("#ra-percent-overall", overallRisk);

        /* Primary Explain Text (No % inside) */

        wrap.querySelector("#ra-inability-explain").innerHTML =
          `There is a ${tier(riskWork)} likelihood you could experience an illness or condition that prevents you from working for two months or more before retirement.`;

        wrap.querySelector("#ra-illness-explain").innerHTML =
          `There is a ${tier(riskIllness)} likelihood of suffering a serious illness before retirement.`;

        wrap.querySelector("#ra-death-explain").innerHTML =
          `There is a ${tier(riskDeath)} likelihood of death before reaching retirement age.`;

        wrap.querySelector("#ra-overall-explain").innerHTML =
          `Overall, this represents a ${tier(overallRisk)} level of financial vulnerability.`;

        /* ================= IMPACT BULLETS ================= */

function impactBullets() {
  const arr = [];

  if (mortgageRatio > 3)
    arr.push(`Mortgage balance equals ${mortgageRatio.toFixed(1)}× annual income.`);

  if (d1Yes)
    arr.push(`Dependants rely on household income.`);

  if (val !== "joint")
    arr.push(`Household relies on a single primary income.`);

  if (longestRetWindow > 25)
    arr.push(`Financial exposure window extends over 25 years.`);

  return arr;
}

const bullets = impactBullets();

function writeImpactList(selector) {
  const ul = wrap.querySelector(selector);
  if (!ul) return;

  ul.innerHTML = bullets.map(b => `<li>${b}</li>`).join("");
}

writeImpactList("#ra-inability-explain-2");
writeImpactList("#ra-illness-explain-2");
writeImpactList("#ra-death-explain-2");
writeImpactList("#ra-overall-explain-2");


/* ================= INSURANCE SECTION ================= */

const bulletWrap = wrap.querySelector("#ra-insurance-protection-bullet-points");

if (bulletWrap) {

  const blocks = [];

  // Income Protection
  if (riskWork > 0.30) {
    blocks.push(`
      <li>
        <strong style="color:#0B3C6D;">Income Protection</strong><br>
        Provides a regular monthly income if you're unable to work due to illness or injury.
      </li>
    `);
  }

  // Critical Illness
  if (riskIllness > 0.20) {
    blocks.push(`
      <li>
        <strong style="color:#0B3C6D;">Critical Illness Cover</strong><br>
        Pays a lump sum on diagnosis of a specified serious illness.
      </li>
    `);
  }

  // Life Insurance
  if (riskDeath > 0.15) {
    blocks.push(`
      <li>
        <strong style="color:#0B3C6D;">Life Insurance</strong><br>
        Provides a lump sum to help protect dependants or clear outstanding debts.
      </li>
    `);
  }

  // Family Income Benefit (dependant-driven)
  if (d1Yes && riskDeath > 0.10) {
    blocks.push(`
      <li>
        <strong style="color:#0B3C6D;">Family Income Benefit</strong><br>
        Pays a regular tax-free income to your family if you pass away during the policy term.
      </li>
    `);
  }

  bulletWrap.innerHTML = blocks.join("");
  bulletWrap.style.display = blocks.length ? "block" : "none";
}
        /* Household Summary (unchanged) */

        const summaryBlock = wrap.querySelector("#ra-household-summary");

        if (summaryBlock) {
          summaryBlock.innerHTML = `
    <div class="digital-tools-label">Household Income Summary</div>
    <ul class="results-list">
      <li><strong>Applicant Income:</strong> 
        <span class="txt-amount">${fmtGBP(income1)}</span>
      </li>
      ${val === "joint"
              ? `<li><strong>Partner Income:</strong> 
            <span class="txt-amount">${fmtGBP(income2)}</span>
           </li>`
              : ""}
      <li><strong>Total Household Income:</strong> 
        <span class="txt-amount">${fmtGBP(totalIncome)}</span>
      </li>
      ${hasMortgage
              ? `<li><strong>Outstanding Mortgage:</strong> 
            <span class="txt-amount">${fmtGBP(mortgageBal)}</span>
           </li>`
              : ""}
    </ul>
  `;
          summaryBlock.style.display = "block";

          if (results) {
            /* ---- STATE STORAGE FOR ADVISER ---- */
            window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {};
            window.PRUD_CALC_STATE.riskAssessment = {
              inputs: {
                applicationType: appType?.value || "",
                income1: income1,
                income2: income2,
                totalIncome: totalIncome,
                hasMortgage: hasMortgage,
                mortgageBalance: mortgageBal
              },
              results: {
                riskResult: pctWork
              }
            };

            results.style.display = "block";
            scrollSmooth(results);
          } // END if (results)

        } // END if (summaryBlock)

      } catch (err) {
        console.error("[PRUDELL][RA ERROR]", err);
      }

      }); // END ra-calc click

    /* ---- Hide Results On Input Change ---- */
    ["ra-1-income", "ra-2-income", "ra-1-age", "ra-1-retirement-age", "ra-2-age", "ra-2-retirement-age", "ra-mortgage-balance"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          if (results && results.style.display === "block") {
            results.style.display = "none";
          }
        });
      }
    });

    ["ra-app-type", "ra-1-gender-male", "ra-1-gender-female", "ra-2-gender-male", "ra-2-gender-female", "ra-1-smoker-yes", "ra-1-smoker-no", "ra-2-smoker-yes", "ra-2-smoker-no", "ra-dependants-yes", "ra-dependants-no", "ra-existing-mortgage-yes", "ra-existing-mortgage-no"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          if (results && results.style.display === "block") {
            results.style.display = "none";
          }
        });
      }
    });

    /* ================= RESET ================= */

    document.getElementById("ra-reset")?.addEventListener("click", function () {

      form.reset();

      if (results) results.style.display = "none";
      if (errorBox) errorBox.style.display = "none";
      if (app2Wrap) app2Wrap.style.display = "none";

      if (mortgageWrap) mortgageWrap.style.display = "none";
    });
  }

  /* ================= RISK ASSESSMENT calc END ================= */


  /* ============================================================
     1. BORROWING POWER → ADVISOR
  ============================================================ */

  document.querySelectorAll("#bp-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.borrowingPower;
    if (!state) return;

    if (intro) {
      intro.innerHTML =
        'Your <strong>Borrowing Power</strong> results will be forwarded to an adviser.';
      intro.style.display = "block";
    }

    if (summary) {
      const userInputText = line(
          `Application type: ${state.inputs.applicationType === "joint" ? "Joint" : "Single"}`,
          `Gross Income: ${fmtGBP(state.inputs.income1)}`,
          state.inputs.applicationType === "joint"
            ? `Applicant 2 Income: ${fmtGBP(state.inputs.income2)}`
            : "",
          `Other Annual Income: ${fmtGBP(state.inputs.otherIncome)}`,
          `Desired property price: ${fmtGBP(state.inputs.desiredPrice)}`,
          `Deposit: ${fmtGBP(state.inputs.deposit)}`
        );

      const resultsText = line(
          `Estimated maximum loan: ${state.results.maxLoan}`,
          state.inputs.desiredPrice > 0
            ? `Example Purchase: Desired property: ${fmtGBP(state.inputs.desiredPrice)}, deposit: ${fmtGBP(state.inputs.deposit)}, required loan: ${fmtGBP(state.inputs.desiredPrice - state.inputs.deposit)}.`
            : `Estimated max property price: ${fmtGBP(state.results.estimatedMaxPrice)}`
        );

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) source.value = "Borrowing Power Calculator";

    openAdvisorFormFromCalculator(triggerEl);
  }));


  /* ============================================================
     2. MORTGAGE FINDER → ADVISOR
  ============================================================ */

  document.querySelectorAll("#mf-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const state = window.PRUD_CALC_STATE?.mortgageFinder;

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    if (intro) {
      intro.innerHTML =
        'Your <strong>Mortgage Finder</strong> results will be forwarded to an adviser.';
      intro.style.display = "block";
    }

    function cardBlock(title, d) {
      if (!d) return "";

      const rateLabel =
        d.rateType === "fixed" && d.term
          ? `${d.term}-year fixed`
          : "variable";

      return (
        `${title}
Monthly Payment: ${d.payment}
Interest Rate: ${d.rate.toFixed(2)}% (${rateLabel})
Product Fee: ${d.fee ? fmtGBP(d.fee) : "None"}
${d.cashback ? `Cashback: ${fmtGBP(d.cashback)}` : ""}`
      );
    }

    if (summary) {
      const fallback = {
        inputs: {
          price: num(document.getElementById("mf-prop-price")),
          deposit: num(document.getElementById("mf-deposit")),
          loan: Math.max(0, num(document.getElementById("mf-prop-price")) - num(document.getElementById("mf-deposit"))),
          ltv: valueOf("mf-ltv") || "",
          mortgageType: valueOf("mf-mortgage-type"),
          mortgageTermYears: valueOf("mf-mortgage-term"),
          ratePreference: valueOf("mf-rate-preference")
        },
        cards: {
          LMP: { payment: textOf("mf-lowest-monthly-payment"), rate: parseFloat((textOf("mf-LMP-interest-rate").match(/[\d.]+/) || [0])[0]) || 0, rateType: "fixed", term: 2, fee: num(document.getElementById("mf-lmp-product-fee")), cashback: (textOf("mf-LMP-bullet-points").toLowerCase().includes("cashback") ? 500 : 0) },
          LUC: { payment: textOf("mf-lower-upfront-costs"), rate: parseFloat((textOf("mf-LUC-interest-rate").match(/[\d.]+/) || [0])[0]) || 0, rateType: "fixed", term: 2, fee: num(document.getElementById("mf-LUC-product-fee")), cashback: 0 },
          LTS: { payment: textOf("mf-longer-term-stability"), rate: parseFloat((textOf("mf-LTS-interest-rate").match(/[\d.]+/) || [0])[0]) || 0, rateType: "fixed", term: 5, fee: num(document.getElementById("mf-LTS-product-fee")), cashback: 0 }
        }
      };
      const safeState = state || fallback;

      const userInputText = `Property Price: ${fmtGBP(safeState.inputs.price || 0)}
Deposit: ${fmtGBP(safeState.inputs.deposit || 0)}
Loan: ${fmtGBP(safeState.inputs.loan || 0)}
LTV: ${safeState.inputs.ltv || "—"}%
Mortgage Type: ${safeState.inputs.mortgageType || "—"}
Mortgage Term: ${safeState.inputs.mortgageTermYears || "—"} years
    Rate Preference: ${safeState.inputs.ratePreference || "—"}`;

      const resultsText = `${block("LOWEST MONTHLY PAYMENT")}
${cardBlock(" ", safeState.cards?.LMP)}
${block("LOWER UPFRONT COSTS")}
${cardBlock(" ", safeState.cards?.LUC)}
${block("LONGER-TERM STABILITY")}
    ${cardBlock(" ", safeState.cards?.LTS)}`;

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) source.value = "Mortgage Finder Calculator";

    openAdvisorFormFromCalculator(triggerEl);
  }));


  /* ============================================================
     3. MORTGAGE REFINANCE → ADVISOR
  ============================================================ */

  document.querySelectorAll("#mr-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.mortgageRefinance;

    if (intro) {
      intro.innerHTML =
        'Your <strong>Mortgage Refinance</strong> calculation will be forwarded to an adviser.';
      intro.style.display = "block";
    }

    if (summary) {
      const fallback = {
        inputs: {
          remainingLoan: num(document.getElementById("mr-remaining-loan")),
          mortgageTerm: ((num(document.getElementById("mr-mortgage-term-years")) * 12) + num(document.getElementById("mr-mortgage-term-months"))),
          currentRate: valueOf("mr-current-interest-rate"),
          extraBorrow: num(document.getElementById("mr-borrow-amount")),
          newRate: valueOf("mr-new-interest-rate"),
          productFee: num(document.getElementById("mr-product-fee")),
          repaymentFee: num(document.getElementById("mr-repayment-fee"))
        },
        results: {
          newMonthlyPayment: textOf("mr-new-monthly-payment"),
          monthlySaving: textOf("mr-monthly-saving"),
          breakEvenYear: textOf("mr-break-even-year"),
          breakEvenMonths: textOf("mr-break-even-months")
        }
      };
      const safeState = state || fallback;

      const userInputText = `Remaining Loan: ${fmtGBP(safeState.inputs.remainingLoan || 0)}
    Mortgage Term: ${Math.round(((safeState.inputs.mortgageTerm || 0) / 12) || 0)} years
    Current Rate: ${safeState.inputs.currentRate || "—"}%
Extra Borrowing: ${fmtGBP(safeState.inputs.extraBorrow || 0)}
Total Loan: ${fmtGBP((safeState.inputs.remainingLoan || 0) + (safeState.inputs.extraBorrow || 0))}
New Rate: ${safeState.inputs.newRate || "—"}%
Product Fee: ${fmtGBP(safeState.inputs.productFee || 0)}
    Early Repayment Fee: ${fmtGBP(safeState.inputs.repaymentFee || 0)}`;

      const resultsText = `New Monthly Payment: ${safeState.results.newMonthlyPayment || "—"}
Monthly Saving: ${safeState.results.monthlySaving || "—"}
    Break-Even: ${safeState.results.breakEvenYear || "—"} ${safeState.results.breakEvenMonths || ""}`;

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) source.value = "Mortgage Refinance Calculator";

    openAdvisorFormFromCalculator(triggerEl);
  }));


  /* ============================================================
     4. REPAYMENT CALCULATOR → ADVISOR
  ============================================================ */

  document.querySelectorAll("#repay-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.repayment;

    if (intro) {
      intro.innerHTML =
        'Your <strong>Repayment Calculator</strong> results will be forwarded to the adviser.';
      intro.style.display = "block";
    }

    if (summary) {
      const fallback = {
        inputs: {
          loanAmount: num(document.getElementById("repay-loan")),
          interestRate: valueOf("repay-rate"),
          mortgageTerm: valueOf("repay-term"),
          mortgageType: valueOf("repay-mortgage-type"),
          repaymentType: valueOf("repay-type"),
          voluntaryPayment: num(document.getElementById("repay-voluntary-payment")),
          propertyValue: num(document.getElementById("repay-property-value"))
        },
        results: {
          monthlyPayment: textOf("repay-monthly"),
          totalRepaid: textOf("repay-total"),
          totalInterest: textOf("repay-total-interest")
        }
      };
      const safeState = state || fallback;

      const userInputText = line(
        `Loan Amount: ${fmtGBP(safeState.inputs.loanAmount || 0)}`,
        `Interest Rate: ${safeState.inputs.interestRate || "—"}%`,
        `Mortgage Term: ${safeState.inputs.mortgageTerm || "—"} years`,
        `Mortgage Type: ${safeState.inputs.mortgageType || "—"}`,
        `Repayment Type: ${safeState.inputs.repaymentType || "—"}`,
        (safeState.inputs.voluntaryPayment || 0) > 0
          ? `Voluntary monthly payment: ${fmtGBP(safeState.inputs.voluntaryPayment)}`
          : "",
        (safeState.inputs.propertyValue || 0) > 0
          ? line(
              `Property Value: ${fmtGBP(safeState.inputs.propertyValue)}`,
              `Growth Assumption Used: 2.5% per year`
            )
          : ""
      );

      const resultsText = `Monthly Payment: ${safeState.results.monthlyPayment || "—"}
Total Repaid: ${safeState.results.totalRepaid || "—"}
Total Interest: ${safeState.results.totalInterest || "—"}`;

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) source.value = "Repayment Calculator";

    openAdvisorFormFromCalculator(triggerEl);
  }));


  /* ============================================================
     5. STAMP DUTY → ADVISOR
  ============================================================ */

  document.querySelectorAll("#sd-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.stampDuty;

    if (intro) {
      intro.innerHTML =
        'Your <strong>Stamp Duty Calculator</strong> results will be forwarded to the adviser.';
      intro.style.display = "block";
    }

    if (summary) {
      const fallback = {
        inputs: {
          propertyPrice: num(document.getElementById("sd-price")),
          country: valueOf("sd-country"),
          buyerType: valueOf("sd-buyer-type"),
          replacing: !!document.getElementById("sd-replace-main")?.checked
        },
        results: {
          stampDutyPayable: textOf("sd-output-total")
        }
      };
      const safeState = state || fallback;

      const userInputText = `Property Price: ${fmtGBP(safeState.inputs.propertyPrice || 0)}
Country: ${safeState.inputs.country || "—"}
Buyer Type: ${safeState.inputs.buyerType || "—"}
Replacing Main Residence: ${safeState.inputs.replacing ? "Yes" : "No"}`;

      const resultsText = `Stamp Duty Payable:\n${safeState.results.stampDutyPayable || "—"}`;

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) source.value = "Stamp Duty Calculator";

    openAdvisorFormFromCalculator(triggerEl);
  }));


  /* ============================================================
     6. INSURANCE PROTECTION → ADVISOR
  ============================================================ */

  document.querySelectorAll("#ip-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.insuranceProtection;

    if (intro) {
      intro.innerHTML =
        "Your <strong>Insurance Protection</strong> results will be forwarded to an adviser.";
      intro.style.display = "block";
    }

    if (summary) {
      const fallback = {
        inputs: {
          age: valueOf("ip-age"),
          smoker: document.getElementById("ip-smoker-yes")?.checked ? "Yes" : (document.getElementById("ip-smoker-no")?.checked ? "No" : "—"),
          health: valueOf("ip-general-health"),
          family: valueOf("ip-family-situation"),
          dependants: valueOf("ip-dependants"),
          youngest: valueOf("ip-youngest-dependants-age"),
          income: fmtGBP(num(document.getElementById("ip-gross-income"))),
          mortgage: fmtGBP(num(document.getElementById("ip-outstanding-mortgage"))),
          debts: fmtGBP(num(document.getElementById("ip-other-debts"))),
          existing: document.getElementById("ip-existing-insurance-protection-yes")?.checked ? "Yes" : (document.getElementById("ip-existing-insurance-protection-no")?.checked ? "No" : "—"),
          existingCoverAmount: document.getElementById("ip-existing-insurance-protection-yes")?.checked
            ? fmtGBP(num(document.getElementById("ip-protection-cover-amount")))
            : "None"
        },
        results: {
          cover: textOf("ip-estimated-cover"),
          monthly: textOf("ip-monthly-cost"),
          breakdown: textOf("ip-breakdown"),
          assumptions: textOf("ip-assumptions"),
          recommendation: textOf("ip-recommendation-wrapper")
        }
      };
      const safeState = state || fallback;

      const userInputText = `Age: ${safeState.inputs.age || "—"}
Smoker: ${safeState.inputs.smoker || "—"}
General health: ${safeState.inputs.health || "—"}
Family situation: ${safeState.inputs.family || "—"}
Dependants: ${safeState.inputs.dependants || "None"}
Youngest dependant age: ${safeState.inputs.youngest || "—"}
Gross income: ${safeState.inputs.income || "—"}
Outstanding mortgage: ${safeState.inputs.mortgage || "—"}
Other debts: ${safeState.inputs.debts || "—"}
Existing protection:
${safeState.inputs.existing || "—"}
Existing protection cover amount: ${safeState.inputs.existingCoverAmount || "—"}`;

  const cleanBreakdown = String(safeState.results.breakdown || "")
    .replace(/^\s*Protection\s*Breakdown\s*and\s*Payout\s*:?\s*/i, "")
    .trim();

  const cleanAssumptions = String(safeState.results.assumptions || "")
    .replace(/^\s*Important\s*Information\s*:?\s*/i, "")
    .trim();

  const cleanRecommendation = String(safeState.results.recommendation || "")
    .replace(/^\s*Adviser\s*Notes\s*\/\s*Recommendation\s*:?\s*/i, "")
    .trim();

  const resultsParts = [];

  if (safeState.results.cover) {
    resultsParts.push(`Estimated cover: ${safeState.results.cover}`);
  }

  if (safeState.results.monthly) {
    resultsParts.push(`Estimated monthly cost: ${safeState.results.monthly}`);
  }

  if (cleanBreakdown) {
    resultsParts.push(
      "",
      "Protection Breakdown and Payout",
      "------------------------------------------------------------",
      cleanBreakdown
    );
  }

  if (cleanAssumptions) {
    resultsParts.push(
      "",
      "Important Information",
      "------------------------------------------------------------",
      cleanAssumptions
    );
  }

  resultsParts.push(
    "",
    "Advisor Recommendation",
    "------------------------------------------------------------",
    cleanRecommendation || "—"
  );

  const resultsText = resultsParts.join("\n");

  summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) {
      source.value = "Insurance Protection Calculator";
    }

    openAdvisorFormFromCalculator(triggerEl);
  }));


  /* ============================================================
     7. AFFORDABILITY → ADVISOR
  ============================================================ */

  document.querySelectorAll("#ma-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.affordability;

    if (intro) {
      intro.innerHTML =
        'Your <strong>Affordability</strong> results will be forwarded to an adviser.';
      intro.style.display = "block";
    }

    if (summary) {
      const fallback = {
        inputs: {
          applicationType: valueOf("ma-app-type"),
          frequency: document.querySelector("#afford-form")?.dataset?.frequency || "monthly",
          income1: num(document.getElementById("ma-inc1")),
          income2: num(document.getElementById("ma-inc2")),
          otherIncome: num(document.getElementById("ma-other")),
          totalIncome: num(document.getElementById("ma-inc1")) + num(document.getElementById("ma-inc2")) + num(document.getElementById("ma-other")),
          simpleOutgoings: num(document.getElementById("ma-monthly-out")),
          advancedOutgoings: num(document.getElementById("ma-monthly-outgoings-total")),
          debts: num(document.getElementById("ma-debts")),
          existingMortgagePayment: num(document.getElementById("ma-existing")),
          stressRate: valueOf("ma-stress-rate"),
          incomeMultiplier: valueOf("ma-multiple"),
          mortgageTerm: valueOf("ma-term")
        },
        results: {
          stressTestedLoan: textOf("ma-a-loan"),
          incomeMultipleLoan: textOf("ma-b-loan"),
          recommendedMaxLoan: textOf("ma-final-loan")
        }
      };
      const safeState = state || fallback;

      const userInputText = `Application type: ${safeState.inputs.applicationType || "—"}
Income frequency: ${safeState.inputs.frequency || "—"}
Applicant Income: ${fmtGBP(safeState.inputs.income1 || 0)}
${safeState.inputs.applicationType === "joint" ? `Applicant 2 Income: ${fmtGBP(safeState.inputs.income2 || 0)}\n` : ""}Other Income: ${fmtGBP(safeState.inputs.otherIncome || 0)}
Total income: ${fmtGBP(safeState.inputs.totalIncome || 0)}
Simple outgoings: ${fmtGBP(safeState.inputs.simpleOutgoings || 0)}
Advanced outgoings: ${fmtGBP(safeState.inputs.advancedOutgoings || 0)}
Debts: ${fmtGBP(safeState.inputs.debts || 0)}
Existing mortgage payment: ${fmtGBP(safeState.inputs.existingMortgagePayment || 0)}
Stress rate used: ${safeState.inputs.stressRate || "—"}%
Income multiplier used: ${safeState.inputs.incomeMultiplier || "—"}
Mortgage term: ${safeState.inputs.mortgageTerm || "—"} years`;

      const resultsText = `Stress-tested loan (A): ${safeState.results.stressTestedLoan || "—"}
Income multiple loan (B): ${safeState.results.incomeMultipleLoan || "—"}
Recommended maximum loan: ${safeState.results.recommendedMaxLoan || "—"}`;

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
      summary.disabled = false;
    }

    if (source) {
      source.value = "Affordability Calculator";
    }

    openAdvisorFormFromCalculator(triggerEl);
  }));

  /* ===== END AFFORDABILITY → ADVISOR ===== */


  /* ============================================================
     8. RISK ASSESSMENT → ADVISER
  ============================================================ */

  document.querySelectorAll("#ra-adviser").forEach(el => el.addEventListener("click", ev => {
    if (window.PRUD_INTERNAL_ADVISER_OPENING) {
      window.PRUD_INTERNAL_ADVISER_OPENING = false;
      return;
    }
    ev.preventDefault();
    const triggerEl = ev.currentTarget;
    resetAdvisorForm(true);
    populateAdvisorMeta();

    const intro = document.getElementById("advisor-intro");
    const summary = getAdvisorField("#advisor-summary");
    const source = getAdvisorField("#app-source");

    const state = window.PRUD_CALC_STATE?.riskAssessment;

    const pctWork =
      document.getElementById("ra-percent-inability")?.textContent;

    const pctIllness =
      document.getElementById("ra-percent-illness")?.textContent;

    const pctDeath =
      document.getElementById("ra-percent-death")?.textContent;

    const pctOverall =
      document.getElementById("ra-percent-overall")?.textContent;

    const recommendation =
      document.getElementById("ra-insurance-protection-bullet-points")?.innerText || "—";

    if (intro) {
      intro.innerHTML =
        'Your <strong>Risk Assessment</strong> results will be forwarded to an adviser.';
      intro.style.display = "block";
    }

    if (summary) {
      const fallback = {
        inputs: {
          applicationType: valueOf("ra-app-type"),
          income1: num(document.getElementById("ra-1-income")),
          income2: num(document.getElementById("ra-2-income")),
          totalIncome: num(document.getElementById("ra-1-income")) + num(document.getElementById("ra-2-income")),
          hasMortgage: !!document.getElementById("ra-existing-mortgage-yes")?.checked,
          mortgageBalance: num(document.getElementById("ra-mortgage-balance"))
        }
      };
      const safeState = state || fallback;

      const userInputText = `Application type: ${safeState.inputs.applicationType || "—"}
    Applicant income: ${fmtGBP(safeState.inputs.income1 || 0)}
    ${safeState.inputs.income2 ? `Partner income: ${fmtGBP(safeState.inputs.income2)}\n` : ""}Total household income: ${fmtGBP(safeState.inputs.totalIncome || 0)}
    Has outstanding mortgage: ${safeState.inputs.hasMortgage ? "Yes" : "No"}
    Outstanding mortgage: ${safeState.inputs.hasMortgage ? fmtGBP(safeState.inputs.mortgageBalance || 0) : "None"}`;

      const resultsText = `Unable to work likelihood: ${pctWork || "—"}
    Serious illness likelihood: ${pctIllness || "—"}
    Death likelihood: ${pctDeath || "—"}
    Overall family impact: ${pctOverall || "—"}
    Adviser recommendation:
    ${recommendation}`;

      summary.value = htmlify(buildAdvisorSummary(resultsText, userInputText));
    }

    if (source) {
      source.value = "Risk Assessment Calculator";
    }

    openAdvisorFormFromCalculator(triggerEl);
  }));

  /* ===== END RISK ASSESSMENT → ADVISOR ===== */

  /* ===== END ADVISOR SECTION ===== */

  document.addEventListener("click", function (e) {
    const trigger = e.target.closest("[data-load-calc]");
    if (!trigger) return;

    const type = trigger.getAttribute("data-load-calc");
    const targetId = DEFERRED_TYPE_TO_TARGET[type];
    if (!targetId) return;

    const cfg = DEFERRED_CALCULATOR_CONFIG[targetId];
    const container = document.getElementById(cfg.containerId);
    if (container && container.dataset.loaded === "true") {
      initCalculatorByTarget(targetId);
      return;
    }

    const panel = ensureDeferredCalculatorPanel(targetId);
    if (!panel) return;

    if (container) {
      container.dataset.loaded = "true";
    }

    initCalculatorByTarget(targetId);
  });

  // Defer large calculator panels until users explicitly open them.
  deferCalculatorPanels();

  debug("IP FUNCTION EXISTS:", typeof initInsuranceProtectionCalc);
  debug("SCRIPT END REACHED");

}); // ✅ END window.Webflow.push

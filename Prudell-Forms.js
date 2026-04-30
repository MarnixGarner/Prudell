window.Webflow = window.Webflow || [];
window.Webflow.push(function () {

  /* ===== PRUDELL FORMS GUARD ===== */

  const PRUDELL_FORMS_KEY = "__PRUDELL_FORMS_LOADED__";

  const IS_FORMS_REBIND =
    window[PRUDELL_FORMS_KEY] && !window.Webflow?.env?.design;

  window[PRUDELL_FORMS_KEY] = true;

  if (IS_FORMS_REBIND) {
    console.warn("[PRUDELL] Forms already initialised - skipping rebind");
    return;
  }

  /* ===== PRUDELL FORMS GUARD END ===== */

  /* ===== DEBUG MODE =====
     Toggle to true when diagnosing issues
  ------------------------------------- */
  const PRUDELL_DEBUG = false; // set true only for diagnostics
  /* ===== DEBUG MODE — END ===== */

  function debug() {
    if (!PRUDELL_DEBUG) return;
    console.log.apply(console, ["[PRUDELL]", ...arguments]);
  }

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

  function bindPrivacyConsentValidation() {
    function formatPrivacyConsentTimestamp() {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
        hour12: false
      }).formatToParts(new Date());

      const getPart = type =>
        parts.find(part => part.type === type)?.value || "";

      return `${getPart("day")}/${getPart("month")}/${getPart("year")} ${getPart("hour")}:${getPart("minute")}:${getPart("second")} ${getPart("timeZoneName")}`;
    }

    document.querySelectorAll("form").forEach(form => {
      if (form.dataset.prudPrivacyConsentBound === "true") return;

      const checkbox = form.querySelector('[name^="Privacy-Policy"], [name^="privacy-policy"]');
      const checkboxFieldBox = checkbox?.closest(".field-box-area") || null;
      const consent = form.querySelector('[name="privacy_consent_given"]');
      const timestamp = form.querySelector('[name="privacy_consent_timestamp"]');
      const error = form.querySelector('.privacy-policy-error-message');

      if (!checkbox || !timestamp || !error) return;

      // Friendly labels for Webflow notification emails.
      checkbox.setAttribute("data-name", "Privacy Consent");
      timestamp.setAttribute("data-name", "Privacy Consent Timestamp");

      // Optional legacy field. If it still exists, keep it out of submissions.
      if (consent) {
        consent.disabled = true;
      }

      form.dataset.prudPrivacyConsentBound = "true";

      function setUncheckedAudit() {
        if (consent) {
          consent.value = "false";
        }
        timestamp.value = "";
      }

      function hideError() {
        error.style.display = "none";
        checkbox.removeAttribute("aria-invalid");
      }

      function showError() {
        error.style.display = "block";
        checkbox.setAttribute("aria-invalid", "true");

        const firstGroupInput =
          checkboxFieldBox?.querySelector('.checkbox-group input[type="checkbox"], .checkbox-group input[type="radio"]') ||
          checkbox;

        const webflowFocusTarget = focusFieldBoxArea(firstGroupInput) || firstGroupInput;
        focusErrorMessage(error, webflowFocusTarget);
      }

      function blockSubmissionEvent(e) {
        lockNearestPopupFormWidth(checkbox, true);
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
        setUncheckedAudit();
        showError();
      }

      if (!checkbox.checked) {
        setUncheckedAudit();
      }

      checkbox.addEventListener("change", function () {
        if (this.checked) {
          hideError();
          return;
        }

        setUncheckedAudit();
      });

      form.addEventListener("submit", function (e) {
        lockNearestPopupFormWidth(checkbox, true);

        if (!checkbox.checked) {
          blockSubmissionEvent(e);
          return;
        }

        hideError();
        if (consent) {
          consent.value = "true";
        }
        timestamp.value = formatPrivacyConsentTimestamp();
      }, true);

      form
        .querySelectorAll('button[type="submit"], input[type="submit"]')
        .forEach(btn => {
          btn.addEventListener("click", function (e) {
            lockNearestPopupFormWidth(btn, true);
            if (!checkbox.checked) {
              blockSubmissionEvent(e);
            }
          }, true);
        });
    });
  }

  function bindAdvisorServiceSelectionValidation() {
    document.querySelectorAll("form").forEach(form => {
      if (form.dataset.prudAdvisorServiceBound === "true") return;

      const serviceInputs = Array.from(
        form.querySelectorAll(
          '._3-checkboxes input[type="checkbox"], .services-row input[type="checkbox"], .services-group input[type="checkbox"], input.checkbox.services[type="checkbox"]'
        )
      );

      if (!serviceInputs.length) return;

      form.dataset.prudAdvisorServiceBound = "true";

      const servicesWrap =
        serviceInputs[0].closest("._3-checkboxes") ||
        serviceInputs[0].closest(".services-row") ||
        serviceInputs[0].closest(".services-group") ||
        serviceInputs[0].closest(".field-box-area") ||
        serviceInputs[0].parentElement;

      const sharedPrivacyError = form.querySelector(".privacy-policy-error-message");
      let error = form.querySelector(".advisor-services-error-message") || sharedPrivacyError;
      const usesSharedPrivacyError = !!sharedPrivacyError && !form.querySelector(".advisor-services-error-message");
      const sharedPrivacyErrorDefaultHTML = usesSharedPrivacyError
        ? String(sharedPrivacyError.innerHTML || "")
        : "";

      if (!error) {
        error = document.createElement("div");
        error.className = "error-message advisor-services-error-message";
        error.setAttribute("aria-live", "assertive");
        error.setAttribute("role", "alert");
        error.style.display = "none";
        error.innerHTML =
          "<span>Please select at least one Service to Cover our discussion.</span>";

        if (servicesWrap?.parentNode) {
          servicesWrap.parentNode.insertBefore(error, servicesWrap.nextSibling);
        }
      }

      function focusServiceGroupArea() {
        const target =
          servicesWrap?.closest(".field-box-area") ||
          servicesWrap?.closest(".checkbox-field-container") ||
          servicesWrap ||
          serviceInputs[0] ||
          null;

        if (!target) return null;

        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1");
        }

        try {
          target.focus({ preventScroll: true });
        } catch (e) {
          target.focus();
        }

        return target;
      }

      function hideError() {
        if (error) error.style.display = "none";
        if (usesSharedPrivacyError && error) {
          error.innerHTML = sharedPrivacyErrorDefaultHTML;
        }
        serviceInputs.forEach(input => input.removeAttribute("aria-invalid"));
      }

      function showError() {
        if (error) {
          error.style.display = "block";
          error.innerHTML = "<span>Please select at least one Service to Cover our discussion.</span>";
        }
        serviceInputs.forEach(input => input.setAttribute("aria-invalid", "true"));

        const target =
          focusFieldBoxArea(servicesWrap) ||
          focusServiceGroupArea() ||
          focusFieldBoxArea(serviceInputs[0]) ||
          serviceInputs[0];

        focusErrorMessage(error, target);
      }

      function isValidSelection() {
        return serviceInputs.some(input => input.checked);
      }

      function blockSubmissionEvent(e) {
        lockNearestPopupFormWidth(serviceInputs[0], true);
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
          e.stopImmediatePropagation();
        }
        showError();
      }

      serviceInputs.forEach(input => {
        input.addEventListener("change", () => {
          if (isValidSelection()) hideError();
        });
      });

      form.addEventListener("submit", function (e) {
        if (isValidSelection()) {
          hideError();
          return;
        }

        blockSubmissionEvent(e);
      }, true);

      form
        .querySelectorAll('button[type="submit"], input[type="submit"]')
        .forEach(btn => {
          btn.addEventListener("click", function (e) {
            lockNearestPopupFormWidth(btn, true);
            if (!isValidSelection()) {
              blockSubmissionEvent(e);
            }
          }, true);
        });
    });
  }

  function bindGroupedCheckboxValidation() {
    if (document.body?.dataset.prudGroupedCheckboxBound === "true") return;
    if (document.body) {
      document.body.dataset.prudGroupedCheckboxBound = "true";
    }

    document.addEventListener("click", function (e) {
      const group = e.target?.closest?.(".checkbox-group");
      if (!group) return;

      const input = group.querySelector('input[type="checkbox"], input[type="radio"]');
      if (!input || input.disabled) return;

      if (e.target === input || e.target.closest("label")) return;

      e.preventDefault();

      if (input.type === "radio") {
        if (input.checked) return;
        input.checked = true;
      } else {
        input.checked = !input.checked;
      }

      input.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        input.focus({ preventScroll: true });
      } catch (err) {
        input.focus();
      }
    }, true);

    document.addEventListener("change", function (e) {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.closest(".checkbox-group")) return;

      const fieldBox = input.closest(".field-box-area");
      if (!fieldBox) return;

      const groupInputs = fieldBox.querySelectorAll('.checkbox-group input[type="checkbox"], .checkbox-group input[type="radio"]');
      const anyChecked = Array.from(groupInputs).some(el => el.checked);

      if (anyChecked) {
        groupInputs.forEach(el => el.removeAttribute("aria-invalid"));
      }
    }, true);

    document.addEventListener("invalid", function (e) {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.closest(".checkbox-group")) return;

      const fieldBox = input.closest(".field-box-area");
      if (!fieldBox) return;

      input.setAttribute("aria-invalid", "true");

      const firstInput =
        fieldBox.querySelector('.checkbox-group input[type="checkbox"], .checkbox-group input[type="radio"]') ||
        input;

      requestAnimationFrame(() => {
        focusFieldBoxArea(firstInput);
      });
    }, true);
  }

  /* ===== DEFENSIVE DOM GUARDS — END ===== */

  injectWebflowFocusNormalization();
  bindGroupedCheckboxValidation();
  bindPrivacyConsentValidation();
  bindAdvisorServiceSelectionValidation();

  /* ===== ADVISER DATA CAPTURE =====
     PURPOSE:
     Capture adviser metadata BEFORE Webflow IX2 opens the popup.
     This is required because IX2 can intercept clicks and break
     downstream capture if we rely on [data-open-form] alone.
  ================================= */

  window.LAST_ADVISER_TRIGGER = null;

  // legacy per-card capture (works when clicking directly on the element)
  document.querySelectorAll('[data-advisor-name]').forEach(card => {
    card.addEventListener('click', ev => {

      const advName =
        card.getAttribute('data-advisor-name') ||
        card.dataset?.advisorName ||
        "";

      const advRole =
        card.getAttribute('data-advisor-role') ||
        card.dataset?.advisorRole ||
        "";

      window.LAST_ADVISER_TRIGGER = {
        dataset: {
          advisorName: advName,
          advisorRole: advRole
        }
      };

      debug("[ADVISER DATA CAPTURE]", {
        advisorName: advName,
        advisorRole: advRole,
        element: card
      });
    });
  });

  // global click listener – catch advisor metadata when any child element
  // is clicked or when non‑standard triggers (e.g. homepage contact links)
  document.addEventListener('click', ev => {
    const advEl = ev.target.closest('[data-advisor-name]');
    
    if (!advEl) {
      return;
    }

    const advName =
      advEl.getAttribute('data-advisor-name') ||
      advEl.dataset?.advisorName ||
      "";
    const advRole =
      advEl.getAttribute('data-advisor-role') ||
      advEl.dataset?.advisorRole ||
      "";

    // store both the trigger data AND the element for later fallback
    if (advName || advRole) {
      window.LAST_ADVISER_TRIGGER = { dataset: { advisorName: advName, advisorRole: advRole } };
      window.LAST_CLICKED_ADVISER_ELEMENT = advEl;
      
      // immediately try to populate any visible adviser form fields
      // (in case the form is already open or will be opened by same click)
      setTimeout(() => {
        setAdvisorMetaEverywhere(advName, advRole);
      }, 50);
      
      debug("[ADVISER DATA CAPTURE: global click]", { advisorName: advName, advisorRole: advRole, element: advEl });
    }
  });

  /* ===== END ADVISER DATA CAPTURE ===== */


  /* ============================================================
     SHARED CALCULATOR STATE (READ BY ADVISER SECTION ONLY)
  ============================================================ */

  window.PRUD_CALC_STATE = window.PRUD_CALC_STATE || {
    mortgageFinder: null,
    insuranceProtection: null
  };

  window.PRUD_ADVISOR_PAYLOAD_READY = false;

  /* ===== 01. UTILITIES — CLEANED ===== */

  function stripCommas(v) {
    return String(v || "").replace(/,/g, "");
  }

  function num(el, fb = 0) {
    if (!el) return fb;
    let v = stripCommas(el.value || "").replace(/[^0-9.\-]/g, "");
    let n = parseFloat(v);
    return isNaN(n) ? fb : n;
  }


  function resetWebflowForm(panel) {
    if (!panel) return;
    panel.querySelectorAll("form").forEach(f => {
      const isAdvisorRequestForm =
        [
          "advisor-request-form",
          "contact-advisor-form",
          "Advisor-Contact-Form",
          "wf-form-Advisor-Callback-Form"
        ].includes(f.id) ||
        [
          "wf-form-Advisor-Request-Form",
          "wf-form-Contact-Advisor-Form",
          "wf-form-Advisor-Form",
          "wf-form-Advisor-Callback-Form"
        ].includes(f.getAttribute("name") || "");

      try {
        if (!isAdvisorRequestForm) {
          // Keep native default restoration for calculator forms.
          f.reset();
        } else {
          // Adviser request form: avoid resetting hidden anti-spam fields.
          f.querySelectorAll("input, textarea, select").forEach(field => {
            if (!field) return;
            const tag = (field.tagName || "").toLowerCase();
            const type = (field.type || "").toLowerCase();
            const name = (field.name || "").toLowerCase();

            if (type === "hidden" || name.includes("turnstile")) return;

            if (tag === "select") {
              if (field.options?.length) field.selectedIndex = 0;
              return;
            }

            if (type === "checkbox" || type === "radio") {
              field.checked = false;
              return;
            }

            field.value = "";
          });
        }
      } catch (e) {}
      f.classList.remove("w--redirected", "w--submitted");
      f.removeAttribute("aria-busy");
      f.removeAttribute("data-wf-submitting");
      // explicitly show form (Webflow hides it on success)
      f.style.setProperty("display", "block", "important");

      f.querySelectorAll('input[type="submit"], button[type="submit"]').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute("aria-disabled");
        btn.classList.remove("disabled", "w--disabled", "w-button-disabled");
      });
    });
    // explicitly hide success and error messages using !important
    const done = panel.querySelector(".w-form-done");
    if (done) done.style.setProperty("display", "none", "important");
    const fail = panel.querySelector(".w-form-fail");
    if (fail) fail.style.setProperty("display", "none", "important");
  }

  function resetWebflowVisualState(panel) {
    if (!panel) return;
    panel.querySelectorAll("form").forEach(f => {
      f.classList.remove("w--redirected", "w--submitted");
      f.removeAttribute("aria-busy");
      f.removeAttribute("data-wf-submitting");
      f.style.setProperty("display", "block", "important");

      f.querySelectorAll('input[type="submit"], button[type="submit"]').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute("aria-disabled");
        btn.classList.remove("disabled", "w--disabled", "w-button-disabled");
      });
    });
    const done = panel.querySelector(".w-form-done");
    if (done) done.style.setProperty("display", "none", "important");
    const fail = panel.querySelector(".w-form-fail");
    if (fail) fail.style.setProperty("display", "none", "important");
  }

  function resetCalculatorPanelState(panel, targetId) {
    if (!panel) return;

    const resultSelectors = [
      "#results",
      "#ma-results",
      "#sd-results",
      "#repay-results",
      "#mf-results",
      "#mr-results",
      "#ip-results",
      "#ra-results"
    ];

    resultSelectors.forEach(sel => {
      panel.querySelectorAll(sel).forEach(el => {
        el.style.display = "none";
      });
    });

    panel
      .querySelectorAll("#mf-deposit-error, #mr-error-messages, #ip-error-messages, #ra-error-messages")
      .forEach(el => {
        el.style.display = "none";
      });

    const stateMap = {
      "Borrowing-Power-Calc": "borrowingPower",
      "Affordability-Calc": "affordability",
      "Repayment-Calc": "repayment",
      "Repayment-Calc-2": "repayment",
      "Stamp-Duty-Calc": "stampDuty",
      "Mortgage-Finder-Calc": "mortgageFinder",
      "Mortgage-Refinance-Calc": "mortgageRefinance",
      "Insurance-Protection-Calc": "insuranceProtection",
      "Risk-Assessment-Calc": "riskAssessment"
    };

    const stateKey = stateMap[targetId];
    if (stateKey && window.PRUD_CALC_STATE) {
      window.PRUD_CALC_STATE[stateKey] = null;
    }
  }

  function resetPopupWidthLock(popupForm) {
    if (!popupForm) return;
    popupForm.style.removeProperty("width");
    popupForm.style.removeProperty("min-width");
    popupForm.style.removeProperty("max-width");
    popupForm.dataset.widthLocked = "false";
  }

  function getPopupRenderableWidth(popupForm) {
    if (!popupForm) return 0;

    const rectWidth = popupForm.getBoundingClientRect().width;
    if (rectWidth <= 0) return 0;

    const cs = window.getComputedStyle(popupForm);
    let width = rectWidth;

    // `style.width` uses content-box sizing unless box-sizing is border-box.
    // Convert measured border-box width to content-box width when needed.
    if (cs.boxSizing !== "border-box") {
      width -=
        (parseFloat(cs.paddingLeft) || 0) +
        (parseFloat(cs.paddingRight) || 0) +
        (parseFloat(cs.borderLeftWidth) || 0) +
        (parseFloat(cs.borderRightWidth) || 0);
    }

    return Math.max(0, width);
  }

  function lockPopupWidth(popupForm, force = false) {
    if (!popupForm) return;
    if (!force && popupForm.dataset.widthLocked === "true") return;

    const width = getPopupRenderableWidth(popupForm);
    if (width > 0) {
      const px = width + "px";
      popupForm.style.setProperty("width", px, "important");
      popupForm.style.setProperty("min-width", px, "important");
      popupForm.style.setProperty("max-width", px, "important");
      popupForm.dataset.widthLocked = "true";
    }
  }

  function lockNearestPopupFormWidth(el, force = false) {
    const popupForm = el?.closest?.(".pop-up-form") || null;
    if (!popupForm) return;
    lockPopupWidth(popupForm, force);
  }

  function schedulePopupWidthLock(popupForm) {
    if (!popupForm) return;

    let tries = 0;
    const maxTries = 24;

    function tick() {
      if (!popupForm || popupForm.dataset.widthLocked === "true") return;

      const isVisible = popupForm.getBoundingClientRect().width > 0;
      if (isVisible) {
        lockPopupWidth(popupForm);
      }

      if (popupForm.dataset.widthLocked !== "true" && tries < maxTries) {
        tries += 1;
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  function initPopupWidthObservers() {
    document.querySelectorAll(".pop-up-form").forEach(popupForm => {
      if (popupForm.dataset.widthLockObserverBound === "true") return;
      popupForm.dataset.widthLockObserverBound = "true";
      if (!popupForm.dataset.widthLocked) {
        popupForm.dataset.widthLocked = "false";
      }

      const observer = new MutationObserver(() => {
        if (
          popupForm.getBoundingClientRect().width > 0 &&
          popupForm.dataset.widthLocked !== "true"
        ) {
          schedulePopupWidthLock(popupForm);
        }
      });

      observer.observe(popupForm, {
        attributes: true,
        attributeFilter: ["style", "class"]
      });

      const panel = popupForm.closest("[id]");
      if (panel) {
        observer.observe(panel, {
          attributes: true,
          attributeFilter: ["style", "class"]
        });
      }
    });
  }

  initPopupWidthObservers();

  function resolvePopupPanel(targetId, wrapper) {
    if (!targetId) return null;

    if (typeof window.ensureDeferredCalculatorPanel === 'function') {
      window.ensureDeferredCalculatorPanel(targetId);
    }

    const direct = document.getElementById(targetId);
    if (direct) return direct;

    const aliases = {
      "General-Enquiry": [
        "General-Enquiries",
        "General-Enquiry-Form",
        "General-Enquiries-Form",
        "General-Enquiry-Contact",
        "General-Enquiries-Contact"
      ]
    };

    const candidates = aliases[targetId] || [];
    for (const id of candidates) {
      const hit = document.getElementById(id);
      if (hit) return hit;
    }

    const norm = v => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const wanted = norm(targetId);

    const inWrapper = wrapper
      ? Array.from(wrapper.children).find(el => norm(el.id) === wanted)
      : null;

    if (inWrapper) return inWrapper;

    // Final fallback for known semantic match.
    if (wanted === "generalenquiry" && wrapper) {
      return (
        Array.from(wrapper.children).find(el => norm(el.id).includes("generalenquiry")) ||
        null
      );
    }

    return null;
  }

  let activePopupPanel = null;
  let lastPopupTrigger = null;

  function isVisibleFocusable(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.tabIndex < 0) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getFocusableInPanel(panel) {
    if (!panel) return [];
    const selectors = [
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(",");

    return Array.from(panel.querySelectorAll(selectors)).filter(isVisibleFocusable);
  }

  function focusFirstFieldInPanel(panel) {
    const formRoot = panel?.querySelector(".pop-up-form") || panel;
    const focusables = getFocusableInPanel(formRoot);
    const first =
      focusables.find(el => (el.tagName || "").toLowerCase() === "input") ||
      focusables[0] ||
      null;

    if (first) {
      first.focus({ preventScroll: true });
    }
  }

  function activatePopupAccessibility(panel, triggerEl) {
    activePopupPanel = panel;
    lastPopupTrigger = triggerEl || document.activeElement;

    requestAnimationFrame(() => {
      focusFirstFieldInPanel(panel);
    });
  }

  function deactivatePopupAccessibility() {
    activePopupPanel = null;

    if (lastPopupTrigger && typeof lastPopupTrigger.focus === "function") {
      try {
        lastPopupTrigger.focus({ preventScroll: true });
      } catch (e) {
        lastPopupTrigger.focus();
      }
    }
    lastPopupTrigger = null;
  }

  /* ===== ERROR MESSAGE FOCUS MANAGEMENT ===== */
  
  function focusErrorMessage(errorElement, targetField) {
    if (!errorElement) return;

    /* If a field caused the error, focus that field instead of the error container */
    const elementToFocus = targetField || errorElement;

    try {
      elementToFocus.focus({ preventScroll: false });
    } catch (e) {
      elementToFocus.focus();
    }

    /* Scroll error message into view for context */
    requestAnimationFrame(() => {
      if (errorElement && typeof errorElement.scrollIntoView === "function") {
        try {
          errorElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        } catch (e) {
          scrollSmooth(errorElement);
        }
      }
    });
  }

  function focusFieldBoxArea(target) {
    if (!target) return null;

    const fieldBox =
      (target.matches && target.matches(".field-box-area") ? target : target.closest?.(".field-box-area")) ||
      null;

    if (!fieldBox) return null;

    if (!fieldBox.hasAttribute("tabindex")) {
      fieldBox.setAttribute("tabindex", "-1");
    }

    try {
      fieldBox.focus({ preventScroll: true });
    } catch (e) {
      fieldBox.focus();
    }

    return fieldBox;
  }

  function createValidationTracker() {
    const errors = [];
    let firstErrorTarget = null;

    return {
      errors,
      add(message, targetField) {
        errors.push(message);
        if (!firstErrorTarget && targetField) {
          firstErrorTarget = targetField;
        }
      },
      firstTarget(fallbackTarget) {
        return firstErrorTarget || fallbackTarget || null;
      }
    };
  }

  /* ===== ERROR MESSAGE FOCUS MANAGEMENT — END ===== */

  document.addEventListener("keydown", e => {
    if (!activePopupPanel || activePopupPanel.style.display === "none") return;

    if (e.key === "Escape") {
      e.preventDefault();
      closePopup();
      return;
    }

    if (e.key !== "Tab") return;

    const formRoot = activePopupPanel.querySelector(".pop-up-form") || activePopupPanel;
    const focusables = getFocusableInPanel(formRoot);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement;

    if (e.shiftKey) {
      if (activeEl === first || !formRoot.contains(activeEl)) {
        e.preventDefault();
        last.focus();
      }
      return;
    }

    if (activeEl === last || !formRoot.contains(activeEl)) {
      e.preventDefault();
      first.focus();
    }
  });

  function isNativeInteractiveTrigger(el) {
    if (!el || !el.tagName) return false;

    const tag = el.tagName.toLowerCase();
    if (tag === "button") return true;
    if (tag === "summary") return true;
    if (tag === "a" && el.hasAttribute("href")) return true;
    if (tag === "input" || tag === "select" || tag === "textarea") return true;

    return false;
  }

  document.querySelectorAll("[data-open-form]").forEach(trigger => {
    const nativeInteractive = isNativeInteractiveTrigger(trigger);

    if (!nativeInteractive) {
      if (!trigger.hasAttribute("role")) {
        trigger.setAttribute("role", "button");
      }

      if (!trigger.hasAttribute("tabindex")) {
        trigger.setAttribute("tabindex", "0");
      }
    }

    if (trigger.dataset.prudOpenFormKeyboardBound !== "true") {
      trigger.dataset.prudOpenFormKeyboardBound = "true";

      trigger.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;

        if (e.key === " " || !nativeInteractive) {
          e.preventDefault();
        }

        trigger.click();
      });
    }

    trigger.addEventListener("click", ev => {
      ev.preventDefault(); // allow Webflow IX2 to open popup

      const wrapper = document.getElementById("animation-wrapper");
      const targetId = trigger.getAttribute("data-open-form");
      const fromCalculatorAdviser = /^(bp|mf|mr|repay|sd|ip|ma|ra)-adviser$/.test(
        trigger.id || ""
      );
      const payloadReady = !!window.PRUD_ADVISOR_PAYLOAD_READY;
      const isInternalAdviserOpen = !!window.PRUD_INTERNAL_ADVISER_OPENING;

      debug("Popup trigger clicked →", targetId);
      debug("Popup trigger details:", {
        targetId,
        internalAdviserOpen: isInternalAdviserOpen,
        trigger: describeTriggerElement(trigger)
      });

      if (targetId === "Request-Adviser-Contact" && isInternalAdviserOpen) {
        window.PRUD_INTERNAL_ADVISER_OPENING = false;
      }

      // Capture adviser metadata when the Adviser popup is being opened.
      // Webflow IX2 may intercept direct clicks on adviser cards, so
      // inspect the trigger (or its closest adviser ancestor) for
      // `data-advisor-name` / `data-advisor-role` attributes and stash
      // them on `window.LAST_ADVISER_TRIGGER` so downstream code can
      // populate the adviser form reliably.
      if (targetId === "Request-Adviser-Contact") {
        const adviserSource = trigger.closest('[data-advisor-name]') || trigger;
        const advName = adviserSource && (adviserSource.getAttribute('data-advisor-name') || adviserSource.dataset?.advisorName) || "";
        const advRole = adviserSource && (adviserSource.getAttribute('data-advisor-role') || adviserSource.dataset?.advisorRole) || "";

        // Only overwrite the global LAST_ADVISER_TRIGGER if the trigger
        // actually supplies adviser metadata. This preserves flows where
        // another part of the UI (e.g. bp-adviser) already populated the
        // form immediately before opening the popup.
        if (advName || advRole) {
          window.LAST_ADVISER_TRIGGER = { dataset: { advisorName: advName, advisorRole: advRole } };
          debug("Captured adviser metadata from [data-open-form] trigger:", {
            advisorName: advName,
            advisorRole: advRole
          });
        } else {
          debug("No adviser metadata found on trigger for Request-Adviser-Contact");
        }
      }

      const panel = resolvePopupPanel(targetId, wrapper);
      if (!wrapper || !panel) {
        debug("Popup missing elements", { wrapper, panel });
        return;
      }

      let preservedAdvisorPayload = null;
      if (targetId === "Request-Adviser-Contact" && payloadReady) {
        const intro = document.getElementById("advisor-intro");
        const summary = getAdvisorField("#advisor-summary");
        const source = getAdvisorField("#app-source");

        preservedAdvisorPayload = {
          introHTML: intro ? intro.innerHTML : "",
          introDisplay: intro ? intro.style.display : "",
          summaryValue: summary ? summary.value : "",
          sourceValue: source ? source.value : ""
        };
      }

      if (targetId === "Request-Adviser-Contact") {
        debug("Advisor open context:", {
          triggerId: trigger.id || "(none)",
          fromCalculatorAdviser,
          payloadReady,
          preservedSummaryLength: preservedAdvisorPayload?.summaryValue?.length || 0,
          preservedSource: preservedAdvisorPayload?.sourceValue || ""
        });
      }

      // clear any leftover form state (Webflow will leave a "message sent" block
      // inside the panel after the first submission) so every open starts fresh.
      // For adviser form, preserve field/token values and only reset visual state.
      if (targetId === "Request-Adviser-Contact") {
        resetWebflowVisualState(panel);
      } else {
        resetWebflowForm(panel);
        resetCalculatorPanelState(panel, targetId);
      }

      // Additionally, if this is the adviser contact form, reset adviser fields and repopulate
      // (needed when opening from homepage or when switching between advisers)
      if (targetId === "Request-Adviser-Contact") {
        if (
          payloadReady &&
          preservedAdvisorPayload &&
          (preservedAdvisorPayload.summaryValue || preservedAdvisorPayload.sourceValue)
        ) {
          const intro = document.getElementById("advisor-intro");
          const summary = getAdvisorField("#advisor-summary");
          const source = getAdvisorField("#app-source");

          if (intro && preservedAdvisorPayload.introHTML) {
            intro.innerHTML = preservedAdvisorPayload.introHTML;
            intro.style.display =
              preservedAdvisorPayload.introDisplay || "block";
          }

          if (summary) {
            summary.value = preservedAdvisorPayload.summaryValue || "";
            summary.disabled = !preservedAdvisorPayload.summaryValue;
          }

          if (source) {
            source.value = preservedAdvisorPayload.sourceValue || "";
          }

          // still allow advisor metadata field refresh if present
          try {
            requestAnimationFrame(() => populateAdvisorMeta());
          } catch (e) {
            console.error("[PRUDELL] Error populating adviser meta:", e);
          }
          window.PRUD_ADVISOR_PAYLOAD_READY = false;
        } else {
          resetAdvisorForm();
          // delay population to ensure form elements are ready
          try {
            requestAnimationFrame(() => populateAdvisorMeta());
          } catch (e) {
            console.error("[PRUDELL] Error populating adviser meta:", e);
          }
        }

        setTimeout(() => refreshAdvisorTurnstile("adviser-popup-open"), 120);
      }

      /* Hide all panels (DO NOT hide wrapper itself) */
      Array.from(wrapper.children).forEach(p => {
        p.style.display = "none";
        p.style.opacity = "0";
        p.style.transform = "translateX(-40px)";
      });

      /* SAFETY: ensure wrapper is ALWAYS visible */
      wrapper.style.display = "block";
      wrapper.style.display = "flex";

      /* Show selected panel */
      panel.style.display = "flex";
      panel.style.opacity = "0";
      panel.style.transform = "translateX(-40px)";

      requestAnimationFrame(() => {
        panel.style.opacity = "1";
        panel.style.transform = "translateX(0)";
      });


      const scrollBox = panel.querySelector(".pop-up-form");
      if (scrollBox) {
        resetPopupWidthLock(scrollBox);
        scrollBox.scrollTop = 0;
        schedulePopupWidthLock(scrollBox);
      }

      savedScrollY = window.scrollY;
      document.documentElement.classList.add("no-scroll");
      document.body.classList.add("no-scroll");
      activatePopupAccessibility(panel, trigger);

      /* ---------- GUARDED INITIALISATION ---------- */

      if (typeof window.initCalculatorByTarget === 'function') {
        window.initCalculatorByTarget(targetId);
      }

      /* ---------- ADVISER + GENERAL ENQUIRIES POPUPS ---------- */

      if (targetId === "Request-Adviser-Contact") {
        debug("Adviser popup opened");

        requestAnimationFrame(() => {

          const panel = document.getElementById(targetId);
          if (!panel) return;

          // Prefer metadata captured from the trigger (stored on
          // `window.LAST_ADVISER_TRIGGER`) but fall back to any data
          // attributes present in the panel itself.
          const triggerSrc = window.LAST_ADVISER_TRIGGER || {};
          const panelName = panel.querySelector("[data-advisor-name]")?.dataset?.advisorName || "";
          const panelRole = panel.querySelector("[data-advisor-role]")?.dataset?.advisorRole || "";

          const name = triggerSrc.dataset?.advisorName || panelName || "";
          const role = triggerSrc.dataset?.advisorRole || panelRole || "";

          debug("Populating adviser form — source:", {
            fromTrigger: { name: triggerSrc.dataset?.advisorName, role: triggerSrc.dataset?.advisorRole },
            fromPanel: { name: panelName, role: panelRole },
            final: { name, role }
          });

          setAdvisorMetaEverywhere(name, role);
          debug("Adviser form — metadata applied", { name, role });

        });
      }

      if (targetId === "General-Enquiry") {
        debug("General Enquiries popup opened");
      }

      /* ---------- END ADVISER + GENERAL ENQUIRIES POPUPS ---------- */

      /* ===== END POPUP SYSTEM ===== */

    }); // END trigger click listener
  });   // END [data-open-form] forEach

  /* CLOSE POPUP */
  function closePopup() {
    const wrapper = document.getElementById("animation-wrapper");
    const popup = document.querySelector(".Pop-Up.Window");

    if (!wrapper) return;

    /* Hide all calculator panels */
    Array.from(wrapper.children).forEach(p => {
      p.style.opacity = "0";
      p.style.transform = "translateX(-40px)";
      p.style.display = "none";

      const popupForm = p.querySelector(".pop-up-form");
      if (popupForm) {
        resetPopupWidthLock(popupForm);
      }
    });

    /* 🔑 RESET POP-UP WINDOW ITSELF */
    if (popup) {
      popup.style.display = "none";
      popup.style.opacity = "0";
      popup.style.transform = "translateY(20px)";
    }

    /* Restore page scroll */
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");
    window.scrollTo(0, savedScrollY);
    deactivatePopupAccessibility();
  }

  /* ===== 04. BORROWING POWER CALCULATOR — CLEANED ===== */


  function getAdvisorRequestForm() {
    return (
      document.getElementById("advisor-request-form") ||
      document.getElementById("contact-advisor-form") ||
      document.getElementById("Advisor-Contact-Form") ||
      document.getElementById("wf-form-Advisor-Callback-Form") ||
      document.querySelector('form[name="wf-form-Advisor-Request-Form"]') ||
      document.querySelector('form[name="wf-form-Contact-Advisor-Form"]') ||
      document.querySelector('form[name="wf-form-Advisor-Form"]') ||
      document.querySelector('form[name="wf-form-Advisor-Callback-Form"]') ||
      document.querySelector('#Request-Adviser-Contact form.pop-up-form') ||
      document.querySelector('#Pop-Up-Advisor-Window form.pop-up-form') ||
      null
    );
  }

  function getAdvisorField(selector) {
    const form = getAdvisorRequestForm();
    if (!form) return null;
    return form.querySelector(selector);
  }

  function ensureAdvisorPayloadFields() {
    const form = getAdvisorRequestForm();
    if (!form) return;

    function ensureHiddenInputField(id) {
      const field = form.querySelector(`#${id}`);
      if (!field) return;

      const tag = String(field.tagName || "").toLowerCase();
      if (tag !== "input") {
        console.warn(`[PRUDELL] #${id} must be an input field for backend submission`);
        return;
      }

      const type = String(field.getAttribute("type") || "").toLowerCase();
      if (type !== "hidden") {
        field.setAttribute("type", "hidden");
      }
    }

    ensureHiddenInputField("advisor-summary");
    ensureHiddenInputField("app-source");
    ensureHiddenInputField("Advisor-Name");
  }

  function applyAdvisorFieldLimits() {
    const source = getAdvisorField("#app-source");
    const summary = getAdvisorField("#advisor-summary");

    function clampField(field, label) {
      if (!field) return;
      const raw = String(field.value || "");

      let maxLen = Number(field.maxLength || 0);
      if (!Number.isFinite(maxLen) || maxLen <= 0) {
        const attr = parseInt(field.getAttribute("maxlength") || "", 10);
        maxLen = Number.isFinite(attr) && attr > 0 ? attr : 0;
      }

      if (maxLen > 0 && raw.length > maxLen) {
        field.value = raw.slice(0, maxLen);
        debug("[ADVISOR FIELD TRUNCATED]", {
          field: label,
          before: raw.length,
          after: field.value.length,
          maxLen
        });
      }
    }

    clampField(source, "app-source");

    // Do not hard-clamp advisor summary from maxlength metadata.
    // Webflow hidden results fields are often configured at 256 chars;
    // clamping here truncates the email body and can break formatting.
    if (summary) {
      const raw = String(summary.value || "");
      const safeMax = 6000;
      if (raw.length > safeMax) {
        summary.value = raw.slice(0, safeMax);
        debug("[ADVISOR FIELD TRUNCATED]", {
          field: "advisor-summary",
          before: raw.length,
          after: summary.value.length,
          maxLen: safeMax
        });
      }
    }
  }

  function ensureAdvisorServiceFieldNames() {
    const form = getAdvisorRequestForm();
    if (!form) return;

    const serviceFieldMap = [
      { id: "Mortgage", label: "Mortgage" },
      { id: "Insurance-Protection", label: "Insurance Protection" },
      { id: "Later-Life-Lending", label: "Later Life Lending" }
    ];

    serviceFieldMap.forEach(({ id, label }) => {
      const input = form.querySelector(`#${id}`);
      if (!input) return;

      if (!input.name) {
        input.name = label;
      }

      if (!input.getAttribute("data-name")) {
        input.setAttribute("data-name", label);
      }
    });
  }

  function syncAdvisorOptionalSubmissionFields() {
    const nameField = getAdvisorField("#Advisor-Name");
    const sourceField = getAdvisorField("#app-source");
    const summaryField = getAdvisorField("#advisor-summary");

    [nameField, sourceField, summaryField].forEach(field => {
      if (!field) return;

      const raw = String(field.value || "");
      const isBlank = raw.trim().length === 0;

      field.disabled = isBlank;
      if (isBlank) {
        field.value = "";
      }
    });
  }

  function refreshAdvisorTurnstile(reason = "manual") {
    const form = getAdvisorRequestForm();
    if (!form) return;

    const tokenField = form.querySelector('input[name="cf-turnstile-response"]');
    const beforeLen = String(tokenField?.value || "").length;

    const turnstileApi = window.turnstile;
    if (!turnstileApi || typeof turnstileApi.reset !== "function") {
      debug("[TURNSTILE RESET SKIPPED] API unavailable", { reason, beforeLen });
      return;
    }

    let resetOk = false;

    try {
      turnstileApi.reset();
      resetOk = true;
    } catch (err1) {
      const widgetEl = form.querySelector(".cf-turnstile, [data-sitekey]");
      const widgetId =
        widgetEl?.dataset?.widgetId ||
        widgetEl?.getAttribute?.("data-widget-id") ||
        "";

      if (widgetId) {
        try {
          turnstileApi.reset(widgetId);
          resetOk = true;
        } catch (err2) {
          debug("[TURNSTILE RESET ERROR]", {
            reason,
            widgetId,
            error: String(err2)
          });
        }
      } else {
        debug("[TURNSTILE RESET ERROR]", {
          reason,
          widgetId: "",
          error: String(err1)
        });
      }
    }

    setTimeout(() => {
      const afterLen = String(tokenField?.value || "").length;
      debug("[TURNSTILE RESET]", {
        reason,
        resetOk,
        beforeLen,
        afterLen
      });
    }, 450);
  }

  function validateAdvisorStructure() {
    const report = {
      ok: true,
      issues: [],
      counts: {}
    };

    const criticalIds = [
      "advisor-request-form",
      "app-source",
      "advisor-summary"
    ];

    criticalIds.forEach(id => {
      const count = document.querySelectorAll(`#${id}`).length;
      report.counts[id] = count;
      if (count !== 1) {
        report.issues.push({
          level: "error",
          code: "critical-id-count",
          id,
          count,
          expected: 1
        });
      }
    });

    const advisorNameCount = document.querySelectorAll("#Advisor-Name").length;
    report.counts["Advisor-Name"] = advisorNameCount;
    if (advisorNameCount !== 1) {
      report.issues.push({
        level: "warn",
        code: "advisor-name-id-count",
        id: "Advisor-Name",
        count: advisorNameCount,
        expected: 1
      });
    }

    const form = getAdvisorRequestForm();
    if (!form) {
      report.issues.push({
        level: "error",
        code: "missing-adviser-form"
      });
    } else {
      const formSourceCount = form.querySelectorAll("#app-source").length;
      const formSummaryCount = form.querySelectorAll("#advisor-summary").length;
      const formTokenInputs = form.querySelectorAll('input[name="cf-turnstile-response"]').length;
      const formTurnstileWidgets = form.querySelectorAll(".cf-turnstile, [data-sitekey]").length;
      const submitButtons = form.querySelectorAll('input[type="submit"], button[type="submit"]').length;

      report.counts.formSourceCount = formSourceCount;
      report.counts.formSummaryCount = formSummaryCount;
      report.counts.formTokenInputs = formTokenInputs;
      report.counts.formTurnstileWidgets = formTurnstileWidgets;
      report.counts.formSubmitButtons = submitButtons;

      if (formSourceCount !== 1) {
        report.issues.push({
          level: "error",
          code: "form-source-count",
          count: formSourceCount,
          expected: 1
        });
      }

      if (formSummaryCount !== 1) {
        report.issues.push({
          level: "error",
          code: "form-summary-count",
          count: formSummaryCount,
          expected: 1
        });
      }

      if (submitButtons < 1) {
        report.issues.push({
          level: "error",
          code: "missing-submit-button"
        });
      }

      if (formTurnstileWidgets < 1) {
        report.issues.push({
          level: "warn",
          code: "missing-turnstile-widget-in-form"
        });
      }
    }

    const globalTokenInputs = document.querySelectorAll('input[name="cf-turnstile-response"]').length;
    const globalTurnstileWidgets = document.querySelectorAll(".cf-turnstile, [data-sitekey]").length;
    report.counts.globalTokenInputs = globalTokenInputs;
    report.counts.globalTurnstileWidgets = globalTurnstileWidgets;

    if (globalTokenInputs > 1) {
      report.issues.push({
        level: "warn",
        code: "multiple-global-turnstile-token-inputs",
        count: globalTokenInputs
      });
    }

    if (globalTurnstileWidgets > 1) {
      report.issues.push({
        level: "warn",
        code: "multiple-global-turnstile-widgets",
        count: globalTurnstileWidgets
      });
    }

    report.ok = report.issues.filter(i => i.level === "error").length === 0;

    if (!report.ok || report.issues.length) {
      console.groupCollapsed("[PRUDELL][STRUCTURE VALIDATION]");
      console.table(report.counts);
      console.table(report.issues);
      console.groupEnd();
    } else {
      debug("[PRUDELL][STRUCTURE VALIDATION] OK", report.counts);
    }

    return report;
  }

  function textOf(id) {
    return String(document.getElementById(id)?.textContent || "").trim();
  }

  function valueOf(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function clearAdvisorTriggerState() {
    window.LAST_ADVISER_TRIGGER = null;
    window.LAST_CLICKED_ADVISER_ELEMENT = null;
  }

  // make available on window for manual invocation
  window.resetAdvisorForm = function resetAdvisorForm(clearMetaContext = false) {

    if (clearMetaContext) {
      clearAdvisorTriggerState();
    }

    ensureAdvisorPayloadFields();

    const advisorForm = getAdvisorRequestForm();
    if (advisorForm) {
      advisorForm.querySelectorAll("input, textarea, select").forEach(field => {
        if (!field) return;
        const tag = (field.tagName || "").toLowerCase();
        const type = (field.type || "").toLowerCase();
        const id = field.id || "";
        const name = (field.name || "").toLowerCase();

        // keep these populated by calculator/meta pipeline after reset
        if (id === "advisor-summary" || id === "app-source" || id === "Advisor-Name") {
          return;
        }

        if (type === "hidden") {
          // leave hidden/security fields untouched
          return;
        }

        if (type === "submit" || type === "button" || type === "reset") {
          // keep button labels/values intact
          return;
        }

        if (tag === "select") {
          if (field.options?.length) field.selectedIndex = 0;
          return;
        }

        if (type === "checkbox" || type === "radio") {
          field.checked = false;
          return;
        }

        field.value = "";
      });

      // Do not force-reset Turnstile on every adviser-open.
      // Repeated resets can leave the token empty and block submits.
    }

    const intro = document.getElementById("advisor-intro");
    if (intro) {
      intro.style.display = "none";
      intro.innerHTML = "";
    }

    const summary = getAdvisorField("#advisor-summary");
    if (summary) {
      summary.value = "";
      summary.disabled = true;
    }

    const source = getAdvisorField("#app-source");
    if (source) {
      source.value = "";
    }

    syncAdvisorOptionalSubmissionFields();

    window.PRUD_ADVISOR_PAYLOAD_READY = false;
  }

  function openAdvisorFormFromCalculator(triggerEl) {
    clearAdvisorTriggerState();
    syncAdvisorOptionalSubmissionFields();
    window.PRUD_ADVISOR_PAYLOAD_READY = true;

    debug("Adviser open requested from calculator:", {
      sourceTrigger: describeTriggerElement(triggerEl)
    });

    if (
      triggerEl &&
      triggerEl.getAttribute("data-open-form") === "Request-Adviser-Contact"
    ) {
      window.PRUD_INTERNAL_ADVISER_OPENING = true;
      debug("Adviser open using same clicked trigger", {
        trigger: describeTriggerElement(triggerEl)
      });
      setTimeout(() => triggerEl.click(), 0);
      return;
    }

    const calcPanel = triggerEl?.closest(
      "#Borrowing-Power-Calc, #Mortgage-Finder-Calc, #Mortgage-Refinance-Calc, #Repayment-Calc, #Repayment-Calc-2, #Stamp-Duty-Calc, #Insurance-Protection-Calc, #Affordability-Calc, #Risk-Assessment-Calc"
    );
    const localOpenTrigger = calcPanel?.querySelector(
      '[data-open-form="Request-Adviser-Contact"]'
    );
    if (localOpenTrigger) {
      window.PRUD_INTERNAL_ADVISER_OPENING = true;
      debug("Adviser open using local panel trigger", {
        panelId: calcPanel?.id || "",
        trigger: describeTriggerElement(localOpenTrigger)
      });
      setTimeout(() => localOpenTrigger.click(), 0);
      return;
    }

    debug("Adviser open using fallback trigger lookup");
    document
      .querySelector('[data-open-form="Request-Adviser-Contact"]')
      ?.click();
  }

  /* ===== ADVISOR META POPULATION ===== */

  // expose for console testing
  window.populateAdvisorMeta = function populateAdvisorMeta() {
    const src = window.LAST_ADVISER_TRIGGER || {};
    const clickEl = window.LAST_CLICKED_ADVISER_ELEMENT || null;

    const nameFromTrigger = src.dataset?.advisorName || "";
    const roleFromTrigger = src.dataset?.advisorRole || "";

    const nameFromClick = clickEl
      ? clickEl.getAttribute('data-advisor-name') || clickEl.dataset?.advisorName || ""
      : "";
    const roleFromClick = clickEl
      ? clickEl.getAttribute('data-advisor-role') || clickEl.dataset?.advisorRole || ""
      : "";

    const name = nameFromTrigger || nameFromClick || "";
    const role = roleFromTrigger || roleFromClick || "";

    const panel = document.getElementById("Request-Adviser-Contact");
    if (!panel) {
      console.warn("[PRUDELL] adviser panel not present when populating metadata");
    }

    setAdvisorMetaEverywhere(name, role);
    syncAdvisorOptionalSubmissionFields();
  }

  /* ===== END ADVISOR META POPULATION ===== */

  const advisorRequestForm = getAdvisorRequestForm();
  if (advisorRequestForm) {
    ensureAdvisorPayloadFields();
    ensureAdvisorServiceFieldNames();

    function adviserHasTurnstile() {
      return !!advisorRequestForm.querySelector(
        '.cf-turnstile, [data-sitekey], input[name="cf-turnstile-response"]'
      );
    }

    function adviserTurnstileTokenLen() {
      return String(
        advisorRequestForm.querySelector('input[name="cf-turnstile-response"]')?.value || ""
      ).length;
    }

    const adviserSubmitBtn = advisorRequestForm.querySelector('input[type="submit"], button[type="submit"]');

    adviserSubmitBtn?.addEventListener("click", () => {
      ensureAdvisorServiceFieldNames();
      syncAdvisorOptionalSubmissionFields();
      applyAdvisorFieldLimits();
    });

    advisorRequestForm.addEventListener("submit", () => {
      ensureAdvisorServiceFieldNames();
      syncAdvisorOptionalSubmissionFields();
      applyAdvisorFieldLimits();

      const tokenLen = adviserTurnstileTokenLen();
      const hasTurnstile = adviserHasTurnstile();

      if (hasTurnstile && tokenLen === 0) {
        refreshAdvisorTurnstile("empty-token-on-submit");
      }
    });
  }


  /* ===== EXPORTS FOR CALCULATORS.JS ===== */
  window.getAdvisorField = getAdvisorField;
  window.openAdvisorFormFromCalculator = openAdvisorFormFromCalculator;
  window.refreshAdvisorTurnstile = refreshAdvisorTurnstile;

}); // END window.Webflow.push

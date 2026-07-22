import { FEED_URL, isValidEmail, relTime, buildDeals } from "./logic.js";

let rawDealsCache = [];
let activeFilter = "Todas";

const gridLoadingEl = document.getElementById("grid-loading");
const gridErrorEl = document.getElementById("grid-error");
const gridEmptyEl = document.getElementById("grid-empty");
const gridDealsEl = document.getElementById("grid-deals");
const updatedTextEl = document.getElementById("updated-text");
const retryBtnEl = document.getElementById("retry-btn");
const dealCardTpl = document.getElementById("deal-card-tpl");

const subscribeForm = document.getElementById("subscribe-form");
const emailInput = document.getElementById("email-input");
const submitBtn = document.getElementById("submit-btn");
const formInvalidMsg = document.getElementById("form-invalid-msg");
const formServerErrorMsg = document.getElementById("form-server-error-msg");
const formSuccessMsg = document.getElementById("form-success-msg");

function setGridState(state) {
  if (gridLoadingEl) gridLoadingEl.hidden = state !== "loading";
  if (gridErrorEl) gridErrorEl.hidden = state !== "error";
  if (gridEmptyEl) gridEmptyEl.hidden = state !== "empty";
  if (gridDealsEl) gridDealsEl.hidden = state !== "deals";
}

function renderDeals(deals) {
  if (!gridDealsEl || !dealCardTpl) return;

  gridDealsEl.replaceChildren();

  if (deals.length === 0) {
    setGridState("empty");
    return;
  }

  setGridState("deals");

  for (const deal of deals) {
    const clone = dealCardTpl.content.cloneNode(true);

    const storeSlot = clone.querySelector('[data-slot="store"]');
    const badgeSlot = clone.querySelector('[data-slot="badge"]');
    const productSlot = clone.querySelector('[data-slot="product"]');
    const priceNowSlot = clone.querySelector('[data-slot="priceNow"]');
    const priceRefSlot = clone.querySelector('[data-slot="priceRef"]');
    const urlSlot = clone.querySelector('[data-slot="url"]');

    if (storeSlot) storeSlot.textContent = deal.store;
    if (badgeSlot) badgeSlot.textContent = deal.badge;
    if (productSlot) productSlot.textContent = deal.product;
    if (priceNowSlot) priceNowSlot.textContent = deal.priceNow;
    if (priceRefSlot) priceRefSlot.textContent = deal.priceRef;
    if (urlSlot) {
      urlSlot.setAttribute("href", deal.url);
    }

    gridDealsEl.appendChild(clone);
  }
}

async function loadFeed() {
  setGridState("loading");
  if (updatedTextEl) updatedTextEl.textContent = "consultando feed…";

  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const data = await res.json();
    rawDealsCache = Array.isArray(data.deals) ? data.deals : [];

    if (updatedTextEl) {
      updatedTextEl.textContent = relTime(data.generated_at);
    }

    const filteredDeals = buildDeals(rawDealsCache, activeFilter);
    renderDeals(filteredDeals);
  } catch (err) {
    setGridState("error");
    if (updatedTextEl) updatedTextEl.textContent = "";
  }
}

function setupChips() {
  const chips = document.querySelectorAll("[data-store]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const store = chip.getAttribute("data-store");
      activeFilter = store;

      chips.forEach((c) => {
        const isCurrent = c.getAttribute("data-store") === activeFilter;
        if (isCurrent) {
          c.classList.add("chip--active");
        } else {
          c.classList.remove("chip--active");
        }
      });

      const filteredDeals = buildDeals(rawDealsCache, activeFilter);
      renderDeals(filteredDeals);
    });
  });
}

function setupForm() {
  if (!subscribeForm) return;

  subscribeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (formInvalidMsg) formInvalidMsg.hidden = true;
    if (formServerErrorMsg) formServerErrorMsg.hidden = true;

    const email = emailInput ? emailInput.value : "";
    if (!isValidEmail(email)) {
      if (formInvalidMsg) formInvalidMsg.hidden = false;
      return;
    }

    let token = "";
    if (
      window.turnstile &&
      typeof window.turnstile.getResponse === "function"
    ) {
      token = window.turnstile.getResponse();
    }

    if (!token) {
      if (formServerErrorMsg) formServerErrorMsg.hidden = false;
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";
    }

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), turnstileToken: token }),
      });

      if (res.status === 200) {
        if (subscribeForm) subscribeForm.hidden = true;
        if (formSuccessMsg) formSuccessMsg.hidden = false;
      } else if (res.status === 400) {
        let errCode = "";
        try {
          errCode = (await res.json()).error || "";
        } catch {}

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Quiero ofertas verificadas";
        }

        if (errCode === "invalid_email") {
          if (formInvalidMsg) formInvalidMsg.hidden = false;
        } else {
          if (formServerErrorMsg) formServerErrorMsg.hidden = false;
          if (
            window.turnstile &&
            typeof window.turnstile.reset === "function"
          ) {
            window.turnstile.reset();
          }
        }
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Quiero ofertas verificadas";
        }
        if (formServerErrorMsg) formServerErrorMsg.hidden = false;
        if (window.turnstile && typeof window.turnstile.reset === "function") {
          window.turnstile.reset();
        }
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Quiero ofertas verificadas";
      }
      if (formServerErrorMsg) formServerErrorMsg.hidden = false;
      if (window.turnstile && typeof window.turnstile.reset === "function") {
        window.turnstile.reset();
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (retryBtnEl) {
    retryBtnEl.addEventListener("click", () => loadFeed());
  }
  setupChips();
  setupForm();
  loadFeed();
});

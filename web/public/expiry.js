// Keep the example passes' expiry dates a plausible distance from today.
for (const el of document.querySelectorAll("[data-expiry]")) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + Number(el.dataset.expiry));
  el.textContent = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

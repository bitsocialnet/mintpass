import "./styles.css";

// Source inspection needs the DevTools hook before React DOM initializes.
if (import.meta.env.DEV) {
  const { instrument } = await import("bippy");
  instrument({});
  window.__ELEMENT_SOURCE__ = await import("element-source");
}

await import("./app");

export {};

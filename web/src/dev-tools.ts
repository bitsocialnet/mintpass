import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

declare global {
  interface Window {
    __VISUAL_TESTING__?: boolean;
    __NO_DEV_TOOLBAR__?: boolean;
    __PROFILING__?: boolean;
    __ELEMENT_SOURCE__?: typeof import("element-source");
  }
}

if (!window.__VISUAL_TESTING__ && !window.__NO_DEV_TOOLBAR__ && !window.__PROFILING__) {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  let disposed = false;
  import.meta.hot?.dispose(() => {
    disposed = true;
    root?.unmount();
    host?.remove();
  });

  void import("agentation").then(({ Agentation }) => {
    if (disposed) return;
    host = document.createElement("div");
    host.id = "agentation-root";
    document.body.append(host);
    root = createRoot(host);
    root.render(createElement(Agentation));
  });
}

import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "./NotFoundPage";

const container = document.getElementById("root");
if (!container) throw new Error("Missing application root");

const renderedAt = container.dataset.renderedAt ?? new Date().toISOString();
const page =
  window.location.pathname === "/" ? <HomePage renderedAt={renderedAt} /> : <NotFoundPage />;
const app = <StrictMode>{page}</StrictMode>;

if (container.hasChildNodes() && container.querySelector("main")) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}

if (import.meta.env.DEV) void import("./dev-tools");

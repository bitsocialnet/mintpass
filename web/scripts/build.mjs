import { readFile, writeFile, rm } from "node:fs/promises";
import { build } from "vite";

await build();
try {
  await build({
    build: {
      ssr: "src/render.tsx",
      outDir: ".prerender",
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: "render.mjs" } },
    },
  });
  const { render } = await import("../.prerender/render.mjs");
  const renderedAt = new Date().toISOString();
  for (const page of ["index", "404"]) {
    const file = new URL(`../dist/${page}.html`, import.meta.url);
    const template = await readFile(file, "utf8");
    if (!template.includes("<!--app-html-->"))
      throw new Error(`Missing render placeholder in ${page}`);
    await writeFile(
      file,
      template
        .replace('id="root"', `id="root" data-rendered-at="${renderedAt}"`)
        .replace("<!--app-html-->", () => render(page === "404", renderedAt)),
    );
  }
} finally {
  await rm(new URL("../.prerender", import.meta.url), { recursive: true, force: true });
}

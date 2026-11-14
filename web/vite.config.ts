import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from "vite";
import { readFile } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import hosting from "./vercel.json" with { type: "json" };

// Preserve the retired site's redirects and real 404s in local development/preview.
function siteRoutes(): Plugin {
  const configure = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((request, response, next) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (!("transformIndexHtml" in server)) {
        for (const rule of hosting.headers) {
          if (new RegExp(`^${rule.source}$`).test(url.pathname)) {
            for (const { key, value } of rule.headers) response.setHeader(key, value);
          }
        }
      }
      if (hosting.trailingSlash === false && url.pathname !== "/" && url.pathname.endsWith("/")) {
        response.writeHead(308, { Location: url.pathname.replace(/\/+$/, "") + url.search }).end();
        return;
      }
      if (hosting.cleanUrls && url.pathname.endsWith(".html")) {
        const pathname = url.pathname.replace(/(\/index)?\.html$/, "") || "/";
        response.writeHead(308, { Location: pathname + url.search }).end();
        return;
      }
      if (/^\/(request|mint1)(\/|$)/.test(url.pathname)) {
        response.writeHead(308, { Location: `/${url.search}` }).end();
        return;
      }
      next();
    });
    return () => {
      server.middlewares.use(async (request, response, next) => {
        if (!request.headers.accept?.includes("text/html")) return next();
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        // Vite rewrites the home request to /index.html before this middleware.
        if (["/", "/index.html", "/404.html"].includes(pathname)) return next();
        const preview = !("transformIndexHtml" in server);
        const file = preview ? "./dist/404.html" : "./404.html";
        try {
          let html = await readFile(new URL(file, import.meta.url), "utf8");
          if ("transformIndexHtml" in server)
            html = await server.transformIndexHtml("/404.html", html);
          response.writeHead(404, { "Content-Type": "text/html" }).end(html);
        } catch (error) {
          next(error);
        }
      });
    };
  };
  return { name: "mintpass-routes", configureServer: configure, configurePreviewServer: configure };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), siteRoutes()],
  appType: "mpa",
  // All development inspectors must share the same renderer instrumentation.
  resolve: { dedupe: ["react", "react-dom", "bippy"] },
  server: {
    host: "127.0.0.1",
    allowedHosts: [".mintpass.localhost"],
    open: process.env.BROWSER === "none" ? false : process.env.PORTLESS_URL || true,
  },
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: {
            index: fileURLToPath(new URL("./index.html", import.meta.url)),
            notFound: fileURLToPath(new URL("./404.html", import.meta.url)),
          },
        },
      },
}));

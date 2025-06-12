import { defineConfig, ViteDevServer } from "vite";
import { getPlugins } from "./scripts/rollupPlugins.mjs";
import { Connect } from "vite";
import http from "http";

// Custom plugin to handle the /api/log endpoint
function logServer() {
  return {
    name: 'log-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        async (req: Connect.IncomingMessage, res: http.ServerResponse, next: Connect.NextFunction) => {
          if (req.method === 'POST' && req.url === '/api/log') {
            let body = '';
            req.on('data', (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const logData = JSON.parse(body);
                const now = new Date().toISOString();
                console.log(`[${now}] Track changed: ${logData.title} (ID: ${logData.trackId})`);
                res.statusCode = 200;
                res.end('Logged');
              } catch (err) {
                console.error('[Server] Failed to parse log data:', err);
                res.statusCode = 500;
                res.end('Error');
              }
            });
          } else {
            next();
          }
        }
      );
    }
  }
}

export default defineConfig({
  build: {
    outDir: "../dist/demo-site",
  },
  root: "demo",
  // Used only by the demo site, not the library
  assetsInclude: ["**/*.wsz", "**/*.mp3"],
  optimizeDeps: {
    include: ["winamp-eqf"],
  },
  // @ts-ignore
  plugins: [
    logServer() as any,
    ...getPlugins({
      minify: true,
      outputFile: "dist/demo-site/report",
      vite: true,
    }),
    /*
    replace({
      // Ensure we don't use the dev build of React
      values: { "process.env.NODE_ENV": JSON.stringify("production") },
      preventAssignment: true,
    }),
    nodeResolve(),
    typescript({
      compilerOptions: {
        jsx: "react-jsx",
        module: "esnext",
        declarationDir: "dist/declarations",
      },
    }),
    commonjs(),
    babel({ babelHelpers: "bundled" }),
    */
  ],
  worker: {
    rollupOptions: {},
  },
});

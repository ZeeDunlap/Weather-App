import { createServer as createViteServer } from "vite";
import { createApiServer } from "./server/index.js";

const apiServer = createApiServer();
const apiReady = new Promise((resolve, reject) => {
  apiServer.once("error", reject);
  apiServer.listen(3001, "127.0.0.1", resolve);
});

try {
  await apiReady;
  const viteServer = await createViteServer({ server: { host: "127.0.0.1" } });
  await viteServer.listen();
  viteServer.printUrls();
  console.log("AtmosAI API server listening at http://127.0.0.1:3001");

  async function stopServers() {
    await viteServer.close();
    await new Promise((resolve) => apiServer.close(resolve));
  }

  process.once("SIGINT", () => stopServers().then(() => process.exit(0)));
  process.once("SIGTERM", () => stopServers().then(() => process.exit(0)));
} catch (error) {
  apiServer.close();
  throw error;
}

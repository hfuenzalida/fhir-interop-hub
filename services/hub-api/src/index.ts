import { buildHubApplication } from "./build-app.js";

async function main(): Promise<void> {
  const hub = await buildHubApplication();

  const shutdown = async () => {
    await hub.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await hub.app.listen({
    host: hub.env.HUB_API_HOST,
    port: hub.env.HUB_API_PORT,
  });
  console.error(
    `hub-api listening on http://${hub.env.HUB_API_HOST}:${hub.env.HUB_API_PORT}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { loadBackendConfig } from './config.js';
import { createApp } from './app.js';

function main(): void {
  const config = loadBackendConfig();
  const app = createApp(config);

  app.listen(config.port, () => {
    console.log(`mongosh-llm backend listening on port ${config.port}`);
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

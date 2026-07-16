#!/usr/bin/env node

import { run } from "../src/cli.js";

run(process.argv.slice(2)).catch((error) => {
  if (process.argv.includes("--json")) {
    console.error(JSON.stringify({ error: error.message, stage: error.stage ?? "command" }));
    process.exitCode = 1;
    return;
  }
  console.error(`monoskill: ${error.message}`);
  if (process.env.DEBUG) console.error(error.stack);
  process.exitCode = 1;
});

import { spawn } from "node:child_process";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:6100";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status > 0) {
        return;
      }
    } catch {
      // Keep polling until Next is ready.
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const devServer = spawn(
    npmCommand,
    ["run", "dev", "--", "--hostname", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: "6100",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let serverOutput = "";

  devServer.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  devServer.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer(baseUrl, 120000);

    const vitest = spawn(
      npxCommand,
      ["vitest", "run", "--config", "vitest.config.e2e.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          E2E_BASE_URL: baseUrl,
        },
        stdio: "inherit",
      },
    );

    const exitCode = await new Promise<number>((resolve, reject) => {
      vitest.on("error", reject);
      vitest.on("exit", (code) => resolve(code ?? 1));
    });

    process.exitCode = exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (serverOutput) {
      console.error(serverOutput);
    }
    process.exitCode = 1;
  } finally {
    devServer.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

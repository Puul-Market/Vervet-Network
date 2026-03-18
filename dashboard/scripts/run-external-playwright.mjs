import { spawn } from "node:child_process";
import process from "node:process";

const suiteOrder = [
  "tests/e2e/partner-state-matrix.spec.ts",
  "tests/e2e/partner-role-admin-matrix.spec.ts",
  "tests/e2e/partner-mutation-flows.spec.ts",
  "tests/e2e/partner-trust-object-mutations.spec.ts",
  "tests/e2e/admin-production-governance.spec.ts",
  "tests/e2e/partner-access-security-mutations.spec.ts",
  "tests/e2e/partner-onboarding-approval.spec.ts",
];
const requestedSuites = process.argv.slice(2);
const suitesToRun = resolveSuitesToRun(requestedSuites);

const managedProcesses = [];

try {
  const backendReady = await isReachable("http://localhost:3000/v1/health");
  const dashboardReady = await isReachable("http://localhost:3001/");

  if (!backendReady) {
    const backendProcess = spawnManaged(
      "zsh",
      ["-lc", "npm run build && npm run start:prod"],
      {
        cwd: new URL("../../backend/", import.meta.url),
      },
    );
    managedProcesses.push(backendProcess);
    await waitForUrl("http://localhost:3000/v1/health");
  }

  if (!dashboardReady) {
    const dashboardProcess = spawnManaged(
      "zsh",
      ["-lc", "PORT=3001 npm run start"],
      {
        cwd: new URL("../", import.meta.url),
      },
    );
    managedProcesses.push(dashboardProcess);
    await waitForUrl("http://localhost:3001/");
  }

  for (const suitePath of suitesToRun) {
    console.log(`\n=== Running ${suitePath} ===\n`);
    await runCommand(
      "npx",
      ["playwright", "test", "--workers=1", suitePath],
      {
        cwd: new URL("../", import.meta.url),
        env: createChildEnv({
          PLAYWRIGHT_DISABLE_WEBSERVER: "1",
        }),
      },
    );
  }
} finally {
  for (const child of managedProcesses.reverse()) {
    child.kill("SIGTERM");
  }
}

function spawnManaged(command, args, options) {
  return spawn(command, args, {
    ...options,
    env: createChildEnv(options.env),
    stdio: "inherit",
  });
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: createChildEnv(options.env),
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code ?? "null"}${
            signal ? ` (signal: ${signal})` : ""
          }.`,
        ),
      );
    });
  });
}

async function isReachable(url) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
    });

    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForUrl(url, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(url)) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

function delay(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function resolveSuitesToRun(requestedSuitePaths) {
  if (requestedSuitePaths.length === 0) {
    return [...suiteOrder];
  }

  const normalizedRequestedSuites = new Set(requestedSuitePaths);
  const unknownSuitePaths = requestedSuitePaths.filter(
    (suitePath) => !suiteOrder.includes(suitePath),
  );

  if (unknownSuitePaths.length > 0) {
    throw new Error(
      `Unknown Playwright suite(s): ${unknownSuitePaths.join(", ")}.`,
    );
  }

  return suiteOrder.filter((suitePath) =>
    normalizedRequestedSuites.has(suitePath),
  );
}

function createChildEnv(overrides = {}) {
  const childEnv = {
    ...process.env,
    ...overrides,
  };

  delete childEnv.NO_COLOR;

  return childEnv;
}

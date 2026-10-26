import puppeteer from "puppeteer-core";
import { execSync } from "child_process";

function findChromium() {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return process.env.CHROMIUM_EXECUTABLE_PATH;

  // Resolve from PATH first — works for nixpacks (Railway), apt, brew, etc.
  for (const bin of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    try {
      const resolved = execSync(`command -v ${bin}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      if (resolved) return resolved;
    } catch {}
  }

  // Fixed-path fallbacks (macOS / common Linux locations).
  const candidates = [
    "/run/current-system/sw/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  for (const p of candidates) {
    try {
      execSync(`test -x "${p}"`, { stdio: "ignore" });
      return p;
    } catch {}
  }

  throw new Error("No Chromium/Chrome found. Set CHROMIUM_EXECUTABLE_PATH or install chromium.");
}

export async function launchBrowser() {
  return puppeteer.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
}

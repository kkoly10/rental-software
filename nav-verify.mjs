import { chromium } from "@playwright/test";
const EMAIL = process.env.E, PASSWORD = process.env.P;
const BASE = "https://korent.app";
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error" && !/SSL|Vercel|favicon|hydrat|nominatim/i.test(m.text())) errs.push(m.text().slice(0,120)); });
const crashed = async () => page.getByText(/something went wrong/i).first().isVisible().catch(()=>false);
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL(/\/dashboard/, { timeout: 40000 }).catch(()=>{}), page.click('button[type="submit"]')]);
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/dashboard/website/builder`, { waitUntil: "domcontentloaded", timeout: 50000 });
  await page.waitForTimeout(4500);
  if (await page.locator(".st-tour-skip").isVisible().catch(()=>false)) { await page.locator(".st-tour-skip").click(); await page.waitForTimeout(500); }

  const cat = page.locator('[data-st-nav-key="catalog"]').first();
  const beforeLabel = (await cat.innerText().catch(()=> "")).trim();
  log("catalog nav label BEFORE:", JSON.stringify(beforeLabel));
  // Click the nav label → inline overlay + suggestions popover
  await cat.click();
  await page.waitForTimeout(900);
  const overlay = await page.locator(".st-inline-edit-overlay").isVisible().catch(()=>false);
  const sugg = page.locator(".st-editor-nav-suggestions");
  const suggVisible = await sugg.isVisible().catch(()=>false);
  const chips = await sugg.locator("button, [role='option']").allInnerTexts().catch(()=>[]);
  log("overlay open:", overlay, "| suggestions visible:", suggVisible, "| crashed:", await crashed());
  log("suggestion chips:", JSON.stringify(chips));
  await page.screenshot({ path: "/tmp/nav-edit.png" });

  // Click the "Inventory" suggestion if present → applies + commits
  const inv = sugg.locator("button, [role='option']").filter({ hasText: /^Inventory$/ }).first();
  if (await inv.isVisible().catch(()=>false)) {
    await inv.click();
    await page.waitForTimeout(4000);
    const after = (await page.locator('[data-st-nav-key="catalog"]').first().innerText().catch(()=> "")).trim();
    log("catalog nav label AFTER pick:", JSON.stringify(after), "| crashed:", await crashed());
    await page.screenshot({ path: "/tmp/nav-applied.png" });
  } else {
    log("Inventory chip not found");
  }
  log("console errors:", errs.length); errs.slice(0,5).forEach(e=>log("  •",e));
} catch (e) { log("FATAL:", e.message); } finally { await browser.close(); }

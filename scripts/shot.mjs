import { chromium } from "playwright";
const [,, url, out, w=1440, h=1100] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
try {
  const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log("status:", resp && resp.status(), "final url:", p.url());
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out, fullPage: true });
  console.log("shot saved:", out);
} catch (e) {
  console.log("ERROR:", e.message);
  try { await p.screenshot({ path: out }); console.log("partial shot saved"); } catch {}
} finally {
  await b.close();
}

// One-off: capture a real screenshot of the in-app Crew Mobile route
// view (running in demo mode with seeded fallback data) for the
// marketing homepage "Drivers know exactly where to go" section.
//
// Usage: node scripts/capture-crew-route.mjs
// Requires the dev server running at http://localhost:3000.
import { chromium } from "playwright";

const OUT = "public/marketing/product/crew-route.jpg";
const URL = "http://localhost:3000/crew/today";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 402, height: 880 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  // The sandbox egress proxy re-signs HTTPS with an untrusted cert, so
  // OSM map tiles abort with ERR_CERT_AUTHORITY_INVALID. Ignore it so
  // the real map tiles paint for the capture.
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

// Hide demo-only chrome + map zoom buttons so the shot reads as the real
// product, not a demo. Keep the OSM attribution (authentic + correct).
await page.addStyleTag({
  content: `
    .demo-mode-banner { display: none !important; }
    .leaflet-control-zoom { display: none !important; }
    nextjs-portal { display: none !important; }
  `,
});

// Wait for the route content + at least some Leaflet tiles to paint.
await page.waitForSelector(".crew-stops", { timeout: 30000 });
await page.waitForFunction(
  () => document.querySelectorAll("img.leaflet-tile-loaded").length >= 4,
  { timeout: 30000 }
).catch(() => console.warn("map tiles slow — capturing anyway"));
// Settle: tile fade-in + client hydration.
await page.waitForTimeout(2500);

// Clip to the viewport (the top of the crew screen: topbar, map,
// route head, progress, first stops) so it reads as a phone screen.
await page.screenshot({ path: OUT, type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: 402, height: 880 } });

console.log(`saved ${OUT}`);
await browser.close();

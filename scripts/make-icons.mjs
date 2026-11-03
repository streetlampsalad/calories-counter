// Draws the app icons into public/icons/ (run: node scripts/make-icons.mjs). The PNGs are committed,
// so this only needs running when the design changes. It uses the Chromium that Playwright installs.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BACKGROUND = "#171717";
const FOREGROUND = "#ffffff";

// A bold "C" with a dot where it opens, on a dark square. `rounded` for the ordinary icons;
// maskable icons fill the whole square, because the phone cuts its own shape out of it.
const svg = ({ rounded }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${BACKGROUND}"/>
  <path d="M 345 177 A 125 125 0 1 0 345 335" fill="none" stroke="${FOREGROUND}"
        stroke-width="52" stroke-linecap="round"/>
  <circle cx="368" cy="256" r="26" fill="${FOREGROUND}"/>
</svg>`;

const ICONS = [
  { file: "icon-192.png", size: 192, rounded: true },
  { file: "icon-512.png", size: 512, rounded: true },
  { file: "icon-maskable-512.png", size: 512, rounded: false },
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, size, rounded } of ICONS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<body style="margin:0;background:transparent">${svg({ rounded }).replace(
        'width="512" height="512"',
        `width="${size}" height="${size}"`,
      )}</body>`,
    );
    await page.screenshot({
      path: `public/icons/${file}`,
      omitBackground: true,
    });
    await page.close();
    console.log(`public/icons/${file}`);
  }
} finally {
  await browser.close();
}

import { chromium } from "playwright";
import { newInjectedContext } from "fingerprint-injector";
import { checkTz } from "./tz_px.js"; // Ensure this module is properly set up
import dotenv from "dotenv";

const url = "https://blog.cybertoolhub.space/";

const MIN_BOTS = 1; // Minimum number of bots per batch
const MAX_BOTS = 2; // Maximum number of bots per batch

const generateUsername = () => {
  const locations = [
    "se", // Sweden
    "se", // Sweden
    "ua", // Ukraine
    "ua", // Ukraine
    "at", // Austria
    "at", // Austria
    "fr", // France
    "fr", // France
    "fr", // France
    "fr", // France
    "ca", // Canada
    "ca", // Canada
    "ca", // Canada
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "us", // United States
    "uk", // United Kingdom
    "uk", // United Kingdom
    "uk", // United Kingdom
    "uk", // United Kingdom
    "uk", // United Kingdom
    "de", // Germany
    "jp", // Japan
    "sg", // Singapore
    "kr", // South Korea
    "it", // Italy
    "es", // Spain
    "in", // India
    "id", // Indonesia
    "ph", // Philippines
    "th", // Thailand
    "tr", // Turkey
    "mx", // Mexico (geographical proximity, U.S. ties)
    "no", // Norway
    "hk", // Hong Kong
  ];

  return `user-doublemobmedia-sessionduration-10-country-${
    locations[Math.floor(Math.random() * locations.length)]
  }-session-${Math.floor(10000 + Math.random() * 90000)}`;
};

const realisticHeaders = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "accept-encoding": "gzip, deflate, br",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "upgrade-insecure-requests": "1",
};

const humanMouseMovements = [
  { type: "move", x: 100, y: 200, duration: 500 },
  { type: "click", x: 300, y: 400 },
  { type: "scroll", y: 500 },
  { type: "move", x: 50, y: 300, duration: 1000 },
];
const generateGoogleReferer = () => {
  const searchTerms = encodeURIComponent(
    [
      "movie streaming",
      "watch films online",
      "latest movies",
      "free movies",
      "hd films",
      "cinema releases",
    ][Math.floor(Math.random() * 6)]
  );

  const params = new URLSearchParams({
    q: searchTerms,
    rlz: "1C1CHBF_enUS800US800", // Common Chrome parameter
    oq: searchTerms.substring(0, 5),
    aqs: "chrome..69i57j0i512l9", // Browser specific
    sourceid: "chrome",
    ie: "UTF-8",
    prmd: "imvnsb",
    ved: `0ahUKEwj${Math.random().toString(36).substr(2, 20)}`,
    pdd: "1",
  });

  return `https://www.google.com/search?${params}`;
};

const getRandomReferer = () => {
  const sources = [
    {
      weight: 70,
      generator: () => generateGoogleReferer(),
    },
    {
      weight: 15,
      generator: () =>
        `https://www.facebook.com/${
          Math.random() > 0.5 ? "watch" : "groups"
        }/?ref=${Math.random().toString(36).substr(2)}`,
    },
    {
      weight: 10,
      generator: () =>
        `https://twitter.com/search?q=${encodeURIComponent(
          ["film", "movie", "stream"][Math.floor(Math.random() * 3)]
        )}&src=typed_query`,
    },
    {
      weight: 5,
      generator: () =>
        `https://www.reddit.com/r/${
          ["movies", "Streaming", "Piracy"][Math.floor(Math.random() * 3)]
        }/`,
    },
  ];

  const totalWeight = sources.reduce((acc, curr) => acc + curr.weight, 0);
  let random = Math.random() * totalWeight;

  for (const source of sources) {
    if (random < source.weight) return source.generator();
    random -= source.weight;
  }
  return sources[0].generator();
};

const humanType = async (page, text) => {
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
    if (Math.random() < 0.05)
      await page.waitForTimeout(200 + Math.random() * 500);
  }
};

const realisticScroll = async (page) => {
  const scrollSteps = Math.floor(Math.random() * 5) + 3;
  for (let i = 0; i < scrollSteps; i++) {
    const scrollDistance = Math.random() * 800 + 200;
    await page.mouse.wheel(0, scrollDistance);
    await page.waitForTimeout(Math.random() * 1000 + 500);
  }
};

const getUserAgent = (referer) => {
  if (referer.includes("google.com")) {
    // Chrome on Windows (most common for Google searches)
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }
  if (referer.includes("facebook.com")) {
    // Mobile user agent for Facebook
    return "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  }
  // Default to desktop Chrome
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
};

const humanInteraction = async (page) => {
  // Random mouse movements
  for (const action of humanMouseMovements) {
    if (action.type === "move") {
      await page.mouse.move(
        action.x + Math.random() * 50,
        action.y + Math.random() * 50,
        {
          steps: 10,
          duration: action.duration,
        }
      );
    } else if (action.type === "click") {
      await page.mouse.click(
        action.x + Math.random() * 50,
        action.y + Math.random() * 50
      );
    } else if (action.type === "scroll") {
      await realisticScroll(page);
    }
    await page.waitForTimeout(Math.random() * 1000 + 500);
  }

  // Random typing simulation
  if (Math.random() < 0.3) {
    await humanType(
      page,
      String.fromCharCode(65 + Math.floor(Math.random() * 26))
    );
  }
};

const OpenBrowser = async (link, username) => {
  dotenv.config();
  console.log(`Starting session for ${username}`);

  let browser = null;
  let context = null;

  try {
    console.log(`Session type: "Regular"`);

    browser = await chromium.launch({
      headless: true,
      proxy: {
        server: "us.smartproxy.com:10000",
        username: username,
        password: process.env.JEDI,
      },
    });
    let operatingSystems = ["chrome", "firefox", "safari", "edge"][
      Math.floor(Math.random() * 4)
    ];
    context = await newInjectedContext(browser, {
      fingerprintOptions: {
        devices: [Math.random() < 0.5 ? "desktop" : "mobile"],
        browsers: [operatingSystems],
        operatingSystems: [
          ["windows", "macos", "linux", "android", "ios"][
            Math.floor(Math.random() * 5)
          ],
        ],
        locales: [["en-US", "en-GB", "fr-FR"][Math.floor(Math.random() * 3)]],
        screen: {
          width: Math.random() < 0.8 ? 1920 : 1366,
          height: Math.random() < 0.8 ? 1080 : 768,
        },
      },
    });

    const randomReferer = getRandomReferer();

    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
      ...realisticHeaders,
      "user-agent": getUserAgent(randomReferer),
      referer: randomReferer,
    });

    // Block unnecessary resources
    await page.route("**/*", (route) => {
      return ["image", "stylesheet", "font", "media"].includes(
        route.request().resourceType()
      )
        ? route.abort()
        : route.continue();
    });

    // Add human-like delays
    await page.goto(link, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`Successfully loaded page for ${username}`);

    // Random interaction sequence
    await page.waitForTimeout(2000 + Math.random() * 3000);
    await realisticScroll(page);
    await humanInteraction(page);

    await page.waitForTimeout(15000 + Math.random() * 25000);

    console.log(`Completed session for ${username}`);
  } catch (error) {
    console.error(`Session failed for ${username}:`, error);
  } finally {
    try {
      if (context) await context.close();
      if (browser) await browser.close();
      console.log(`Cleaned up session for ${username}`);
    } catch (cleanupError) {
      console.error(`Cleanup failed for ${username}:`, cleanupError);
    }
  }
};

const tasksPoll = async () => {
  const bots = Math.floor(Math.random() * (MAX_BOTS - MIN_BOTS + 1)) + MIN_BOTS;
  console.log(
    `Starting batch with ${bots} bots (min: ${MIN_BOTS}, max: ${MAX_BOTS})`
  );

  const tasks = Array.from({ length: bots }).map(() => {
    const username = generateUsername();
    return OpenBrowser(url, username);
  });

  await Promise.all(tasks);
};

const RunTasks = async () => {
  let totalViews = 0;

  for (let i = 0; i < 14534554; i++) {
    try {
      await tasksPoll();
      totalViews += 1;
      console.log(`Total Views: ${totalViews}`);
      // Add delay between batches (5-10 seconds)
      await new Promise((resolve) =>
        setTimeout(resolve, 5000 + Math.random() * 5000)
      );
    } catch (error) {
      console.log(error);
    }
  }
};

// Start the bot
RunTasks();

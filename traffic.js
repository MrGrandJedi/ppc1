import { chromium } from "playwright";
import { newInjectedContext } from "fingerprint-injector";
import { checkTz } from "./tz_px.js"; // Ensure this module is properly set up
import dotenv from "dotenv";

import fs from "fs";

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync("./c.json", "utf-8"));

const url = "https://blog.cybertoolhub.space/";

const MIN_BOTS = 6; // Minimum number of bots per batch
const MAX_BOTS = 6; // Maximum number of bots per batch

// Define the weighted locations for generating usernames
const weightedLocations = {
  se: 10,
  ua: 2,
  at: 2,
  fr: 4,
  ca: 3,
  us: 30,
  uk: 10,
  dk: 5,
};
export const generateNoise = () => {
  const shift = {
    r: Math.floor(Math.random() * 5) - 2,
    g: Math.floor(Math.random() * 5) - 2,
    b: Math.floor(Math.random() * 5) - 2,
    a: Math.floor(Math.random() * 5) - 2,
  };
  const webglNoise = (Math.random() - 0.5) * 0.01;
  const clientRectsNoise = {
    deltaX: (Math.random() - 0.5) * 2,
    deltaY: (Math.random() - 0.5) * 2,
  };
  const audioNoise = (Math.random() - 0.5) * 0.000001;

  return { shift, webglNoise, clientRectsNoise, audioNoise };
};

export const noisifyScript = (noise) => `
  (function() {
    const noise = ${JSON.stringify(noise)};

    // Canvas Noisify
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;
    const noisify = function (canvas, context) {
      if (context) {
        const shift = noise.shift;
        const width = canvas.width;
        const height = canvas.height;
        if (width && height) {
          const imageData = getImageData.apply(context, [0, 0, width, height]);
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
              const n = ((i * (width * 4)) + (j * 4));
              imageData.data[n + 0] = imageData.data[n + 0] + shift.r;
              imageData.data[n + 1] = imageData.data[n + 1] + shift.g;
              imageData.data[n + 2] = imageData.data[n + 2] + shift.b;
              imageData.data[n + 3] = imageData.data[n + 3] + shift.a;
            }
          }
          context.putImageData(imageData, 0, 0); 
        }
      }
    };
    HTMLCanvasElement.prototype.toBlob = new Proxy(HTMLCanvasElement.prototype.toBlob, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });
    HTMLCanvasElement.prototype.toDataURL = new Proxy(HTMLCanvasElement.prototype.toDataURL, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });
    CanvasRenderingContext2D.prototype.getImageData = new Proxy(CanvasRenderingContext2D.prototype.getImageData, {
      apply(target, self, args) {
        noisify(self.canvas, self);
        return Reflect.apply(target, self, args);
      }
    });

    // Audio Noisify
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {
      const results = originalGetChannelData.apply(this, arguments);
      for (let i = 0; i < results.length; i++) {
        results[i] += noise.audioNoise; // Smaller variation
      }
      return results;
    };

    const originalCopyFromChannel = AudioBuffer.prototype.copyFromChannel;
    AudioBuffer.prototype.copyFromChannel = function() {
      const channelData = new Float32Array(arguments[1]);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] += noise.audioNoise; // Smaller variation
      }
      return originalCopyFromChannel.apply(this, [channelData, ...Array.prototype.slice.call(arguments, 1)]);
    };

    const originalCopyToChannel = AudioBuffer.prototype.copyToChannel;
    AudioBuffer.prototype.copyToChannel = function() {
      const channelData = arguments[0];
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] += noise.audioNoise; // Smaller variation
      }
      return originalCopyToChannel.apply(this, arguments);
    };

    // WebGL Noisify
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function() {
      const value = originalGetParameter.apply(this, arguments);
      if (typeof value === 'number') {
        return value + noise.webglNoise; // Small random variation
      }
      return value;
    };

    // ClientRects Noisify
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.apply(this, arguments);
      const deltaX = noise.clientRectsNoise.deltaX; // Random shift between -1 and 1
      const deltaY = noise.clientRectsNoise.deltaY; // Random shift between -1 and 1
      return {
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: rect.width + deltaX,
        height: rect.height + deltaY,
        top: rect.top + deltaY,
        right: rect.right + deltaX,
        bottom: rect.bottom + deltaY,
        left: rect.left + deltaX
      };
    };
  })();
`;

// Build weighted list
const locations = Object.entries(weightedLocations).flatMap(([code, weight]) =>
  Array(weight).fill(code)
);

const generateUsername = () => {
  const code = locations[Math.floor(Math.random() * locations.length)];
  const rand = Math.floor(10000 + Math.random() * 90000);
  return config.proxyUser.replace("%CODE%", code).replace("%RAND%", rand);
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

const generateFingerprintOptions = () => {
  const isMobile = Math.random() < 0.8;

  if (isMobile) {
    // Decide Android vs. iOS
    const isAndroid = Math.random() < 0.7;

    if (isAndroid) {
      // Android browsers and a list of common screen resolutions
      const androidBrowsers = ["chrome", "firefox", "edge", "opera", "samsung"];
      const androidResolutions = [
        { width: 360, height: 640 },
        { width: 360, height: 760 },
        { width: 360, height: 780 },
        { width: 360, height: 800 },
        { width: 375, height: 667 },
        { width: 390, height: 844 },
        { width: 393, height: 851 },
        { width: 411, height: 731 },
        { width: 412, height: 915 },
        { width: 414, height: 896 },
      ];

      const browser =
        androidBrowsers[Math.floor(Math.random() * androidBrowsers.length)];
      const screen =
        androidResolutions[
          Math.floor(Math.random() * androidResolutions.length)
        ];

      return {
        devices: ["mobile"],
        browsers: [browser],
        operatingSystems: ["android"],
        locales: [["en-US", "en-GB", "fr-FR"][Math.floor(Math.random() * 3)]],
        screen,
      };
    } else {
      // A few realistic iOS variants (all use Safari on iOS)
      const iosVariants = [
        { width: 375, height: 812 }, // iPhone X/11 Pro
        { width: 390, height: 844 }, // iPhone 12/13/14
        { width: 414, height: 896 }, // iPhone 11 Pro Max/XS Max
        { width: 428, height: 926 }, // iPhone 12/13/14 Pro Max
      ];
      const pick = iosVariants[Math.floor(Math.random() * iosVariants.length)];

      return {
        devices: ["mobile"],
        browsers: ["safari"],
        operatingSystems: ["ios"],
        locales: [["en-US", "en-GB", "fr-FR"][Math.floor(Math.random() * 3)]],
        screen: pick,
      };
    }
  } else {
    // 20% chance desktop: pick one of four common combos
    const desktopVariants = [
      {
        browser: "chrome",
        os: "windows",
        screen: { width: 1920, height: 1080 },
      },
      {
        browser: "firefox",
        os: "linux",
        screen: { width: 1366, height: 768 },
      },
      {
        browser: "edge",
        os: "windows",
        screen: { width: 1600, height: 900 },
      },
      {
        browser: "safari",
        os: "macos",
        screen: { width: 1440, height: 900 },
      },
    ];
    const pick =
      desktopVariants[Math.floor(Math.random() * desktopVariants.length)];

    return {
      devices: ["desktop"],
      browsers: [pick.browser],
      operatingSystems: [pick.os],
      locales: [["en-US", "en-GB", "fr-FR"][Math.floor(Math.random() * 3)]],
      screen: pick.screen,
    };
  }
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

  const timezone = await checkTz(username);
  if (timezone == undefined) {
    return;
  }

  try {
    const noise = generateNoise();

    console.log(`Session type: "Regular"`);

    browser = await chromium.launch({
      headless: true,
      proxy: {
        server: config.proxyHost + ":" + config.proxyPort,
        username: username,
        password: process.env.JEDI,
      },
    });

    const randomfingerprintOptions = generateFingerprintOptions();

    context = await newInjectedContext(browser, {
      fingerprintOptions: randomfingerprintOptions,
      newContextOptions: {
        timezoneId: timezone || "America/New_York",
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

    await page.addInitScript(noisifyScript(noise));

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

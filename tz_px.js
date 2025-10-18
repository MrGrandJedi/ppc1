import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import dotenv from "dotenv";
import fs from "fs";

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync("./c.json", "utf-8"));

const DEFAULT_TIMEZONES = {
  us: "America/New_York",
  uk: "Europe/London",
  fr: "Europe/Paris",
};

export const checkTz = async (username) => {
  dotenv.config();
  const proxyHost = config.proxyHost;
  const proxyPort = config.proxyPort;
  const proxyUsername = username;
  const proxyPassword = process.env.JEDI;

  // Extract country code from username (assuming format contains country code)
  const countryCode = username.split("-")[2]?.toLowerCase();

  // Properly formatted proxy URL
  const proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
  const proxyAgent = new HttpsProxyAgent(proxyUrl);

  try {
    const response = await axios.get(
      "https://tz.mahdiidrissi2022.workers.dev/",
      {
        httpsAgent: proxyAgent,
        timeout: 10000,
        validateStatus: (status) => status === 200,
      }
    );

    const timezone = response.data.trim();
    if (timezone) {
      return timezone;
    }

    // If we got a response but no timezone, use fallback
    throw new Error("Empty timezone response");
  } catch (error) {
    console.error(`Timezone fetch failed:`, error.message);
    console.log("Retrying once...");

    // Single retry attempt
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

      const retryResponse = await axios.get(
        "https://white-water-a7d6.mahdiidrissi2022.workers.dev/",
        {
          httpsAgent: proxyAgent,
          timeout: 10000,
          validateStatus: (status) => status === 200,
        }
      );

      const retryTimezone = retryResponse.data.trim();
      if (retryTimezone) {
        return retryTimezone;
      }

      throw new Error("Empty timezone response on retry");
    } catch (retryError) {
      console.error(`Retry attempt also failed:`, retryError.message);

      // If retry failed, use fallback timezone based on country code
      if (countryCode && DEFAULT_TIMEZONES[countryCode]) {
        console.log(
          `Using fallback timezone for ${countryCode}: ${DEFAULT_TIMEZONES[countryCode]}`
        );
        return DEFAULT_TIMEZONES[countryCode];
      }

      // If we can't determine country code, use US as default
      console.log("Using default US timezone as fallback");
      return "America/New_York";
    }
  }
};


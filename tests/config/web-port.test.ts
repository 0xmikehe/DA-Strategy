import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import playwrightConfig from "../../playwright.config";

const webBaseUrl = "http://127.0.0.1:3300";

describe("web port configuration", () => {
  it("pins local Next.js and Playwright to port 3300", () => {
    expect(packageJson.scripts.dev).toBe("next dev --port 3300");
    expect(packageJson.scripts.start).toBe("next start --port 3300");

    expect(playwrightConfig.use?.baseURL).toBe(webBaseUrl);
    expect(playwrightConfig.webServer).toMatchObject({
      command: "npm run dev",
      url: webBaseUrl
    });
  });
});

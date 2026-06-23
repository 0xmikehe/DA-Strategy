import { expect, test } from "@playwright/test";

test.describe("P1.5 market data page", () => {
  test("opens from the workspace entry and renders shadow market data without raw payloads", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "数字资产投资操作系统" })).toBeVisible();
    await page.getByRole("link", { name: "行情数据页" }).first().click();

    await expect(page).toHaveURL(/\/market-data$/);
    await expect(page.getByRole("heading", { level: 1, name: "行情数据" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open interest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Global long/short" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top trader positions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top trader accounts" })).toBeVisible();
    await expect(page.getByText("mdf_2026_06_20_0200_oi")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("raw_payload");
    await expect(page.locator("body")).not.toContainText("rawPayload");
  });

  test("keeps the metric panels in a single usable row on 2560px widescreen", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto("/market-data");

    const metricCards = page.locator(".market-data-metric");
    await expect(metricCards).toHaveCount(4);

    const boxes = await Promise.all(
      [0, 1, 2, 3].map(async (index) => {
        const box = await metricCards.nth(index).boundingBox();
        expect(box).not.toBeNull();
        return box!;
      })
    );
    const rowTop = boxes[0].y;

    for (const box of boxes) {
      expect(Math.abs(box.y - rowTop)).toBeLessThanOrEqual(2);
      expect(box.width).toBeGreaterThan(250);
    }
  });
});

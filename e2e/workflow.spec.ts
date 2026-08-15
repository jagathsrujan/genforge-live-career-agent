import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.removeItem("genforge.workspaceId"));
  await page.reload();
});

test("persists rapid candidate entry after reload", async ({ page }) => {
  await page.getByRole("button", { name: /Start blank workspace/i }).click();
  await page.getByLabel("Full name").fill("Alex Rivera");
  await page.getByLabel("Headline").fill("Mechanical engineer moving into product systems");
  await page.getByLabel("Email").fill("alex@example.test");
  await page.getByLabel("Phone").fill("+1 415 555 0101");
  await page.getByLabel("Location").fill("Seattle, WA");
  await page.getByLabel("Professional summary").fill("Designs reliable systems and documents decisions clearly.");
  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Alex Rivera");
  await expect(page.getByLabel("Email")).toHaveValue("alex@example.test");
  await expect(page.getByLabel("Phone")).toHaveValue("+1 415 555 0101");
  await expect(page.getByLabel("Location")).toHaveValue("Seattle, WA");
  await expect(page.getByLabel("Professional summary")).toHaveValue("Designs reliable systems and documents decisions clearly.");
});

test("runs the synthetic live workflow and exports reviewed formats", async ({ page }) => {
  await page.getByRole("button", { name: /Load demo workspace/i }).click();
  await expect(page.getByText("Synthetic inputs")).toBeVisible();
  await page.getByRole("button", { name: "Privacy boundary", exact: true }).click();
  await page.getByRole("button", { name: /I understand — enable live runs/i }).click();
  await page.getByRole("button", { name: "Start live run" }).first().click();
  await expect(page.getByRole("status")).toContainText("Live run completed", { timeout: 30_000 });

  await page.getByRole("button", { name: /Evidence/i }).click();
  await expect(page.getByText(/Built an accessible React and TypeScript study planner/i)).toBeVisible();
  await page.getByRole("article").first().click();
  await page.getByRole("button", { name: /Approve claim/i }).click();

  await page.getByRole("button", { name: /Resume studio/i }).click();
  await page.getByRole("button", { name: /ATS Classic/i }).click();
  await expect(page.getByText(/Resume draft created/i)).toBeVisible();
  await page.getByRole("button", { name: /Open export/i }).click();
  await page.getByRole("button", { name: /Refresh checks/i }).click();
  await expect(page.getByText(/Ready to export|Review checks/i)).toBeVisible();

  for (const format of ["PDF", "DOCX", "Markdown", "Plain text"]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: new RegExp(format) }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/synthetic|maya|resume/i);
  }
});

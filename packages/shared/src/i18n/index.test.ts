import { describe, it, expect } from "vitest";
import { t, getAvailableLocales, registerLocale } from "./index.js";

describe("i18n", () => {
  it("returns English string by default", () => {
    expect(t("app.name")).toBe("What Do You Mean");
  });

  it("returns Chinese string for zh locale", () => {
    expect(t("app.name", "zh")).toBe("啥意思");
  });

  it("falls back to English when key missing in requested locale", () => {
    // Register a sparse locale
    registerLocale("test" as any, { "app.name": "Test App" });
    // Key exists in test locale
    expect(t("app.name", "test" as any)).toBe("Test App");
    // Key missing in test locale — falls back to English
    expect(t("session.start", "test" as any)).toBe("Start Session");
  });

  it("returns the key itself when not found in any locale", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
    expect(t("nonexistent.key", "zh")).toBe("nonexistent.key");
  });

  it("lists available locales", () => {
    const locales = getAvailableLocales();
    expect(locales).toContain("en");
    expect(locales).toContain("zh");
  });

  it("translates card categories", () => {
    expect(t("card.category.opinion", "en")).toBe("Opinion");
    expect(t("card.category.opinion", "zh")).toBe("观点");
  });

  it("translates session controls", () => {
    expect(t("session.start", "en")).toBe("Start Session");
    expect(t("session.start", "zh")).toBe("开始会话");
  });

  it("registers a new locale dynamically", () => {
    registerLocale("fr" as any, { "app.name": "Qu'est-ce que tu veux dire" });
    expect(t("app.name", "fr" as any)).toBe("Qu'est-ce que tu veux dire");
  });
});

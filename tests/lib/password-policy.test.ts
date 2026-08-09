import { describe, it, expect } from "vitest";
import { validatePassword, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum length", () => {
    expect(validatePassword("a1!")).toMatch(new RegExp(`${PASSWORD_MIN_LENGTH}자`));
  });

  it("rejects passwords with no special character", () => {
    expect(validatePassword("password123")).toMatch(/특수문자/);
  });

  it("rejects passwords containing characters outside the allowed set (e.g. a space)", () => {
    expect(validatePassword("password 123!")).toMatch(/사용할 수 있습니다/);
  });

  it("rejects passwords containing unicode outside the allowed set (e.g. emoji)", () => {
    expect(validatePassword("password123!😀")).toMatch(/사용할 수 있습니다/);
  });

  it("accepts a password meeting length + special-character requirements", () => {
    expect(validatePassword("password123!")).toBeNull();
  });

  it("accepts every character in the documented allowed special-character set", () => {
    expect(validatePassword("abcdef12!@#$%^&*()_+-=[]{};':\"\\|,.<>/?~")).toBeNull();
  });
});

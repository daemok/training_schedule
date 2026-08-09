import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { login } from "@/app/login/actions";
import { LOGIN_THROTTLE_MESSAGE } from "@/lib/login-throttle";
import { resetDb, TEST_PASSWORD } from "../helpers/fixtures";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

function formDataFrom(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function failedAttempt(email: string, password = "wrong-password!") {
  return login({}, formDataFrom({ email, password }));
}

describe("login brute-force throttle", () => {
  it("returns the normal wrong-credential error while under the threshold", async () => {
    const result = await failedAttempt(fx.userInstructorA.email);
    expect(result.error).toMatch(/이메일 또는 비밀번호가 올바르지 않습니다/);
  });

  it("locks a single account after repeated failures, even once the correct password is used", async () => {
    for (let i = 0; i < 5; i++) {
      await failedAttempt(fx.userInstructorA.email);
    }
    const result = await login(
      {},
      formDataFrom({ email: fx.userInstructorA.email, password: TEST_PASSWORD })
    );
    expect(result.error).toBe(LOGIN_THROTTLE_MESSAGE);
  });

  it("does not lock a different account after another account's failures", async () => {
    for (let i = 0; i < 5; i++) {
      await failedAttempt(fx.userInstructorA.email);
    }
    const result = await failedAttempt(fx.userInstructorB.email);
    expect(result.error).not.toBe(LOGIN_THROTTLE_MESSAGE);
  });

  it("locks the IP after many failures spread across different (including nonexistent) emails", async () => {
    for (let i = 0; i < 21; i++) {
      await failedAttempt(`nonexistent-${i}@test.local`);
    }
    // A brand-new email/attempt from the same (test-default) IP should now be blocked too.
    const result = await failedAttempt("yet-another-new-address@test.local");
    expect(result.error).toBe(LOGIN_THROTTLE_MESSAGE);
  });

  it("records each failed attempt in the audit log", async () => {
    await failedAttempt(fx.userInstructorA.email);
    await failedAttempt(fx.userInstructorA.email);
    const count = await prisma.loginAttempt.count({
      where: { email: fx.userInstructorA.email, succeeded: false },
    });
    expect(count).toBe(2);
  });
});

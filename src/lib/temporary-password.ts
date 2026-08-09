import crypto from "node:crypto";

/** 로그인용 임시 비밀번호를 생성한다 — 계정에게 한 번만 노출되고, 이후에는 해시만 저장된다. */
export function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

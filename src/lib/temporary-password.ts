import crypto from "node:crypto";
import { PASSWORD_SPECIAL_CHARS } from "./password-policy";

/**
 * 로그인용 임시 비밀번호를 생성한다 — 계정에게 한 번만 노출되고, 이후에는 해시만
 * 저장된다. 11자의 영숫자 뒤에 특수문자 1개를 임의 위치에 끼워 넣어, 자체적으로
 * `password-policy.ts`의 정책(8자 이상 + 특수문자 포함)을 항상 만족하도록 만든다.
 */
export function generateTemporaryPassword(): string {
  const alnum = crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 11);
  const specialChar = PASSWORD_SPECIAL_CHARS[crypto.randomInt(PASSWORD_SPECIAL_CHARS.length)];
  const insertAt = crypto.randomInt(alnum.length + 1);
  return alnum.slice(0, insertAt) + specialChar + alnum.slice(insertAt);
}

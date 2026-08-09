export const PASSWORD_MIN_LENGTH = 8;

/** 허용되는 특수문자 — 키보드로 바로 입력 가능한 일반적인 문자만 포함한다. */
export const PASSWORD_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?~";

// 영문/숫자/위 특수문자 외의 문자(공백, 이모지, 제어문자 등)는 허용하지 않는다.
const ALLOWED_CHARS_RE = /^[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]+$/;
const HAS_SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/;

/**
 * 비밀번호 정책: 8자 이상 + 특수문자 최소 1개 포함 + 영문/숫자/일반 특수문자 외의
 * 문자는 사용 불가. 신규 가입, 본인 비밀번호 변경 등 사용자가 직접 비밀번호를 정하는
 * 모든 경로에서 이 함수로 검증한다(관리자가 생성하는 임시 비밀번호는
 * `src/lib/temporary-password.ts`가 애초에 이 정책을 만족하도록 생성하므로 별도 검증이
 * 필요 없다). 통과하면 null, 아니면 사용자에게 보여줄 에러 메시지를 반환한다.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (!ALLOWED_CHARS_RE.test(password)) {
    return "비밀번호는 영문, 숫자, 일반 특수문자(!@#$%^&* 등)만 사용할 수 있습니다.";
  }
  if (!HAS_SPECIAL_RE.test(password)) {
    return "비밀번호에 특수문자를 최소 1개 포함해주세요.";
  }
  return null;
}

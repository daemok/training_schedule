import "dotenv/config";

// 이 파일은 각 테스트 파일이 자신의 모듈(예: @/lib/prisma)을 import하기 전에 실행된다.
// 실제 개발용 DATABASE_URL 대신 테스트 전용 Postgres DB를 쓰도록 강제한다.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL 환경 변수가 설정되어 있지 않습니다. .env에 테스트 전용 Postgres 연결 문자열을 추가하세요."
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-secret-key-for-vitest-only-not-for-prod";

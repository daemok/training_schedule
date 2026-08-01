import "dotenv/config";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Vitest globalSetup — 전체 테스트 실행 전 한 번, 별도 프로세스에서 실행된다.
 * 개발용 DB와 분리된 전용 Postgres DB(TEST_DATABASE_URL)에 마이그레이션을 적용해둔다.
 * (각 테스트 파일은 tests/setup.ts에서 동일한 DATABASE_URL을 스스로 설정한다 —
 * 이 프로세스의 env는 테스트 워커 프로세스로 전달되지 않으므로 URL 문자열만 공유한다.)
 */
export default function globalSetup() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL 환경 변수가 설정되어 있지 않습니다. .env에 테스트 전용 Postgres 연결 문자열을 추가하세요."
    );
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
  });
}

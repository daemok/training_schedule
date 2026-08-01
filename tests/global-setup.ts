import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const TEST_DB_PATH = path.resolve(__dirname, "../prisma/test.db");
const TEST_DATABASE_URL = `file:${TEST_DB_PATH}`;

/**
 * Vitest globalSetup — 전체 테스트 실행 전 한 번, 별도 프로세스에서 실행된다.
 * 테스트 전용 SQLite 파일을 초기화하고 마이그레이션을 적용해둔다.
 * (각 테스트 파일은 tests/setup.ts에서 동일한 DATABASE_URL을 스스로 설정한다 —
 * 이 프로세스의 env는 테스트 워커 프로세스로 전달되지 않으므로 경로 문자열만 공유한다.)
 */
export default function globalSetup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = TEST_DB_PATH + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
  });
}

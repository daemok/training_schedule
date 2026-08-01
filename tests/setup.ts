import path from "node:path";

// 이 파일은 각 테스트 파일이 자신의 모듈(예: @/lib/prisma)을 import하기 전에 실행된다.
// 실제 개발용 dev.db 대신 테스트 전용 SQLite 파일을 쓰도록 강제한다.
process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../prisma/test.db")}`;
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-secret-key-for-vitest-only-not-for-prod";

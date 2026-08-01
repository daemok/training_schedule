import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    // 모든 테스트 파일이 같은 SQLite 파일(prisma/test.db)을 공유하므로,
    // 병렬 실행 시 beforeEach의 deleteMany/create가 서로 경합해 제약조건 위반이 난다.
    fileParallelism: false,
  },
});

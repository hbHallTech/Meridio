/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/playwright/",
  ],
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "!src/lib/prisma.ts",
    "!src/lib/i18n.ts",
  ],
};

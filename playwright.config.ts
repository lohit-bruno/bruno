import { defineConfig, devices } from '@playwright/test';

const reporter: any[] = [['list'], ['html']];

if (process.env.CI) {
  reporter.push(['github']);
}

const testsToIgnore = [
  'ca_certs/**' // CA certificate tests require separate server setup and certificate generation
];

// remove test paths from the ignore list if they are explicitly specified in CLI arguments
// example: when running `npm run test:e2e ca_certs`, remove 'ca_certs/**' from ignore list
const filteredTestsToIgnore = testsToIgnore.filter(testPath => 
  process.argv.some(arg => arg.startsWith(testPath.replace(/\*/g, '')))
);

export default defineConfig({
  testDir: './e2e-tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? undefined : 1,
  reporter,

  use: {
    trace: process.env.CI ? 'on-first-retry' : 'on'
  },

  testIgnore: filteredTestsToIgnore,

  projects: [
    {
      name: 'Bruno Electron App'
    }
  ],

  webServer: [
    {
      command: 'npm run dev:web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'npm start --workspace=packages/bruno-tests',
      url: 'http://localhost:8081/ping',
      reuseExistingServer: !process.env.CI
    }
  ]
});

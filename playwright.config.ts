import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	timeout: 60000,
	use: {
		baseURL: 'http://127.0.0.1:5173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
	],
	webServer: [
		{
			command: 'node --import tsx scripts/test-server.ts',
			url: 'http://127.0.0.1:5173',
			timeout: 120000,
			reuseExistingServer: false
		},
		{
			command: 'E2E_PRODUCTION=true node --import tsx scripts/test-server.ts',
			url: 'http://127.0.0.1:5174',
			timeout: 120000,
			reuseExistingServer: false
		}
	]
});

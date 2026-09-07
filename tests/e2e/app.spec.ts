import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const suffix = () => Math.random().toString(36).slice(2, 8);
test('offline submission preserves the active question and its original deadline', async ({
	page,
	context
}) => {
	await page.goto('/join');
	await expect(page.locator('html[data-hydrated="true"]')).toBeAttached();
	await page.getByLabel('Your public nickname').fill(`Offline ${suffix()}`);
	await page.getByLabel('Six-digit PIN').fill('123456');
	await page.getByRole('button', { name: 'Join the crew' }).click();
	await expect(page).toHaveURL(/\/play\/[a-f0-9-]+$/);
	await expect(page.locator('.question-title')).toBeVisible();
	if ((await page.locator('.question-title').textContent())!.includes('ocean')) {
		await page.getByRole('button', { name: 'Atlantic' }).click();
		await page.getByRole('button', { name: 'Open the next question' }).click();
	}
	await expect(page.locator('.question-title')).toContainText('triangle');
	await expect(page.locator('html[data-hydrated="true"]')).toBeAttached();
	await context.setOffline(true);
	await page.getByRole('button', { name: 'Three' }).click();
	await expect(page.getByRole('alert')).toContainText('Connection interrupted');
	await context.setOffline(false);
	await expect(page.getByRole('timer')).toHaveAttribute('aria-label', '0 seconds remaining', {
		timeout: 10000
	});
	await page.reload();
	await expect(page.locator('.question-title')).toContainText('triangle');
	await expect(page.getByRole('timer')).toHaveAttribute('aria-label', '0 seconds remaining');
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page.getByText('Answer recorded', { exact: true })).toBeVisible();
});
test('player joins, resumes timed questions, sees results and the owner operates contests', async ({
	page,
	browser
}, testInfo) => {
	const nickname = `Sailor ${suffix()}`;
	await page.goto('/');
	await expect(
		page.getByRole('heading', { name: 'A little knowledge. A little friendly rivalry.' })
	).toBeVisible();
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
	await page.goto('/join');
	await page.getByLabel('Your public nickname').fill(nickname);
	await page.getByLabel('Six-digit PIN').fill('123456');
	expect(
		await page.locator('form').evaluate((form) =>
			[...(form as HTMLFormElement).elements]
				.filter((e) => 'checkValidity' in e && !(e as HTMLInputElement).checkValidity())
				.map((e) => ({
					name: (e as HTMLInputElement).name,
					message: (e as HTMLInputElement).validationMessage
				}))
		)
	).toEqual([]);
	await page.getByRole('button', { name: 'Join the crew' }).click();
	await expect(page).toHaveURL(/\/play\/[a-f0-9-]+$/);
	const playPath = new URL(page.url()).pathname;
	await expect(page.locator('.question-title')).toBeVisible();
	const question = await page.locator('.question-title').textContent();
	const timeBefore = Number((await page.getByRole('timer').textContent())!.replace(/\D/g, ''));
	await page.reload();
	await expect(page.locator('.question-title')).toHaveText(question!);
	expect(
		Number((await page.getByRole('timer').textContent())!.replace(/\D/g, ''))
	).toBeLessThanOrEqual(timeBefore);
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath('question.png'), fullPage: true });
	await page
		.getByRole('button', { name: question!.includes('ocean') ? 'Atlantic' : 'Three' })
		.click();
	await expect(page.getByText('Answer recorded', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Open the next question' }).click();
	const q2 = await page.locator('.question-title').textContent();
	await page.getByRole('button', { name: q2!.includes('ocean') ? 'Atlantic' : 'Three' }).click();
	await expect(page.getByRole('heading', { name: 'You’re caught up.' })).toBeVisible();
	await page.goto('/leaderboard');
	await expect(page.getByRole('row').filter({ hasText: nickname })).toContainText('2');
	const adminContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
	const admin = await adminContext.newPage();
	await admin.goto('/admin');
	await expect(admin).toHaveURL(/admin\/login/);
	await admin.getByLabel('Email').fill('owner@example.org');
	await admin.getByLabel('Password', { exact: true }).fill('Captain-test-password-123!');
	await admin.getByRole('button', { name: 'Open the ledger' }).click();
	await expect(admin.getByRole('heading', { name: 'Keep a steady course.' })).toBeVisible();
	await admin.goto(`/admin/contests/${playPath.split('/').pop()}`);
	await admin.getByLabel('Action', { exact: true }).selectOption('close');
	await admin.getByRole('checkbox').check();
	await admin.getByRole('button', { name: 'Apply contest change' }).click();
	await expect(admin.locator('.eyebrow').first()).toContainText('closed');
	await page.goto(`/history/${playPath.split('/').pop()}`);
	await expect(page.getByRole('heading', { name: 'Your answers' })).toBeVisible();
	await expect(page.getByText('Correct answer: Atlantic', { exact: true })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('results.png'), fullPage: true });
	// Reopen for the next viewport run. This is an explicit admin action with warning.
	await admin.getByLabel('New end').fill('2027-09-30T23:59');
	await admin.getByRole('checkbox').check();
	await admin.getByRole('button', { name: 'Apply contest change' }).click();
	await expect(admin.locator('.eyebrow').first()).toContainText('active');
	await adminContext.close();
});
test('direct production player endpoints reject offsite requests while remote admins can sign in', async ({
	page
}) => {
	await page.goto('http://127.0.0.1:5174/');
	await expect(
		page.getByRole('heading', { name: 'Join Captain Jack’s Wi-Fi to play.' })
	).toBeVisible();
	const response = await page.request.post('http://127.0.0.1:5174/join?/enter', {
		form: { nickname: `Offsite ${suffix()}`, pin: '123456', mode: 'register' },
		headers: { origin: 'http://127.0.0.1:5174', 'x-forwarded-for': '127.0.0.1' }
	});
	expect(await response.text()).toContain('Wi-Fi');
	const direct = await page.request.post('http://127.0.0.1:5174/play/fake?/start', {
		form: {},
		headers: { origin: 'http://127.0.0.1:5174' }
	});
	expect(direct.status()).toBe(403);
	await page.goto('http://127.0.0.1:5174/admin/login');
	await page.getByLabel('Email').fill('owner@example.org');
	await page.getByLabel('Password', { exact: true }).fill('Captain-test-password-123!');
	await page.getByRole('button', { name: 'Open the ledger' }).click();
	await expect(page.getByRole('heading', { name: 'Keep a steady course.' })).toBeVisible();
});
test('cross-origin posts and public admin creation are rejected', async ({ request }) => {
	const csrf = await request.post('/join?/enter', {
		form: { nickname: 'Intruder', pin: '123456', mode: 'register' },
		headers: { origin: 'https://evil.example' }
	});
	expect(csrf.status()).toBe(403);
	const unauth = await request.post('/admin/contests/new?/save', {
		form: { title: 'Intruder' },
		headers: { origin: 'http://127.0.0.1:5173', accept: 'text/html' },
		maxRedirects: 0
	});
	expect(unauth.status()).toBe(303);
	const cron = await request.get('/api/cron');
	expect(cron.status()).toBe(401);
});
test('returning joint winner sees the configurable private announcement', async ({
	page
}, testInfo) => {
	await page.goto('/join');
	await expect(page.locator('html[data-hydrated="true"]')).toBeAttached();
	await expect(page.getByRole('combobox')).toHaveCount(0);
	await page.getByRole('button', { name: 'Returning player', exact: true }).click();
	await expect(page.locator('input[name="mode"]')).toHaveValue('login');
	await page.getByLabel('Your public nickname').fill('Anne Read');
	await page.getByLabel('Six-digit PIN').fill('123456');
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).toHaveURL(/\/play\/[a-f0-9-]+$/);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'You’ve won, Anne Read.' })).toBeVisible();
	await page.getByRole('link', { name: 'View your winning screen' }).click();
	await expect(page.getByText('Joint winner', { exact: true })).toBeVisible();
	await expect(
		page.getByText(
			'Well done, Anne Read. You are a winner for 2026-08. Show the owner this screen.'
		)
	).toBeVisible();
	await expect(page.getByRole('row').filter({ hasText: 'Ben Read' })).toContainText('1.500 s');
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath('winner.png'), fullPage: true });
});
test('admin creates, edits, previews and freezes a question through forms', async ({
	page
}, testInfo) => {
	await page.goto('/admin/login');
	await page.getByLabel('Email').fill('owner@example.org');
	await page.getByLabel('Password', { exact: true }).fill('Captain-test-password-123!');
	await page.getByRole('button', { name: 'Open the ledger' }).click();
	await expect(page).toHaveURL(/\/admin$/);
	await page.getByRole('link', { name: 'New contest', exact: true }).click();
	await expect(page).toHaveURL(/\/admin\/contests\/new$/);
	const month = testInfo.project.name === 'desktop' ? '2028-01' : '2028-02';
	await page.getByLabel('Month', { exact: true }).fill(month);
	await page.getByLabel('Title', { exact: true }).fill(`Winter ${month}`);
	await page.getByLabel('Start · Toronto time').fill(`${month}-01T00:00`);
	await page.getByLabel('End · Toronto time').fill(`${month}-28T23:59`);
	await page.getByRole('button', { name: 'Save contest details' }).click();
	await expect(page.getByRole('heading', { name: `Winter ${month}` })).toBeVisible();
	await expect(page.locator('html[data-hydrated="true"]')).toBeAttached();
	const editor = page.locator('.question-editor');
	await editor.getByLabel('Question text').fill('Which direction does the sun rise?');
	await editor.getByLabel('Option 1', { exact: true }).fill('East');
	await editor.getByLabel('Option 2', { exact: true }).fill('West');
	await editor.getByRole('button', { name: 'Save question' }).click();
	await expect(page.getByText('Question saved.', { exact: true })).toBeVisible();
	await page.getByText('Which direction does the sun rise?', { exact: true }).first().click();
	const existing = page.locator('details .question-editor');
	await existing.getByLabel('Question text').fill('In which direction does the sun rise?');
	await existing.getByRole('button', { name: 'Save question' }).click();
	await expect(
		page.getByText('In which direction does the sun rise?', { exact: true }).first()
	).toBeVisible();
	await page.getByLabel('Action', { exact: true }).selectOption('publish');
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Apply contest change' }).click();
	await expect(page.locator('.eyebrow').first()).toContainText('scheduled');
	await page.getByText('In which direction does the sun rise?', { exact: true }).first().click();
	await expect(page.locator('.question-editor textarea')).toBeDisabled();
	expect(
		(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
			.violations
	).toEqual([]);
	await page.screenshot({ path: testInfo.outputPath('admin.png'), fullPage: true });
});

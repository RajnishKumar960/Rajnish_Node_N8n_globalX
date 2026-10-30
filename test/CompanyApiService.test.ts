import { CompanyApiError } from '../src/helpers/errors';
import {
	CompanyApiService,
	type HttpRequester,
	type IFullHttpResponse,
} from '../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../src/types';

const devCreds: ICompanyApiCredentials = {
	baseUrl: 'https://api.test.local',
	environment: 'development',
	authType: 'apiKey',
	apiKey: 'k',
	allowInsecureHttp: false,
};

function scriptedRequester(responses: Array<IFullHttpResponse | Error>): {
	requester: HttpRequester;
	calls: unknown[];
} {
	const calls: unknown[] = [];
	let index = 0;
	const requester: HttpRequester = async (options) => {
		calls.push(options);
		const next = responses[Math.min(index, responses.length - 1)];
		index += 1;
		if (next instanceof Error) throw next;
		return next;
	};
	return { requester, calls };
}

const ok = (body: unknown, statusCode = 200): IFullHttpResponse => ({
	body,
	statusCode,
	headers: {},
});

function makeService(
	requester: HttpRequester,
	overrides: Partial<ICompanyApiCredentials> = {},
): { service: CompanyApiService; sleeps: number[] } {
	const sleeps: number[] = [];
	const service = new CompanyApiService({
		credentials: { ...devCreds, ...overrides },
		requester,
		retry: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50 },
		sleepFn: async (ms) => {
			sleeps.push(ms);
		},
	});
	return { service, sleeps };
}

describe('CompanyApiService — success & normalization', () => {
	it('returns normalized data for a 200 with an envelope', async () => {
		const { requester } = scriptedRequester([ok({ data: { id: 'c1', email: 'a@b.com' } })]);
		const { service } = makeService(requester);
		const result = await service.request({ method: 'GET', path: '/customers/c1' });
		expect(result.statusCode).toBe(200);
		expect(result.data).toEqual({ id: 'c1', email: 'a@b.com' });
	});

	it('passes an Idempotency-Key header when provided', async () => {
		const { requester, calls } = scriptedRequester([ok({ data: { id: 'c1' } }, 201)]);
		const { service } = makeService(requester);
		await service.request({
			method: 'POST',
			path: '/customers',
			body: { email: 'a@b.com' },
			idempotencyKey: 'abc123',
		});
		expect((calls[0] as { headers: Record<string, string> }).headers['Idempotency-Key']).toBe(
			'abc123',
		);
	});
});

describe('CompanyApiService — error handling', () => {
	it.each([
		[400, 'validation'],
		[401, 'authentication'],
		[403, 'authorization'],
		[404, 'notFound'],
	])('maps HTTP %i without retrying', async (status, category) => {
		const { requester, calls } = scriptedRequester([ok({ error: { message: 'x' } }, status)]);
		const { service } = makeService(requester);
		await expect(service.request({ method: 'GET', path: '/customers/x' })).rejects.toMatchObject({
			category,
			statusCode: status,
		});
		expect(calls).toHaveLength(1);
	});

	it('never leaks secrets present in an error body', async () => {
		const { requester } = scriptedRequester([
			ok({ message: 'failed', token: 'supersecret', apiKey: 'leak' }, 400),
		]);
		const { service } = makeService(requester);
		const error = (await service
			.request({ method: 'GET', path: '/x' })
			.catch((e) => e)) as CompanyApiError;
		const serialized = JSON.stringify(error.details ?? {});
		expect(serialized).not.toContain('supersecret');
		expect(serialized).not.toContain('leak');
	});
});

describe('CompanyApiService — retries & backoff', () => {
	it('retries 429 respecting Retry-After, then succeeds', async () => {
		const rateLimited: IFullHttpResponse = {
			statusCode: 429,
			headers: { 'retry-after': '1' },
			body: { error: 'slow down' },
		};
		const { requester, calls } = scriptedRequester([rateLimited, ok({ data: { ok: true } })]);
		const { service, sleeps } = makeService(requester);
		const result = await service.request({ method: 'GET', path: '/customers' });
		expect(result.data).toEqual({ ok: true });
		expect(calls).toHaveLength(2);
		expect(sleeps[0]).toBe(1000);
	});

	it('retries 500 on GET up to maxAttempts then throws', async () => {
		const serverError = ok({ error: 'boom' }, 500);
		const { requester, calls } = scriptedRequester([serverError, serverError, serverError]);
		const { service } = makeService(requester);
		await expect(service.request({ method: 'GET', path: '/customers' })).rejects.toMatchObject({
			category: 'server',
		});
		expect(calls).toHaveLength(3);
	});

	it('does NOT retry a 500 on POST without an idempotency key', async () => {
		const { requester, calls } = scriptedRequester([ok({ error: 'boom' }, 500)]);
		const { service } = makeService(requester);
		await expect(
			service.request({ method: 'POST', path: '/customers', body: { email: 'a@b.com' } }),
		).rejects.toMatchObject({ category: 'server' });
		expect(calls).toHaveLength(1);
	});

	it('retries a transport timeout then succeeds', async () => {
		const timeout = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
		const { requester, calls } = scriptedRequester([timeout, ok({ data: { ok: true } })]);
		const { service } = makeService(requester);
		const result = await service.request({ method: 'GET', path: '/customers' });
		expect(result.data).toEqual({ ok: true });
		expect(calls).toHaveLength(2);
	});
});

describe('CompanyApiService — pagination', () => {
	it('collects all pages using offset until a short page', async () => {
		const page = (ids: string[], total: number): IFullHttpResponse =>
			ok({ data: ids.map((id) => ({ id })), pagination: { total } });
		const { requester } = scriptedRequester([
			page(['a', 'b'], 5),
			page(['c', 'd'], 5),
			page(['e'], 5), // short page -> stop
		]);
		const { service } = makeService(requester);
		const all = await service.requestAllItems(
			{ method: 'GET', path: '/customers' },
			{ returnAll: true, pageSize: 2 },
		);
		expect(all.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('follows nextCursor when present', async () => {
		const withCursor = (ids: string[], cursor?: string): IFullHttpResponse =>
			ok({ data: ids.map((id) => ({ id })), pagination: { nextCursor: cursor } });
		const { requester } = scriptedRequester([
			withCursor(['a', 'b'], 'CUR2'),
			withCursor(['c', 'd'], undefined), // no further cursor -> stop
		]);
		const { service } = makeService(requester);
		const all = await service.requestAllItems(
			{ method: 'GET', path: '/customers' },
			{ returnAll: true, pageSize: 2 },
		);
		expect(all.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('CompanyApiService — credential safety', () => {
	it('refuses a non-HTTPS base URL in production', () => {
		expect(
			() =>
				new CompanyApiService({
					credentials: { ...devCreds, environment: 'production', baseUrl: 'http://x.local' },
					requester: scriptedRequester([ok({})]).requester,
				}),
		).toThrow(/non-HTTPS/);
	});
});

import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { createApp } from '../mock-server/server';
import { CompanyApiService } from '../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../src/types';

import { makeFetchRequester } from './support/fetchRequester';

describe('integration: CompanyApiService ↔ mock server', () => {
	let server: Server;
	let baseUrl: string;

	const creds = (overrides: Partial<ICompanyApiCredentials> = {}): ICompanyApiCredentials => ({
		baseUrl,
		environment: 'development',
		authType: 'apiKey',
		apiKey: 'dev-key-local',
		allowInsecureHttp: true,
		...overrides,
	});

	const makeService = (authHeader: Record<string, string>, c = creds()) =>
		new CompanyApiService({
			credentials: c,
			requester: makeFetchRequester(authHeader),
			retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 },
			sleepFn: async () => undefined,
		});

	beforeAll((done) => {
		server = createApp().listen(0, () => {
			const { port } = server.address() as AddressInfo;
			baseUrl = `http://127.0.0.1:${port}`;
			done();
		});
	});

	afterAll((done) => {
		server.close(() => done());
	});

	const auth = { 'X-API-Key': 'dev-key-local' };

	it('rejects requests without valid credentials (401)', async () => {
		const service = makeService({ 'X-API-Key': 'wrong' });
		await expect(service.request({ method: 'GET', path: '/customers' })).rejects.toMatchObject({
			statusCode: 401,
			category: 'authentication',
		});
	});

	it('creates, gets, updates and deletes a customer', async () => {
		const service = makeService(auth);

		const created = await service.request({
			method: 'POST',
			path: '/customers',
			body: { email: 'jane@example.com', firstName: 'Jane' },
		});
		const id = (created.data as { id: string }).id;
		expect(id).toBeDefined();

		const fetched = await service.request({ method: 'GET', path: `/customers/${id}` });
		expect(fetched.data).toMatchObject({ email: 'jane@example.com' });

		const updated = await service.request({
			method: 'PATCH',
			path: `/customers/${id}`,
			body: { firstName: 'Janet' },
		});
		expect(updated.data).toMatchObject({ firstName: 'Janet' });

		const deleted = await service.request({ method: 'DELETE', path: `/customers/${id}` });
		expect(deleted.data).toMatchObject({ deleted: true });

		await expect(
			service.request({ method: 'GET', path: `/customers/${id}` }),
		).rejects.toMatchObject({ statusCode: 404 });
	});

	it('de-duplicates creates that share an Idempotency-Key', async () => {
		const service = makeService(auth);
		const key = 'dup-key-1';
		const first = await service.request({
			method: 'POST',
			path: '/leads',
			body: { email: 'x@y.com' },
			idempotencyKey: key,
		});
		const second = await service.request({
			method: 'POST',
			path: '/leads',
			body: { email: 'x@y.com' },
			idempotencyKey: key,
		});
		expect((first.data as { id: string }).id).toBe((second.data as { id: string }).id);
	});

	it('paginates through all results with returnAll', async () => {
		const service = makeService(auth);
		for (let n = 0; n < 7; n++) {
			await service.request({ method: 'POST', path: '/employees', body: { n } });
		}
		const all = await service.requestAllItems(
			{ method: 'GET', path: '/employees' },
			{ returnAll: true, pageSize: 3 },
		);
		expect(all.length).toBeGreaterThanOrEqual(7);
	});

	it('surfaces a forced 500 from the backend', async () => {
		const service = makeService({ ...auth, 'X-Force-Status': '500' });
		await expect(service.request({ method: 'GET', path: '/customers' })).rejects.toMatchObject({
			statusCode: 500,
			category: 'server',
		});
	});
});

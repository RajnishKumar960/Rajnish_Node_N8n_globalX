import type { INodeExecutionData } from 'n8n-workflow';

import { CompanyCitizen } from '../nodes/CompanyCitizen/CompanyCitizen.node';
import type { HttpRequester, IFullHttpResponse } from '../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../src/types';

import { createMockExecuteFunctions } from './support/mockExecuteFunctions';

const creds: ICompanyApiCredentials = {
	baseUrl: 'https://api.test.local',
	environment: 'development',
	authType: 'apiKey',
	apiKey: 'super-secret-key',
	bearerToken: 'super-secret-token',
	allowInsecureHttp: false,
};

const ok = (body: unknown, statusCode = 200): IFullHttpResponse => ({
	body,
	statusCode,
	headers: {},
});

async function run(
	params: Array<Record<string, unknown>>,
	requester: HttpRequester,
	continueOnFail = false,
): Promise<{ out: INodeExecutionData[]; requestSpy: jest.Mock }> {
	const { ctx, requestSpy } = createMockExecuteFunctions({
		params,
		credentials: creds,
		requester,
		continueOnFail,
	});
	const node = new CompanyCitizen();
	const result = await (node.execute as (this: typeof ctx) => Promise<INodeExecutionData[][]>).call(
		ctx,
	);
	return { out: result[0], requestSpy };
}

describe('CompanyCitizen node — core operations', () => {
	it('gets a customer and returns the record with correct item pairing', async () => {
		const requester: HttpRequester = async () => ok({ data: { id: 'c1', email: 'a@b.com' } });
		const { out } = await run(
			[{ resource: 'customer', operation: 'get', recordId: 'c1' }],
			requester,
		);
		expect(out).toHaveLength(1);
		expect(out[0].json).toEqual({ id: 'c1', email: 'a@b.com' });
		expect(out[0].pairedItem).toEqual({ item: 0 });
	});

	it('creates a customer, merging named + additional fields and sending an idempotency key', async () => {
		const seen: { headers?: Record<string, string>; body?: unknown } = {};
		const requester: HttpRequester = async (options) => {
			seen.headers = options.headers as Record<string, string>;
			seen.body = options.body;
			return ok({ data: { id: 'c2', ...(options.body as object) } }, 201);
		};
		const { out } = await run(
			[
				{
					resource: 'customer',
					operation: 'create',
					email: 'jane@example.com',
					additionalFields: { firstName: 'Jane', status: 'active' },
				},
			],
			requester,
		);
		expect(seen.body).toEqual({ email: 'jane@example.com', firstName: 'Jane', status: 'active' });
		expect(seen.headers?.['Idempotency-Key']).toBeDefined();
		expect(out[0].json).toMatchObject({ id: 'c2', email: 'jane@example.com' });
	});

	it('never exposes credentials in the node output', async () => {
		const requester: HttpRequester = async () => ok({ data: { id: 'c1' } });
		const { out } = await run(
			[{ resource: 'customer', operation: 'get', recordId: 'c1' }],
			requester,
		);
		const serialized = JSON.stringify(out);
		expect(serialized).not.toContain('super-secret-key');
		expect(serialized).not.toContain('super-secret-token');
	});
});

describe('CompanyCitizen node — destructive safeguards', () => {
	it('blocks delete when the confirmation toggle is off', async () => {
		const requester: HttpRequester = async () => ok({ data: {} });
		await expect(
			run(
				[{ resource: 'customer', operation: 'delete', recordId: 'c1', confirmDestructive: false }],
				requester,
			),
		).rejects.toThrow(/destructive and is blocked/);
	});

	it('performs delete when confirmed and returns a success envelope', async () => {
		const requester: HttpRequester = async () => ok({ data: { id: 'c1', deleted: true } });
		const { out } = await run(
			[{ resource: 'customer', operation: 'delete', recordId: 'c1', confirmDestructive: true }],
			requester,
		);
		expect(out[0].json).toMatchObject({ success: true, recordId: 'c1', operation: 'delete' });
	});

	it('does not even call the API when a destructive op is unconfirmed', async () => {
		const requester = jest.fn(async () => ok({ data: {} }));
		const { requestSpy } = await run(
			[{ resource: 'appointment', operation: 'cancel', recordId: 'a1', confirmDestructive: true }],
			requester as unknown as HttpRequester,
		);

		expect(requestSpy).toHaveBeenCalledTimes(1);
	});
});

describe('CompanyCitizen node — multiple items & errors', () => {
	it('processes multiple input items and preserves pairing', async () => {
		const requester: HttpRequester = async (options) => ok({ data: { path: options.url } });
		const { out } = await run(
			[
				{ resource: 'customer', operation: 'get', recordId: 'c1' },
				{ resource: 'lead', operation: 'get', recordId: 'l9' },
			],
			requester,
		);
		expect(out).toHaveLength(2);
		expect(out[0].pairedItem).toEqual({ item: 0 });
		expect(out[1].pairedItem).toEqual({ item: 1 });
	});

	it('continueOnFail captures a 404 as a structured error item', async () => {
		const requester: HttpRequester = async () => ok({ error: { message: 'missing' } }, 404);
		const { out } = await run(
			[{ resource: 'customer', operation: 'get', recordId: 'ghost' }],
			requester,
			true,
		);
		expect(out[0].json).toMatchObject({ category: 'notFound', statusCode: 404 });
	});

	it('throws on a 401 when continueOnFail is off', async () => {
		const requester: HttpRequester = async () => ok({ error: 'nope' }, 401);
		await expect(
			run([{ resource: 'customer', operation: 'get', recordId: 'c1' }], requester),
		).rejects.toThrow();
	});
});

describe('CompanyCitizen node — search & pagination', () => {
	it('returns up to the limit for a non-returnAll search', async () => {
		const requester: HttpRequester = async () =>
			ok({ data: [{ id: '1' }, { id: '2' }, { id: '3' }], pagination: { total: 3 } });
		const { out } = await run(
			[{ resource: 'customer', operation: 'search', searchQuery: 'a', returnAll: false, limit: 2 }],
			requester,
		);
		expect(out).toHaveLength(2);
	});
});

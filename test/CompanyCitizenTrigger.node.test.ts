import type { INodeExecutionData } from 'n8n-workflow';

import { CompanyCitizenTrigger } from '../nodes/CompanyCitizenTrigger/CompanyCitizenTrigger.node';
import type { HttpRequester, IFullHttpResponse } from '../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../src/types';

import {
	createMockLoadOptionsFunctions,
	createMockPollFunctions,
} from './support/mockPollFunctions';

const creds: ICompanyApiCredentials = {
	baseUrl: 'https://api.test.local',
	environment: 'development',
	authType: 'apiKey',
	apiKey: 'k',
	allowInsecureHttp: false,
};

const list = (items: unknown[]): IFullHttpResponse => ({
	statusCode: 200,
	headers: {},
	body: { data: items, pagination: { total: items.length } },
});

async function poll(
	params: Record<string, unknown>,
	requester: HttpRequester,
	mode: 'manual' | 'trigger',
	staticData: Record<string, unknown>,
): Promise<INodeExecutionData[][] | null> {
	const { ctx } = createMockPollFunctions({
		params,
		credentials: creds,
		requester,
		mode,
		staticData,
	});
	const node = new CompanyCitizenTrigger();
	return (node.poll as (this: typeof ctx) => Promise<INodeExecutionData[][] | null>).call(ctx);
}

describe('CompanyCitizenTrigger — polling & dedup', () => {
	const base = { resource: 'lead', event: 'created', ownerId: '', maxItems: 100 };

	it('first scheduled poll sets the watermark and emits nothing (no history flood)', async () => {
		const requester: HttpRequester = async () =>
			list([{ id: 'l1', createdAt: '2026-01-01T00:00:00.000Z' }]);
		const staticData: Record<string, unknown> = {};
		const result = await poll(base, requester, 'trigger', staticData);
		expect(result).toBeNull();
		expect(typeof staticData.lastTimeChecked).toBe('string');
	});

	it('emits only records newer than the watermark on the next poll', async () => {
		const staticData: Record<string, unknown> = { lastTimeChecked: '2026-05-01T00:00:00.000Z' };
		const requester: HttpRequester = async () =>
			list([
				{ id: 'old', createdAt: '2026-04-01T00:00:00.000Z' },
				{ id: 'new1', createdAt: '2026-06-01T00:00:00.000Z' },
				{ id: 'new2', createdAt: '2026-07-01T00:00:00.000Z' },
			]);
		const result = await poll(base, requester, 'trigger', staticData);
		expect(result).not.toBeNull();
		const ids = result![0].map((i) => (i.json as { id: string }).id);
		expect(ids).toEqual(['new1', 'new2']);
	});

	it('returns null when there is nothing new', async () => {
		const staticData: Record<string, unknown> = { lastTimeChecked: '2030-01-01T00:00:00.000Z' };
		const requester: HttpRequester = async () =>
			list([{ id: 'l1', createdAt: '2026-01-01T00:00:00.000Z' }]);
		const result = await poll(base, requester, 'trigger', staticData);
		expect(result).toBeNull();
	});

	it('manual mode returns the most recent record for a test run', async () => {
		const requester: HttpRequester = async () =>
			list([
				{ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
				{ id: 'c', createdAt: '2026-03-01T00:00:00.000Z' },
				{ id: 'b', createdAt: '2026-02-01T00:00:00.000Z' },
			]);
		const result = await poll(base, requester, 'manual', {});
		expect(result).not.toBeNull();
		expect(result![0]).toHaveLength(1);
		expect((result![0][0].json as { id: string }).id).toBe('c');
	});

	it('uses updatedAt when the event is "Created or Updated"', async () => {
		const staticData: Record<string, unknown> = { lastTimeChecked: '2026-05-01T00:00:00.000Z' };
		const requester: HttpRequester = async () =>
			list([
				{ id: 'x', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
			]);
		const result = await poll({ ...base, event: 'updated' }, requester, 'trigger', staticData);
		expect(result).not.toBeNull();
		expect((result![0][0].json as { id: string }).id).toBe('x');
	});

	it('passes the owner filter into the API query', async () => {
		const staticData: Record<string, unknown> = { lastTimeChecked: '2026-05-01T00:00:00.000Z' };
		let seenQuery: Record<string, unknown> | undefined;
		const requester: HttpRequester = async (options) => {
			seenQuery = options.qs as Record<string, unknown>;
			return list([]);
		};
		await poll({ ...base, ownerId: 'emp_9' }, requester, 'trigger', staticData);
		expect(seenQuery?.ownerId).toBe('emp_9');
	});
});

describe('CompanyCitizenTrigger — loadOptions dropdown', () => {
	it('loads employees from the API as dropdown options', async () => {
		const requester: HttpRequester = async () =>
			list([
				{ id: 'emp_1', firstName: 'Ada', lastName: 'Lovelace' },
				{ id: 'emp_2', firstName: 'Alan', lastName: 'Turing' },
			]);
		const ctx = createMockLoadOptionsFunctions({ credentials: creds, requester });
		const node = new CompanyCitizenTrigger();
		const options = await node.methods!.loadOptions!.getEmployees.call(ctx);
		expect(options[0]).toEqual({ name: '— Any Owner —', value: '' });
		expect(options).toContainEqual({ name: 'Ada Lovelace (emp_1)', value: 'emp_1' });
		expect(options).toContainEqual({ name: 'Alan Turing (emp_2)', value: 'emp_2' });
	});
});

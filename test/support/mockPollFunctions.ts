import type { ILoadOptionsFunctions, INodeExecutionData, IPollFunctions } from 'n8n-workflow';

import type { HttpRequester } from '../../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../../src/types';

export interface MockPollOptions {
	params: Record<string, unknown>;
	credentials: ICompanyApiCredentials;
	requester: HttpRequester;
	mode?: 'manual' | 'trigger';

	staticData?: Record<string, unknown>;
}

export function createMockPollFunctions(options: MockPollOptions): {
	ctx: IPollFunctions;
	staticData: Record<string, unknown>;
} {
	const staticData = options.staticData ?? {};
	const requestSpy = async (_credType: string, requestOptions: unknown) =>
		options.requester(requestOptions as never);

	const ctx = {
		getNodeParameter: (name: string, fallback?: unknown) => {
			const value = options.params[name];
			return value === undefined ? fallback : value;
		},
		getCredentials: async () => options.credentials as unknown as Record<string, unknown>,
		getWorkflowStaticData: () => staticData,
		getMode: () => options.mode ?? 'trigger',
		getNode: () => ({
			id: 'trigger-node',
			name: 'Company Citizen Trigger',
			type: 'n8n-nodes-base.companyCitizenTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: {
			httpRequestWithAuthentication: requestSpy,
			returnJsonArray: (data: unknown): INodeExecutionData[] =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json: json as never })),
		},
	} as unknown as IPollFunctions;

	return { ctx, staticData };
}

export function createMockLoadOptionsFunctions(options: {
	credentials: ICompanyApiCredentials;
	requester: HttpRequester;
}): ILoadOptionsFunctions {
	const requestSpy = async (_credType: string, requestOptions: unknown) =>
		options.requester(requestOptions as never);
	return {
		getCredentials: async () => options.credentials as unknown as Record<string, unknown>,
		getNode: () => ({ name: 'Company Citizen Trigger' }),
		helpers: { httpRequestWithAuthentication: requestSpy },
	} as unknown as ILoadOptionsFunctions;
}

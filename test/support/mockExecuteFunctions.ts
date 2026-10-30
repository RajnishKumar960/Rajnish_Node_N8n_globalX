import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { HttpRequester } from '../../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../../src/types';

export interface MockExecuteOptions {
	params: Array<Record<string, unknown>>;
	credentials: ICompanyApiCredentials;

	requester: HttpRequester;
	continueOnFail?: boolean;

	items?: INodeExecutionData[];
}

export function createMockExecuteFunctions(options: MockExecuteOptions): {
	ctx: IExecuteFunctions;
	requestSpy: jest.Mock;
} {
	const items: INodeExecutionData[] =
		options.items ?? options.params.map(() => ({ json: {} }) as INodeExecutionData);

	const requestSpy = jest.fn(async (_credType: string, requestOptions: unknown) =>
		options.requester(requestOptions as never),
	);

	const ctx = {
		getInputData: () => items,
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			const value = options.params[itemIndex]?.[name];
			return value === undefined ? fallback : value;
		},
		getCredentials: async () => options.credentials as unknown as Record<string, unknown>,
		continueOnFail: () => options.continueOnFail ?? false,
		getNode: () => ({
			id: 'test-node',
			name: 'Company Citizen',
			type: 'n8n-nodes-base.companyCitizen',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: {
			httpRequestWithAuthentication: requestSpy,
		},
	} as unknown as IExecuteFunctions;

	return { ctx, requestSpy };
}

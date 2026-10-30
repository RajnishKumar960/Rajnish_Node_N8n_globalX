import { createHash } from 'crypto';

import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

import { buildQuery, mergeBody } from '../../src/adapters/buildRequest';
import { getOperation, resolvePath } from '../../src/adapters/operations';
import { CompanyApiError } from '../../src/helpers/errors';
import { clampLimit } from '../../src/helpers/validation';
import {
	CompanyApiService,
	type HttpRequester,
	type IFullHttpResponse,
} from '../../src/services/CompanyApiService';
import type { ICompanyApiCredentials, ICompanyApiRequestOptions } from '../../src/types';

import { appointmentDescription } from './descriptions/AppointmentDescription';
import { customerDescription } from './descriptions/CustomerDescription';
import { documentDescription } from './descriptions/DocumentDescription';
import { employeeDescription } from './descriptions/EmployeeDescription';
import { leadDescription } from './descriptions/LeadDescription';
import { notificationDescription } from './descriptions/NotificationDescription';
import { resourceProperty } from './descriptions/shared';

export class CompanyCitizen implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Company Citizen',
		name: 'companyCitizen',
		icon: 'file:companyCitizen.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Automate the company internal systems (CRM, scheduling, documents, notifications) without code.',
		defaults: { name: 'Company Citizen' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'companyApi', required: true }],
		properties: [
			resourceProperty,
			...customerDescription,
			...employeeDescription,
			...leadDescription,
			...appointmentDescription,
			...documentDescription,
			...notificationDescription,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = (await this.getCredentials(
			'companyApi',
		)) as unknown as ICompanyApiCredentials;

		const requester: HttpRequester = async (options) => {
			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				'companyApi',
				options,
			);
			return response as unknown as IFullHttpResponse;
		};

		let service: CompanyApiService;
		try {
			service = new CompanyApiService({ credentials, requester });
		} catch (error) {
			throw toNodeError(this, error, 0);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const def = getOperation(resource, operation);

				if (def.paginated) {
					const searchQuery = this.getNodeParameter('searchQuery', i, '') as string;
					const filtersJson = this.getNodeParameter('filtersJson', i, '{}');
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const baseQuery = buildQuery(searchQuery, filtersJson);

					if (returnAll) {
						const pageSize = clampLimit(
							this.getNodeParameter('pageSize', i, 100) as number,
							1,
							500,
							100,
						);
						const all = await service.requestAllItems(
							{ method: def.method, path: def.path, query: baseQuery },
							{ returnAll: true, pageSize },
						);
						for (const record of all) {
							returnData.push({ json: record, pairedItem: { item: i } });
						}
					} else {
						const limit = clampLimit(this.getNodeParameter('limit', i, 50) as number, 1, 1000, 50);
						const response = await service.request({
							method: def.method,
							path: def.path,
							query: { ...baseQuery, limit },
						});
						for (const record of toItemArray(response.data).slice(0, limit)) {
							returnData.push({ json: record, pairedItem: { item: i } });
						}
					}
					continue;
				}

				const requestOptions = prepareSingleRequest(this, resource, operation, def, i);
				const response = await service.request(requestOptions);

				const recordId = def.path.includes('{id}')
					? String(this.getNodeParameter('recordId', i))
					: undefined;
				const outputRecords = shapeSingleResponse(resource, operation, def.destructive === true, {
					data: response.data,
					recordId,
				});
				for (const record of outputRecords) {
					returnData.push({ json: record, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: errorToJson(error),
						pairedItem: { item: i },
					});
					continue;
				}
				throw toNodeError(this, error, i);
			}
		}

		return [returnData];
	}
}

function prepareSingleRequest(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	def: ReturnType<typeof getOperation>,
	i: number,
): ICompanyApiRequestOptions {
	if (def.destructive) {
		const confirmed = ctx.getNodeParameter('confirmDestructive', i, false) as boolean;
		if (!confirmed) {
			throw new NodeOperationError(
				ctx.getNode(),
				`This "${operation}" on ${resource} is destructive and is blocked by a safeguard.`,
				{
					itemIndex: i,
					description:
						'Enable the "I Understand…" confirmation toggle on the node to allow this operation to run.',
				},
			);
		}
	}

	const pathParams: Record<string, string> = {};
	if (def.path.includes('{id}')) {
		pathParams.id = String(ctx.getNodeParameter('recordId', i));
	}
	const path = resolvePath(def.path, pathParams);

	let body: IDataObject | undefined;
	if (def.method !== 'GET' && def.method !== 'DELETE') {
		body = buildBodyForOperation(ctx, resource, operation, i);
	}

	const requestOptions: ICompanyApiRequestOptions = { method: def.method, path, body };

	if (def.idempotent && body) {
		requestOptions.idempotencyKey = buildIdempotencyKey(resource, operation, body);
	}
	return requestOptions;
}

function buildBodyForOperation(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): IDataObject {
	const raw = ctx.getNodeParameter('rawBodyJson', i, '');

	const collectionParam =
		operation === 'update'
			? (ctx.getNodeParameter('updateFields', i, {}) as IDataObject)
			: pickCollection(ctx, resource, operation, i);

	const base = buildBaseFields(ctx, resource, operation, i);
	return mergeBody(base, collectionParam, raw);
}

function buildBaseFields(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): IDataObject {
	const get = (name: string): string => ctx.getNodeParameter(name, i, '') as string;

	if (resource === 'notification' && operation === 'sendEmail') {
		return {
			to: get('to'),
			subject: get('subject'),
			body: get('body'),
		};
	}
	if (resource === 'notification' && operation === 'sendNotification') {
		return {
			recipientId: get('recipientId'),
			message: get('message'),
		};
	}
	if (resource === 'document' && operation === 'upload') {
		return {
			name: get('name'),
			storageRef: get('storageRef'),
		};
	}
	if (resource === 'appointment' && operation === 'create') {
		return {
			title: get('title'),
			startTime: get('startTime'),
		};
	}
	if (resource === 'appointment' && operation === 'cancel') {
		return { reason: get('cancellationReason') };
	}
	if (
		(resource === 'customer' || resource === 'lead' || resource === 'employee') &&
		operation === 'create'
	) {
		return { email: get('email') };
	}
	return {};
}

function pickCollection(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): IDataObject {
	if (resource === 'notification' && operation === 'sendNotification') {
		return ctx.getNodeParameter('notificationOptions', i, {}) as IDataObject;
	}
	return ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
}

function buildIdempotencyKey(resource: string, operation: string, body: IDataObject): string {
	const hash = createHash('sha256')
		.update(`${resource}:${operation}:${stableStringify(body)}`)
		.digest('hex');
	return `${resource}-${operation}-${hash.slice(0, 32)}`;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	);
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function toItemArray(data: IDataObject | IDataObject[]): IDataObject[] {
	if (Array.isArray(data)) return data;
	for (const key of ['items', 'results', 'records']) {
		const maybe = (data as IDataObject)[key];
		if (Array.isArray(maybe)) return maybe as IDataObject[];
	}
	return [data];
}

function shapeSingleResponse(
	resource: string,
	operation: string,
	destructive: boolean,
	input: { data: IDataObject | IDataObject[]; recordId?: string },
): IDataObject[] {
	const { data, recordId } = input;

	if (destructive) {
		const confirmation: IDataObject = {
			success: true,
			resource,
			operation,
			recordId: recordId ?? null,
		};
		if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
			confirmation.result = data;
		}
		return [confirmation];
	}

	if (Array.isArray(data)) return data.length > 0 ? data : [{ success: true }];
	return [data];
}

function errorToJson(error: unknown): IDataObject {
	if (error instanceof CompanyApiError) {
		return {
			error: error.message,
			category: error.category,
			statusCode: error.statusCode ?? null,
		};
	}
	return { error: (error as Error)?.message ?? 'Unknown error' };
}

function toNodeError(ctx: IExecuteFunctions, error: unknown, itemIndex: number): Error {
	if (error instanceof CompanyApiError) {
		if (error.statusCode) {
			return new NodeApiError(ctx.getNode(), { message: error.message } as unknown as JsonObject, {
				httpCode: String(error.statusCode),
				message: error.message,
				description: `Category: ${error.category}`,
				itemIndex,
			});
		}
		return new NodeOperationError(ctx.getNode(), error.message, {
			itemIndex,
			description: `Category: ${error.category}`,
		});
	}
	if (error instanceof NodeOperationError || error instanceof NodeApiError) {
		return error;
	}
	return new NodeOperationError(ctx.getNode(), (error as Error)?.message ?? 'Unknown error', {
		itemIndex,
	});
}

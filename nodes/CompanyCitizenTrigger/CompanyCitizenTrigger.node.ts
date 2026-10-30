import {
	NodeOperationError,
	type IDataObject,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { getOperation } from '../../src/adapters/operations';
import {
	CompanyApiService,
	type HttpRequester,
	type IFullHttpResponse,
} from '../../src/services/CompanyApiService';
import type { ICompanyApiCredentials } from '../../src/types';

export class CompanyCitizenTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Company Citizen Trigger',
		name: 'companyCitizenTrigger',
		icon: 'file:companyCitizenTrigger.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{ "On " + $parameter["event"] + " " + $parameter["resource"] }}',
		description: 'Starts the workflow when records are created or updated in a company system',
		defaults: { name: 'Company Citizen Trigger' },
		polling: true,
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'companyApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Appointment', value: 'appointment' },
					{ name: 'Customer', value: 'customer' },
					{ name: 'Lead', value: 'lead' },
				],
				default: 'lead',
				description: 'Which records to watch',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Created', value: 'created', description: 'Emit each newly created record' },
					{
						name: 'Created or Updated',
						value: 'updated',
						description: 'Emit records that were created or changed since the last poll',
					},
				],
				default: 'created',
			},
			{
				displayName: 'Filter by Owner (Employee) Name or ID',
				name: 'ownerId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getEmployees' },
				default: '',
				description:
					'Optional. Only watch records assigned to this employee, loaded live from the company API. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Max Records per Poll',
				name: 'maxItems',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 100,
				description: 'Safety cap on how many new records a single poll may emit',
			},
		],
	};

	methods = {
		loadOptions: {
			async getEmployees(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const service = createService(
					(await this.getCredentials('companyApi')) as unknown as ICompanyApiCredentials,
					async (options) =>
						(await this.helpers.httpRequestWithAuthentication.call(
							this,
							'companyApi',
							options,
						)) as unknown as IFullHttpResponse,
				);

				const employees = await service.requestAllItems(
					{ method: 'GET', path: '/employees' },
					{ returnAll: true, pageSize: 100, maxItems: 200 },
				);

				const options: INodePropertyOptions[] = employees.map((employee) => {
					const name =
						`${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() ||
						String(employee.email ?? employee.id);
					return { name: `${name} (${String(employee.id)})`, value: String(employee.id) };
				});

				return [{ name: '— Any Owner —', value: '' }, ...options];
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const resource = this.getNodeParameter('resource') as string;
		const event = this.getNodeParameter('event') as string;
		const ownerId = this.getNodeParameter('ownerId', '') as string;
		const maxItems = this.getNodeParameter('maxItems', 100) as number;

		const dateField = event === 'updated' ? 'updatedAt' : 'createdAt';
		const staticData = this.getWorkflowStaticData('node');
		const lastChecked = staticData.lastTimeChecked as string | undefined;
		const now = new Date().toISOString();
		const isManual = this.getMode() === 'manual';

		const listOperation = resource === 'appointment' ? 'list' : 'search';
		const def = getOperation(resource, listOperation);

		const service = createService(
			(await this.getCredentials('companyApi')) as unknown as ICompanyApiCredentials,
			async (options) =>
				(await this.helpers.httpRequestWithAuthentication.call(
					this,
					'companyApi',
					options,
				)) as unknown as IFullHttpResponse,
		);

		const query: IDataObject = {};
		if (ownerId) query.ownerId = ownerId;

		let records: IDataObject[];
		try {
			records = await service.requestAllItems(
				{ method: def.method, path: def.path, query },
				{ returnAll: true, pageSize: 100, maxItems: Math.max(maxItems, 1) },
			);
		} catch (error) {
			throw new NodeOperationError(this.getNode(), (error as Error).message, {
				description: 'Company Citizen Trigger failed while polling the company API.',
			});
		}

		if (isManual) {
			const sample = [...records].sort((a, b) => compareByDate(a, b, dateField)).slice(-1);
			if (!staticData.lastTimeChecked) staticData.lastTimeChecked = now;
			return sample.length ? [this.helpers.returnJsonArray(sample)] : null;
		}

		if (!lastChecked) {
			staticData.lastTimeChecked = now;
			return null;
		}

		const fresh = records
			.filter((record) => {
				const value = record[dateField];
				return typeof value === 'string' && value > lastChecked;
			})
			.sort((a, b) => compareByDate(a, b, dateField))
			.slice(0, Math.max(maxItems, 1));

		staticData.lastTimeChecked = now;

		return fresh.length ? [this.helpers.returnJsonArray(fresh)] : null;
	}
}

function createService(
	credentials: ICompanyApiCredentials,
	requester: HttpRequester,
): CompanyApiService {
	return new CompanyApiService({ credentials, requester });
}

function compareByDate(a: IDataObject, b: IDataObject, field: string): number {
	const av = typeof a[field] === 'string' ? (a[field] as string) : '';
	const bv = typeof b[field] === 'string' ? (b[field] as string) : '';
	return av < bv ? -1 : av > bv ? 1 : 0;
}

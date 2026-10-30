import type { INodeProperties } from 'n8n-workflow';

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Appointment', value: 'appointment', description: 'Scheduled meetings/bookings' },
		{ name: 'Customer', value: 'customer', description: 'People/companies in the CRM' },
		{ name: 'Document', value: 'document', description: 'Files and document metadata' },
		{ name: 'Employee', value: 'employee', description: 'Internal staff records' },
		{ name: 'Lead', value: 'lead', description: 'Prospective customers' },
		{ name: 'Notification', value: 'notification', description: 'Emails and in-app messages' },
	],
	default: 'customer',
	description: 'The company object you want to work with',
};

export function recordIdField(
	resource: string,
	operations: string[],
	label = 'Record ID',
): INodeProperties {
	return {
		displayName: label,
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 12345 or cus_abc123',
		description: `The unique ID of the ${resource} to act on. You can map this from a previous node.`,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

export function confirmDestructiveField(
	resource: string,
	operations: string[],
	actionWord: string,
): INodeProperties {
	return {
		displayName: `I Understand This Will ${actionWord} The Record`,
		name: 'confirmDestructive',
		type: 'boolean',
		default: false,
		description: `Whether you confirm this will ${actionWord.toLowerCase()} the ${resource}. This safeguard is required: the node stops with an error if it is left off.`,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

export function paginationFields(resource: string, operations: string[]): INodeProperties[] {
	const show = { resource: [resource], operation: operations };
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
		},
		{
			displayName: 'Page Size',
			name: 'pageSize',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 500 },
			default: 100,
			description: 'How many records to request from the API per page (performance tuning)',
			displayOptions: { show: { ...show, returnAll: [true] } },
		},
	];
}

export function searchFields(resource: string, operations: string[]): INodeProperties[] {
	const show = { resource: [resource], operation: operations };
	return [
		{
			displayName: 'Search Query',
			name: 'searchQuery',
			type: 'string',
			default: '',
			placeholder: 'e.g. acme or jane@example.com',
			description: 'Optional free-text search sent as the "query" parameter',
			displayOptions: { show },
		},
		{
			displayName: 'Additional Filters (JSON)',
			name: 'filtersJson',
			type: 'json',
			default: '{}',
			description:
				'Optional structured filters as a JSON object, merged into the query string (for example {"status":"active"})',
			displayOptions: { show },
		},
	];
}

export function rawBodyField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Raw Body (JSON) — Advanced',
		name: 'rawBodyJson',
		type: 'json',
		default: '{}',
		description:
			'Advanced: a JSON object merged on top of the fields above. Use this only if you need to send properties that do not have their own field. Leave empty to ignore.',
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

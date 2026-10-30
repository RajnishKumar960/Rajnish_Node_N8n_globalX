import type { INodeProperties } from 'n8n-workflow';

import { paginationFields, rawBodyField, recordIdField, searchFields } from './shared';

const resource = 'lead';

const operations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{ name: 'Create', value: 'create', action: 'Create a lead', description: 'Create a new lead' },
		{ name: 'Get', value: 'get', action: 'Get a lead', description: 'Retrieve a lead by ID' },
		{ name: 'Update', value: 'update', action: 'Update a lead', description: 'Update a lead' },
		{
			name: 'Search',
			value: 'search',
			action: 'Search leads',
			description: 'Search or list leads',
		},
	],
	default: 'create',
};

const leadFieldOptions: INodeProperties[] = [
	{ displayName: 'Full Name', name: 'name', type: 'string', default: '' },
	{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
	{ displayName: 'Company', name: 'company', type: 'string', default: '' },
	{
		displayName: 'Source',
		name: 'source',
		type: 'string',
		default: '',
		placeholder: 'website, referral, event',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'New', value: 'new' },
			{ name: 'Contacted', value: 'contacted' },
			{ name: 'Qualified', value: 'qualified' },
			{ name: 'Lost', value: 'lost' },
		],
		default: 'new',
	},
	{ displayName: 'Notes', name: 'notes', type: 'string', typeOptions: { rows: 3 }, default: '' },
];

const fields: INodeProperties[] = [
	recordIdField(resource, ['get', 'update']),
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'prospect@example.com',
		description: 'Email address of the lead',
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
		options: leadFieldOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['update'] } },
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
			...leadFieldOptions,
		],
	},
	...searchFields(resource, ['search']),
	...paginationFields(resource, ['search']),
	rawBodyField(resource, ['create', 'update']),
];

export const leadDescription: INodeProperties[] = [operations, ...fields];

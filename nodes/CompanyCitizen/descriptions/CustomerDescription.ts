import type { INodeProperties } from 'n8n-workflow';

import {
	confirmDestructiveField,
	paginationFields,
	rawBodyField,
	recordIdField,
	searchFields,
} from './shared';

const resource = 'customer';

const operations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Create',
			value: 'create',
			action: 'Create a customer',
			description: 'Create a new customer record',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a customer',
			description: 'Permanently delete a customer (guarded)',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a customer',
			description: 'Retrieve a single customer by ID',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search customers',
			description: 'Search or list customers',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update a customer',
			description: 'Update fields on an existing customer',
		},
	],
	default: 'create',
};

const fields: INodeProperties[] = [
	recordIdField(resource, ['get', 'update', 'delete']),
	confirmDestructiveField(resource, ['delete'], 'Delete'),

	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'jane@example.com',
		description: 'Primary email address of the customer',
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
		options: [
			{ displayName: 'Company', name: 'company', type: 'string', default: '' },
			{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
			{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '' },
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
			{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Prospect', value: 'prospect' },
				],
				default: 'active',
			},
		],
	},

	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['update'] } },
		options: [
			{ displayName: 'Company', name: 'company', type: 'string', default: '' },
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
			{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
			{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '' },
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
			},
			{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Prospect', value: 'prospect' },
				],
				default: 'active',
			},
		],
	},

	...searchFields(resource, ['search']),
	...paginationFields(resource, ['search']),
	rawBodyField(resource, ['create', 'update']),
];

export const customerDescription: INodeProperties[] = [operations, ...fields];

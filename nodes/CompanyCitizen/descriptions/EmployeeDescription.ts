import type { INodeProperties } from 'n8n-workflow';

import { paginationFields, rawBodyField, recordIdField, searchFields } from './shared';

const resource = 'employee';

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
			action: 'Create an employee',
			description: 'Create a new employee record',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get an employee',
			description: 'Retrieve an employee by ID',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update an employee',
			description: 'Update an employee record',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search employees',
			description: 'Search or list employees',
		},
	],
	default: 'create',
};

const employeeFieldOptions: INodeProperties[] = [
	{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
	{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '' },
	{ displayName: 'Department', name: 'department', type: 'string', default: '' },
	{ displayName: 'Job Title', name: 'title', type: 'string', default: '' },
	{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'On Leave', value: 'on_leave' },
			{ name: 'Terminated', value: 'terminated' },
		],
		default: 'active',
	},
];

const fields: INodeProperties[] = [
	recordIdField(resource, ['get', 'update']),
	{
		displayName: 'Work Email',
		name: 'email',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'employee@example.company.local',
		description: 'Work email address of the employee',
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
		options: employeeFieldOptions,
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
				displayName: 'Work Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
			},
			...employeeFieldOptions,
		],
	},
	...searchFields(resource, ['search']),
	...paginationFields(resource, ['search']),
	rawBodyField(resource, ['create', 'update']),
];

export const employeeDescription: INodeProperties[] = [operations, ...fields];

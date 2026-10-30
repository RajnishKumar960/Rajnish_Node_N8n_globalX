import type { INodeProperties } from 'n8n-workflow';

import {
	confirmDestructiveField,
	paginationFields,
	rawBodyField,
	recordIdField,
	searchFields,
} from './shared';

const resource = 'appointment';

const operations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Cancel',
			value: 'cancel',
			action: 'Cancel an appointment',
			description: 'Cancel an appointment (guarded)',
		},
		{
			name: 'Create',
			value: 'create',
			action: 'Create an appointment',
			description: 'Book a new appointment',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get an appointment',
			description: 'Retrieve an appointment by ID',
		},
		{
			name: 'List',
			value: 'list',
			action: 'List appointments',
			description: 'List or search appointments',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update an appointment',
			description: 'Reschedule or edit an appointment',
		},
	],
	default: 'create',
};

const appointmentFieldOptions: INodeProperties[] = [
	{ displayName: 'End Time', name: 'endTime', type: 'dateTime', default: '' },
	{ displayName: 'Location', name: 'location', type: 'string', default: '' },
	{ displayName: 'Customer ID', name: 'customerId', type: 'string', default: '' },
	{ displayName: 'Notes', name: 'notes', type: 'string', typeOptions: { rows: 3 }, default: '' },
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Scheduled', value: 'scheduled' },
			{ name: 'Confirmed', value: 'confirmed' },
			{ name: 'Completed', value: 'completed' },
		],
		default: 'scheduled',
	},
];

const fields: INodeProperties[] = [
	recordIdField(resource, ['get', 'update', 'cancel']),
	confirmDestructiveField(resource, ['cancel'], 'Cancel'),

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Discovery call with Acme',
		description: 'Subject/title of the appointment',
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
	},
	{
		displayName: 'Start Time',
		name: 'startTime',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'When the appointment starts',
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['create'] } },
		options: appointmentFieldOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['update'] } },
		options: [
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			{ displayName: 'Start Time', name: 'startTime', type: 'dateTime', default: '' },
			...appointmentFieldOptions,
		],
	},
	{
		displayName: 'Cancellation Reason',
		name: 'cancellationReason',
		type: 'string',
		default: '',
		description: 'Optional reason recorded with the cancellation',
		displayOptions: { show: { resource: [resource], operation: ['cancel'] } },
	},

	...searchFields(resource, ['list']),
	...paginationFields(resource, ['list']),
	rawBodyField(resource, ['create', 'update']),
];

export const appointmentDescription: INodeProperties[] = [operations, ...fields];

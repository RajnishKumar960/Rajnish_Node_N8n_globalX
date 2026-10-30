import type { INodeProperties } from 'n8n-workflow';

import { paginationFields, rawBodyField, recordIdField, searchFields } from './shared';

const resource = 'document';

const operations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload a document',
			description: 'Register a document (metadata + storage reference)',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a document',
			description: 'Retrieve a document by ID',
		},
		{
			name: 'Search',
			value: 'search',
			action: 'Search documents',
			description: 'Search or list documents',
		},
	],
	default: 'upload',
};

const fields: INodeProperties[] = [
	recordIdField(resource, ['get']),

	{
		displayName: 'Document Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'contract-acme-2026.pdf',
		description: 'Display name/file name of the document',
		displayOptions: { show: { resource: [resource], operation: ['upload'] } },
	},
	{
		displayName: 'Storage Reference / URL',
		name: 'storageRef',
		type: 'string',
		required: true,
		default: '',
		placeholder: 's3://bucket/key or https://…',
		description:
			'Reference to where the file is stored. CONFIRM the expected format with the platform team (URL, storage key, or upload token).',
		displayOptions: { show: { resource: [resource], operation: ['upload'] } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['upload'] } },
		options: [
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'string',
				default: '',
				placeholder: 'application/pdf',
			},
			{ displayName: 'Owner ID', name: 'ownerId', type: 'string', default: '' },
			{ displayName: 'Related Customer ID', name: 'customerId', type: 'string', default: '' },
			{ displayName: 'Tags (Comma-Separated)', name: 'tags', type: 'string', default: '' },
		],
	},

	...searchFields(resource, ['search']),
	...paginationFields(resource, ['search']),
	rawBodyField(resource, ['upload']),
];

export const documentDescription: INodeProperties[] = [operations, ...fields];

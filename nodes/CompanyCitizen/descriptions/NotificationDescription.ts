import type { INodeProperties } from 'n8n-workflow';

import { rawBodyField } from './shared';

const resource = 'notification';

const operations: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options: [
		{
			name: 'Send Email',
			value: 'sendEmail',
			action: 'Send an email',
			description: 'Send a transactional email via the company service',
		},
		{
			name: 'Send Notification',
			value: 'sendNotification',
			action: 'Send a notification',
			description: 'Send an in-app/push notification',
		},
	],
	default: 'sendEmail',
};

const fields: INodeProperties[] = [
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'recipient@example.com',
		description: 'Recipient email address',
		displayOptions: { show: { resource: [resource], operation: ['sendEmail'] } },
	},
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: [resource], operation: ['sendEmail'] } },
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'string',
		typeOptions: { rows: 5 },
		required: true,
		default: '',
		description: 'Message body (plain text or HTML, depending on backend support)',
		displayOptions: { show: { resource: [resource], operation: ['sendEmail'] } },
	},
	{
		displayName: 'Email Options',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['sendEmail'] } },
		options: [
			{ displayName: 'BCC', name: 'bcc', type: 'string', default: '' },
			{ displayName: 'CC', name: 'cc', type: 'string', default: '' },
			{
				displayName: 'Is HTML',
				name: 'isHtml',
				type: 'boolean',
				default: false,
				description: 'Whether the body should be sent as HTML instead of plain text',
			},
			{ displayName: 'Reply-To', name: 'replyTo', type: 'string', default: '' },
			{ displayName: 'Template ID', name: 'templateId', type: 'string', default: '' },
		],
	},

	{
		displayName: 'Recipient ID',
		name: 'recipientId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'user or channel ID',
		description: 'The user, device, or channel to notify',
		displayOptions: { show: { resource: [resource], operation: ['sendNotification'] } },
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		displayOptions: { show: { resource: [resource], operation: ['sendNotification'] } },
	},
	{
		displayName: 'Notification Options',
		name: 'notificationOptions',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [resource], operation: ['sendNotification'] } },
		options: [
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				options: [
					{ name: 'Low', value: 'low' },
					{ name: 'Normal', value: 'normal' },
					{ name: 'High', value: 'high' },
				],
				default: 'normal',
			},
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'string',
				default: '',
				placeholder: 'email, sms, push, slack',
			},
		],
	},

	rawBodyField(resource, ['sendEmail', 'sendNotification']),
];

export const notificationDescription: INodeProperties[] = [operations, ...fields];

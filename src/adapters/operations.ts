import type { IHttpRequestMethods } from 'n8n-workflow';

export type ResourceName =
	'customer' | 'employee' | 'lead' | 'appointment' | 'document' | 'notification';

export interface OperationDefinition {
	method: IHttpRequestMethods;

	path: string;

	destructive?: boolean;

	paginated?: boolean;

	idempotent?: boolean;

	summary: string;
}

export const OPERATIONS: Record<ResourceName, Record<string, OperationDefinition>> = {
	customer: {
		create: { method: 'POST', path: '/customers', idempotent: true, summary: 'Create a customer' },
		get: { method: 'GET', path: '/customers/{id}', summary: 'Get a customer by ID' },
		update: { method: 'PATCH', path: '/customers/{id}', summary: 'Update a customer' },
		delete: {
			method: 'DELETE',
			path: '/customers/{id}',
			destructive: true,
			summary: 'Delete a customer',
		},
		search: {
			method: 'GET',
			path: '/customers',
			paginated: true,
			summary: 'Search/list customers',
		},
	},
	employee: {
		create: { method: 'POST', path: '/employees', idempotent: true, summary: 'Create an employee' },
		get: { method: 'GET', path: '/employees/{id}', summary: 'Get an employee by ID' },
		update: { method: 'PATCH', path: '/employees/{id}', summary: 'Update an employee' },
		search: {
			method: 'GET',
			path: '/employees',
			paginated: true,
			summary: 'Search/list employees',
		},
	},
	lead: {
		create: { method: 'POST', path: '/leads', idempotent: true, summary: 'Create a lead' },
		get: { method: 'GET', path: '/leads/{id}', summary: 'Get a lead by ID' },
		update: { method: 'PATCH', path: '/leads/{id}', summary: 'Update a lead' },
		search: { method: 'GET', path: '/leads', paginated: true, summary: 'Search/list leads' },
	},
	appointment: {
		create: {
			method: 'POST',
			path: '/appointments',
			idempotent: true,
			summary: 'Create an appointment',
		},
		get: { method: 'GET', path: '/appointments/{id}', summary: 'Get an appointment by ID' },
		update: { method: 'PATCH', path: '/appointments/{id}', summary: 'Update an appointment' },
		cancel: {
			method: 'POST',
			path: '/appointments/{id}/cancel',
			destructive: true,
			summary: 'Cancel an appointment',
		},
		list: {
			method: 'GET',
			path: '/appointments',
			paginated: true,
			summary: 'List appointments',
		},
	},
	document: {
		upload: {
			method: 'POST',
			path: '/documents',
			idempotent: true,
			summary: 'Upload/register a document (metadata + reference)',
		},
		get: { method: 'GET', path: '/documents/{id}', summary: 'Get a document by ID' },
		search: {
			method: 'GET',
			path: '/documents',
			paginated: true,
			summary: 'Search/list documents',
		},
	},
	notification: {
		sendEmail: {
			method: 'POST',
			path: '/notifications/email',
			idempotent: true,
			summary: 'Send an email notification',
		},
		sendNotification: {
			method: 'POST',
			path: '/notifications',
			idempotent: true,
			summary: 'Send an in-app/push notification',
		},
	},
};

export function resolvePath(template: string, params: Record<string, string>): string {
	return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
		const value = params[key];
		if (value === undefined || value === '') {
			throw new Error(`Missing path parameter "${key}" for endpoint "${template}".`);
		}
		return encodeURIComponent(value);
	});
}

export function getOperation(resource: string, operation: string): OperationDefinition {
	const byResource = OPERATIONS[resource as ResourceName];
	if (!byResource) {
		throw new Error(`Unknown resource "${resource}".`);
	}
	const def = byResource[operation];
	if (!def) {
		throw new Error(`Unknown operation "${operation}" for resource "${resource}".`);
	}
	return def;
}

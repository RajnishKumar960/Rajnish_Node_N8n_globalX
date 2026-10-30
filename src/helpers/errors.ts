import type { CompanyErrorCategory } from '../types';

export class CompanyApiError extends Error {
	readonly category: CompanyErrorCategory;

	readonly statusCode?: number;

	readonly details?: unknown;

	readonly retryable: boolean;

	constructor(init: {
		category: CompanyErrorCategory;
		message: string;
		statusCode?: number;
		details?: unknown;
		retryable?: boolean;
	}) {
		super(redactSensitive(init.message));
		this.name = 'CompanyApiError';
		this.category = init.category;
		this.statusCode = init.statusCode;
		this.details = init.details === undefined ? undefined : redactDeep(init.details);
		this.retryable = init.retryable ?? false;
	}
}

const SENSITIVE_KEYS = [
	'authorization',
	'x-api-key',
	'apikey',
	'api_key',
	'bearertoken',
	'bearer_token',
	'token',
	'password',
	'secret',
	'cookie',
	'set-cookie',
];

export function redactSensitive(message: string): string {
	if (!message) return message;
	let out = message;

	out = out.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***REDACTED***');

	out = out.replace(
		/(authorization|x-api-key|api[_-]?key|token|password|secret)("?\s*[:=]\s*"?)([^\s",}]+)/gi,
		'$1$2***REDACTED***',
	);
	return out;
}

export function redactDeep<T>(value: T, seen = new WeakSet<object>()): T {
	if (value === null || typeof value !== 'object') {
		return typeof value === 'string' ? (redactSensitive(value) as unknown as T) : value;
	}
	if (seen.has(value as object)) {
		return '[Circular]' as unknown as T;
	}
	seen.add(value as object);

	if (Array.isArray(value)) {
		return value.map((v) => redactDeep(v, seen)) as unknown as T;
	}

	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
		if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
			result[key] = '***REDACTED***';
		} else {
			result[key] = redactDeep(val, seen);
		}
	}
	return result as unknown as T;
}

export function categorizeHttpStatus(statusCode: number): {
	category: CompanyErrorCategory;
	hint: string;
	retryable: boolean;
} {
	switch (statusCode) {
		case 400:
			return {
				category: 'validation',
				hint: 'The request was rejected as invalid. Check the required fields and their formats.',
				retryable: false,
			};
		case 401:
			return {
				category: 'authentication',
				hint: 'Authentication failed. Verify the Company API credential (key or token) and that it has not expired.',
				retryable: false,
			};
		case 403:
			return {
				category: 'authorization',
				hint: 'The credential is valid but not permitted to perform this action. Request the required access.',
				retryable: false,
			};
		case 404:
			return {
				category: 'notFound',
				hint: 'The requested record or endpoint was not found. Check the ID and that the resource exists.',
				retryable: false,
			};
		case 408:
			return {
				category: 'timeout',
				hint: 'The company API took too long to respond. Try again or increase the timeout.',
				retryable: true,
			};
		case 429:
			return {
				category: 'rateLimit',
				hint: 'Rate limit reached. The node will back off and retry automatically where safe.',
				retryable: true,
			};
		default:
			if (statusCode >= 500) {
				return {
					category: 'server',
					hint: 'The company API reported an internal error. This is usually temporary.',
					retryable: true,
				};
			}
			if (statusCode >= 400) {
				return {
					category: 'validation',
					hint: 'The request could not be completed. Review the inputs.',
					retryable: false,
				};
			}
			return {
				category: 'unknown',
				hint: 'Unexpected response from the company API.',
				retryable: false,
			};
	}
}

export function categorizeTransportError(error: unknown): CompanyApiError {
	const code = (error as { code?: string })?.code;
	const rawMessage = (error as { message?: string })?.message ?? 'Unknown transport error';

	const timeoutCodes = ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNABORTED'];
	const connectionCodes = [
		'ECONNREFUSED',
		'ECONNRESET',
		'ENOTFOUND',
		'EAI_AGAIN',
		'EHOSTUNREACH',
		'ENETUNREACH',
		'EPIPE',
	];

	if (code && timeoutCodes.includes(code)) {
		return new CompanyApiError({
			category: 'timeout',
			message: `The request to the company API timed out (${code}). Try again or increase the timeout.`,
			retryable: true,
			details: { code },
		});
	}

	if (code && connectionCodes.includes(code)) {
		return new CompanyApiError({
			category: 'connection',
			message: `Could not connect to the company API (${code}). Check the Base URL, network/VPN access, and that the service is running.`,
			retryable: true,
			details: { code },
		});
	}

	if (code && code.startsWith('CERT')) {
		return new CompanyApiError({
			category: 'connection',
			message: `TLS/certificate error (${code}) connecting to the company API. Verify the server certificate and trust chain.`,
			retryable: false,
			details: { code },
		});
	}

	return new CompanyApiError({
		category: 'connection',
		message: `Network error contacting the company API: ${rawMessage}`,
		retryable: true,
		details: { code },
	});
}

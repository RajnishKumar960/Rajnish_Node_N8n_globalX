import type { IDataObject } from 'n8n-workflow';

import { CompanyApiError } from './errors';

export function requireField(value: unknown, fieldLabel: string): string {
	if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
		throw new CompanyApiError({
			category: 'validation',
			message: `The required field "${fieldLabel}" is missing. Please provide a value.`,
			retryable: false,
		});
	}
	return typeof value === 'string' ? value.trim() : String(value);
}

export function parseJsonObject(input: unknown, fieldLabel: string): IDataObject {
	if (input === undefined || input === null || input === '') {
		return {};
	}
	if (typeof input === 'object' && !Array.isArray(input)) {
		return input as IDataObject;
	}
	if (typeof input === 'string') {
		try {
			const parsed = JSON.parse(input);
			if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new Error('not an object');
			}
			return parsed as IDataObject;
		} catch {
			throw new CompanyApiError({
				category: 'validation',
				message: `The field "${fieldLabel}" must be a valid JSON object.`,
				retryable: false,
			});
		}
	}
	throw new CompanyApiError({
		category: 'validation',
		message: `The field "${fieldLabel}" must be a JSON object.`,
		retryable: false,
	});
}

export function validateBaseUrl(
	baseUrl: string,
	environment: string,
	allowInsecureHttp: boolean,
): string {
	const trimmed = requireField(baseUrl, 'Base URL').replace(/\/+$/, '');
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new CompanyApiError({
			category: 'validation',
			message: 'The Base URL in the Company API credential is not a valid URL.',
			retryable: false,
		});
	}
	const isHttps = parsed.protocol === 'https:';
	if (!isHttps) {
		if (environment === 'production') {
			throw new CompanyApiError({
				category: 'validation',
				message:
					'Refusing to use a non-HTTPS Base URL in a Production credential. Use https:// for production.',
				retryable: false,
			});
		}
		if (!allowInsecureHttp) {
			throw new CompanyApiError({
				category: 'validation',
				message:
					'The Base URL is not HTTPS. Enable "Allow Insecure HTTP (Dev Only)" on the credential to use plain HTTP for local development.',
				retryable: false,
			});
		}
	}
	return trimmed;
}

export function validateEmail(value: string, fieldLabel: string): string {
	const email = requireField(value, fieldLabel);

	const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	if (!ok) {
		throw new CompanyApiError({
			category: 'validation',
			message: `The field "${fieldLabel}" ("${email}") is not a valid email address.`,
			retryable: false,
		});
	}
	return email;
}

export function clampLimit(limit: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(limit)) return fallback;
	return Math.min(Math.max(Math.trunc(limit), min), max);
}

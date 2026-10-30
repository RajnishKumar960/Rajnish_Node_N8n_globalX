import { buildQuery, mergeBody, pruneEmpty } from '../src/adapters/buildRequest';
import { getOperation, resolvePath } from '../src/adapters/operations';
import {
	CompanyApiError,
	categorizeHttpStatus,
	categorizeTransportError,
	redactDeep,
	redactSensitive,
} from '../src/helpers/errors';
import {
	clampLimit,
	parseJsonObject,
	requireField,
	validateBaseUrl,
	validateEmail,
} from '../src/helpers/validation';

describe('validation helpers', () => {
	it('requireField trims and returns a present value', () => {
		expect(requireField('  hi  ', 'X')).toBe('hi');
	});

	it('requireField throws a validation error when missing', () => {
		expect(() => requireField('', 'Email')).toThrow(CompanyApiError);
		expect(() => requireField(undefined, 'Email')).toThrow(/required field "Email"/);
	});

	it('parseJsonObject accepts objects and JSON strings, rejects arrays/garbage', () => {
		expect(parseJsonObject({ a: 1 }, 'F')).toEqual({ a: 1 });
		expect(parseJsonObject('{"a":1}', 'F')).toEqual({ a: 1 });
		expect(parseJsonObject('', 'F')).toEqual({});
		expect(() => parseJsonObject('[1,2]', 'F')).toThrow(/valid JSON object/);
		expect(() => parseJsonObject('not json', 'F')).toThrow(/valid JSON object/);
	});

	it('validateBaseUrl enforces HTTPS in production', () => {
		expect(() => validateBaseUrl('http://x.local', 'production', false)).toThrow(/non-HTTPS/);
		expect(validateBaseUrl('https://x.local/', 'production', false)).toBe('https://x.local');
	});

	it('validateBaseUrl allows HTTP in dev only when explicitly permitted', () => {
		expect(() => validateBaseUrl('http://localhost:8088', 'development', false)).toThrow(
			/Allow Insecure HTTP/,
		);
		expect(validateBaseUrl('http://localhost:8088', 'development', true)).toBe(
			'http://localhost:8088',
		);
	});

	it('validateEmail accepts valid and rejects invalid addresses', () => {
		expect(validateEmail('a@b.com', 'Email')).toBe('a@b.com');
		expect(() => validateEmail('nope', 'Email')).toThrow(/not a valid email/);
	});

	it('clampLimit bounds the value', () => {
		expect(clampLimit(5000, 1, 1000, 50)).toBe(1000);
		expect(clampLimit(0, 1, 1000, 50)).toBe(1);
		expect(clampLimit(Number.NaN, 1, 1000, 50)).toBe(50);
	});
});

describe('error helpers', () => {
	it('redactSensitive masks bearer tokens and key-value secrets', () => {
		expect(redactSensitive('Authorization: Bearer abc.def.ghi')).toContain('***REDACTED***');
		expect(redactSensitive('x-api-key=supersecret123')).toContain('***REDACTED***');
	});

	it('redactDeep masks sensitive keys recursively', () => {
		const out = redactDeep({
			name: 'ok',
			headers: { Authorization: 'Bearer xyz', 'X-API-Key': 'k' },
			nested: { password: 'p' },
		});
		expect(out).toEqual({
			name: 'ok',
			headers: { Authorization: '***REDACTED***', 'X-API-Key': '***REDACTED***' },
			nested: { password: '***REDACTED***' },
		});
	});

	it('CompanyApiError sanitizes its message on construction', () => {
		const err = new CompanyApiError({
			category: 'authentication',
			message: 'bad token Bearer abc.def',
		});
		expect(err.message).toContain('***REDACTED***');
	});

	it('categorizeHttpStatus maps codes to categories', () => {
		expect(categorizeHttpStatus(401).category).toBe('authentication');
		expect(categorizeHttpStatus(403).category).toBe('authorization');
		expect(categorizeHttpStatus(404).category).toBe('notFound');
		expect(categorizeHttpStatus(429)).toMatchObject({ category: 'rateLimit', retryable: true });
		expect(categorizeHttpStatus(500)).toMatchObject({ category: 'server', retryable: true });
	});

	it('categorizeTransportError classifies connection vs timeout', () => {
		expect(categorizeTransportError({ code: 'ETIMEDOUT' }).category).toBe('timeout');
		expect(categorizeTransportError({ code: 'ECONNREFUSED' }).category).toBe('connection');
		expect(categorizeTransportError({ code: 'CERT_HAS_EXPIRED' }).retryable).toBe(false);
	});
});

describe('operation registry', () => {
	it('resolves known operations', () => {
		expect(getOperation('customer', 'create')).toMatchObject({
			method: 'POST',
			path: '/customers',
		});
		expect(getOperation('appointment', 'cancel').destructive).toBe(true);
	});

	it('throws on unknown resource/operation', () => {
		expect(() => getOperation('ghost', 'create')).toThrow(/Unknown resource/);
		expect(() => getOperation('customer', 'teleport')).toThrow(/Unknown operation/);
	});

	it('resolvePath substitutes and encodes ids', () => {
		expect(resolvePath('/customers/{id}', { id: 'a b/c' })).toBe('/customers/a%20b%2Fc');
		expect(() => resolvePath('/customers/{id}', {})).toThrow(/Missing path parameter/);
	});
});

describe('request builders', () => {
	it('pruneEmpty drops empty values', () => {
		expect(pruneEmpty({ a: 1, b: '', c: null, d: undefined, e: 'x' })).toEqual({ a: 1, e: 'x' });
	});

	it('mergeBody layers base, collection and raw override', () => {
		const body = mergeBody(
			{ email: 'a@b.com', blank: '' },
			{ firstName: 'Jane', empty: '' },
			'{"firstName":"Override","extra":true}',
		);
		expect(body).toEqual({ email: 'a@b.com', firstName: 'Override', extra: true });
	});

	it('buildQuery merges filters, extras and query text', () => {
		expect(buildQuery('acme', '{"status":"active"}', { limit: 10 })).toEqual({
			status: 'active',
			limit: 10,
			query: 'acme',
		});
	});
});

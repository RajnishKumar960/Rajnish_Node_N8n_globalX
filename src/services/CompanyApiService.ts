import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';

import { CompanyApiError, categorizeHttpStatus, categorizeTransportError } from '../helpers/errors';
import { parseJsonObject, validateBaseUrl } from '../helpers/validation';
import type {
	ICompanyApiCredentials,
	ICompanyApiRequestOptions,
	INormalizedResponse,
	IPaginationOptions,
	IRetryOptions,
} from '../types';

export interface IFullHttpResponse {
	body: unknown;
	headers: Record<string, string | string[] | undefined>;
	statusCode: number;
}

export type HttpRequester = (options: IHttpRequestOptions) => Promise<IFullHttpResponse>;

export interface CompanyApiServiceConfig {
	credentials: ICompanyApiCredentials;
	requester: HttpRequester;
	retry?: Partial<IRetryOptions>;

	defaultTimeoutMs?: number;

	sleepFn?: (ms: number) => Promise<void>;
}

const DEFAULT_RETRY: IRetryOptions = {
	maxAttempts: 3,
	baseDelayMs: 500,
	maxDelayMs: 8000,
};

const DEFAULT_TIMEOUT_MS = 30000;

const PAGINATION_HARD_CAP = 10000;

const RETRY_AFTER_MAX_MS = 60000;

export class CompanyApiService {
	private readonly credentials: ICompanyApiCredentials;

	private readonly requester: HttpRequester;

	private readonly retry: IRetryOptions;

	private readonly defaultTimeoutMs: number;

	private readonly baseUrl: string;

	private readonly extraHeaders: Record<string, string>;

	private readonly sleepFn: (ms: number) => Promise<void>;

	constructor(config: CompanyApiServiceConfig) {
		this.credentials = config.credentials;
		this.requester = config.requester;
		this.retry = { ...DEFAULT_RETRY, ...config.retry };
		this.defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
		this.sleepFn = config.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

		this.baseUrl = validateBaseUrl(
			this.credentials.baseUrl,
			this.credentials.environment,
			this.credentials.allowInsecureHttp ?? false,
		);

		const parsed = parseJsonObject(this.credentials.customHeaders, 'Additional Headers (JSON)');
		this.extraHeaders = {};
		for (const [key, value] of Object.entries(parsed)) {
			this.extraHeaders[key] = String(value);
		}
	}

	async request(options: ICompanyApiRequestOptions): Promise<INormalizedResponse> {
		const requestOptions = this.buildRequestOptions(options);
		const response = await this.executeWithRetry(requestOptions, options.method);
		return this.normalize(response);
	}

	async requestAllItems(
		options: ICompanyApiRequestOptions,
		pagination: IPaginationOptions,
	): Promise<IDataObject[]> {
		const hardCap = Math.min(pagination.maxItems ?? PAGINATION_HARD_CAP, PAGINATION_HARD_CAP);
		const maxPages = Math.ceil(hardCap / Math.max(pagination.pageSize, 1)) + 1;
		const collected: IDataObject[] = [];
		let cursor: string | undefined;
		let offset = 0;

		for (let pageNum = 0; pageNum < maxPages; pageNum++) {
			const query: IDataObject = { ...(options.query ?? {}) };
			query.limit = pagination.pageSize;
			if (cursor) {
				query.cursor = cursor;
			} else {
				query.offset = offset;
			}

			const page = await this.request({ ...options, query });
			const items = this.extractItems(page.data);
			collected.push(...items);

			if (!pagination.returnAll || collected.length >= hardCap) break;

			const nextCursor = page.pagination?.nextCursor;
			if (nextCursor) {
				cursor = nextCursor;
				continue;
			}
			if (cursor) {
				break;
			}

			const total = page.pagination?.total;
			if (items.length < pagination.pageSize) break;
			if (total !== undefined && collected.length >= total) break;
			offset += pagination.pageSize;
		}

		return collected.slice(0, hardCap);
	}

	getBaseUrl(): string {
		return this.baseUrl;
	}

	private buildRequestOptions(options: ICompanyApiRequestOptions): IHttpRequestOptions {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			...this.extraHeaders,
		};
		if (options.idempotencyKey) {
			headers['Idempotency-Key'] = options.idempotencyKey;
		}

		const requestOptions: IHttpRequestOptions = {
			baseURL: this.baseUrl,
			url: options.path,
			method: options.method,
			headers,
			qs: options.query,
			json: true,
			timeout: options.timeout ?? this.defaultTimeoutMs,
			returnFullResponse: true,

			ignoreHttpStatusErrors: true,
		};

		if (options.body !== undefined && options.method !== 'GET' && options.method !== 'DELETE') {
			requestOptions.body = options.body;
		}

		return requestOptions;
	}

	private async executeWithRetry(
		requestOptions: IHttpRequestOptions,
		method: string,
	): Promise<IFullHttpResponse> {
		const hasIdempotencyKey = Boolean(
			(requestOptions.headers as Record<string, string> | undefined)?.['Idempotency-Key'],
		);
		const methodIsReplayable =
			method === 'GET' ||
			method === 'HEAD' ||
			method === 'PUT' ||
			method === 'DELETE' ||
			(method === 'POST' && hasIdempotencyKey);

		let lastError: CompanyApiError | undefined;

		for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
			let response: IFullHttpResponse;
			try {
				response = await this.requester(requestOptions);
			} catch (error) {
				lastError = categorizeTransportError(error);
				if (!lastError.retryable || !methodIsReplayable || attempt === this.retry.maxAttempts) {
					throw lastError;
				}
				await this.backoff(attempt);
				continue;
			}

			if (response.statusCode >= 200 && response.statusCode < 300) {
				return response;
			}

			const { category, hint, retryable } = categorizeHttpStatus(response.statusCode);
			lastError = new CompanyApiError({
				category,
				statusCode: response.statusCode,
				message: `Company API returned HTTP ${response.statusCode}. ${hint}`,
				details: this.safeErrorBody(response.body),
				retryable,
			});

			const canRetry =
				retryable &&
				methodIsReplayable &&
				attempt < this.retry.maxAttempts &&
				(response.statusCode === 429 || methodIsReplayable);

			if (!canRetry) throw lastError;

			const retryAfterMs = this.parseRetryAfter(response.headers);
			await (retryAfterMs !== undefined ? this.sleepFn(retryAfterMs) : this.backoff(attempt));
		}

		throw (
			lastError ??
			new CompanyApiError({ category: 'unknown', message: 'Request failed for an unknown reason.' })
		);
	}

	private async backoff(attempt: number): Promise<void> {
		const exponential = this.retry.baseDelayMs * 2 ** (attempt - 1);
		const capped = Math.min(exponential, this.retry.maxDelayMs);

		const jittered = Math.floor(Math.random() * capped);
		await this.sleepFn(jittered);
	}

	private parseRetryAfter(
		headers: Record<string, string | string[] | undefined>,
	): number | undefined {
		const raw = headers['retry-after'] ?? headers['Retry-After'];
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (!value) return undefined;
		const asSeconds = Number(value);
		if (Number.isFinite(asSeconds)) {
			return Math.min(asSeconds * 1000, RETRY_AFTER_MAX_MS);
		}
		const asDate = Date.parse(value);
		if (!Number.isNaN(asDate)) {
			return Math.min(Math.max(asDate - Date.now(), 0), RETRY_AFTER_MAX_MS);
		}
		return undefined;
	}

	private normalize(response: IFullHttpResponse): INormalizedResponse {
		const body = response.body;
		let data: IDataObject | IDataObject[];
		let pagination: INormalizedResponse['pagination'];

		if (Array.isArray(body)) {
			data = body as IDataObject[];
		} else if (body && typeof body === 'object') {
			const obj = body as IDataObject;

			if ('data' in obj && (Array.isArray(obj.data) || typeof obj.data === 'object')) {
				data = obj.data as IDataObject | IDataObject[];
				const pg = obj.pagination as IDataObject | undefined;
				if (pg) {
					pagination = {
						nextCursor: typeof pg.nextCursor === 'string' ? pg.nextCursor : undefined,
						nextOffset: typeof pg.nextOffset === 'number' ? pg.nextOffset : undefined,
						total: typeof pg.total === 'number' ? pg.total : undefined,
					};
				}
			} else {
				data = obj;
			}
		} else {
			data = { raw: body ?? null };
		}

		return { data, statusCode: response.statusCode, pagination };
	}

	private extractItems(data: IDataObject | IDataObject[]): IDataObject[] {
		if (Array.isArray(data)) return data;

		for (const key of ['items', 'results', 'records']) {
			const maybe = (data as IDataObject)[key];
			if (Array.isArray(maybe)) return maybe as IDataObject[];
		}
		return [data];
	}

	private safeErrorBody(body: unknown): IDataObject | undefined {
		if (!body || typeof body !== 'object') return undefined;
		const obj = body as IDataObject;
		const picked: IDataObject = {};
		for (const key of ['error', 'message', 'code', 'errors', 'detail', 'details', 'status']) {
			if (key in obj) picked[key] = obj[key];
		}
		return Object.keys(picked).length > 0 ? picked : undefined;
	}
}

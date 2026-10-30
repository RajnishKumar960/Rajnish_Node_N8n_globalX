import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

export type CompanyAuthType = 'apiKey' | 'bearerToken';

export interface ICompanyApiCredentials {
	baseUrl: string;
	environment: 'development' | 'staging' | 'production';
	authType: CompanyAuthType;
	apiKey?: string;
	bearerToken?: string;
	apiKeyHeaderName?: string;
	customHeaders?: string;
	allowInsecureHttp?: boolean;
}

export interface ICompanyApiRequestOptions {
	method: IHttpRequestMethods;

	path: string;

	query?: IDataObject;

	body?: IDataObject;

	idempotencyKey?: string;

	timeout?: number;
}

export interface IRetryOptions {
	maxAttempts: number;

	baseDelayMs: number;

	maxDelayMs: number;
}

export interface IPaginationOptions {
	returnAll: boolean;

	pageSize: number;

	maxItems?: number;
}

export interface INormalizedResponse {
	data: IDataObject | IDataObject[];

	statusCode: number;

	pagination?: {
		nextCursor?: string;
		nextOffset?: number;
		total?: number;
	};
}

export type CompanyErrorCategory =
	| 'authentication'
	| 'authorization'
	| 'notFound'
	| 'validation'
	| 'rateLimit'
	| 'timeout'
	| 'connection'
	| 'server'
	| 'unknown';

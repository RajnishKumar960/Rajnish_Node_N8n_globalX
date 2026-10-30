import type { IHttpRequestOptions } from 'n8n-workflow';

import type { HttpRequester, IFullHttpResponse } from '../../src/services/CompanyApiService';

export function makeFetchRequester(authHeaders: Record<string, string> = {}): HttpRequester {
	return async (options: IHttpRequestOptions): Promise<IFullHttpResponse> => {
		const url = new URL(String(options.url ?? ''), options.baseURL);
		if (options.qs) {
			for (const [key, value] of Object.entries(options.qs)) {
				if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
			}
		}

		const headers: Record<string, string> = {
			...(options.headers as Record<string, string>),
			...authHeaders,
		};
		if (options.body !== undefined) headers['Content-Type'] = 'application/json';

		const response = await fetch(url, {
			method: options.method,
			headers,
			body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
		});

		const text = await response.text();
		let body: unknown;
		try {
			body = text ? JSON.parse(text) : undefined;
		} catch {
			body = text;
		}

		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			responseHeaders[key] = value;
		});

		return { statusCode: response.status, headers: responseHeaders, body };
	};
}

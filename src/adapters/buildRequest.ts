import type { IDataObject } from 'n8n-workflow';

import { parseJsonObject } from '../helpers/validation';

export function pruneEmpty(obj: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

export function mergeBody(
	base: IDataObject,
	collection: IDataObject | undefined,
	rawBodyJson: unknown,
): IDataObject {
	const merged: IDataObject = { ...pruneEmpty(base), ...pruneEmpty(collection ?? {}) };
	const raw =
		rawBodyJson === '' || rawBodyJson === undefined
			? {}
			: parseJsonObject(rawBodyJson, 'Raw Body (JSON)');
	return { ...merged, ...raw };
}

export function buildQuery(
	searchQuery: string | undefined,
	filtersJson: unknown,
	extra?: IDataObject,
): IDataObject {
	const filters = parseJsonObject(filtersJson, 'Additional Filters (JSON)');
	const query: IDataObject = { ...filters, ...(extra ?? {}) };
	if (searchQuery && searchQuery.trim() !== '') {
		query.query = searchQuery.trim();
	}
	return query;
}

/* eslint-disable no-console */

import express, { type NextFunction, type Request, type Response } from 'express';

const PORT = Number(process.env.MOCK_PORT ?? 8088);
const VALID_API_KEY = process.env.MOCK_API_KEY ?? 'dev-key-local';
const VALID_BEARER = process.env.MOCK_BEARER ?? 'dev-token-local';

const RESOURCES = ['customers', 'employees', 'leads', 'appointments', 'documents'] as const;
type ResourcePath = (typeof RESOURCES)[number];

type Record_ = { id: string; createdAt: string; updatedAt: string; [k: string]: unknown };

const db: Record<ResourcePath, Map<string, Record_>> = {
	customers: new Map(),
	employees: new Map(),
	leads: new Map(),
	appointments: new Map(),
	documents: new Map(),
};

const idempotencyStore = new Map<string, string>();

let seq = 1000;
const nowIso = () => new Date().toISOString();
const nextId = (prefix: string) => `${prefix}_${seq++}`;

function send(res: Response, status: number, body: unknown): void {
	res.status(status).json(body);
}

function errorBody(code: string, message: string): object {
	return { error: { code, message } };
}

export function createApp(): express.Express {
	const app = express();
	app.use(express.json({ limit: '1mb' }));

	app.use((req: Request, res: Response, next: NextFunction) => {
		const forced = req.header('x-force-status');
		if (forced) {
			const status = Number(forced);
			if (status === 429) res.setHeader('Retry-After', '1');
			send(res, status, errorBody('forced', `Forced HTTP ${status} for testing.`));
			return;
		}
		next();
	});

	app.use((req: Request, res: Response, next: NextFunction) => {
		const apiKey = req.header('x-api-key');
		const auth = req.header('authorization');
		const bearerOk = auth === `Bearer ${VALID_BEARER}`;
		const keyOk = apiKey === VALID_API_KEY;
		if (!keyOk && !bearerOk) {
			send(res, 401, errorBody('unauthorized', 'Missing or invalid API credentials.'));
			return;
		}
		next();
	});

	app.get('/health', (_req, res) => send(res, 200, { status: 'ok', time: nowIso() }));

	app.post('/notifications/email', (req, res) => {
		const { to, subject } = req.body ?? {};
		if (!to || !subject) {
			return send(res, 400, errorBody('validation', 'Fields "to" and "subject" are required.'));
		}
		return send(res, 202, {
			data: { id: nextId('msg'), status: 'queued', to, channel: 'email', acceptedAt: nowIso() },
		});
	});
	app.post('/notifications', (req, res) => {
		const { recipientId, message } = req.body ?? {};
		if (!recipientId || !message) {
			return send(
				res,
				400,
				errorBody('validation', 'Fields "recipientId" and "message" are required.'),
			);
		}
		return send(res, 202, {
			data: { id: nextId('ntf'), status: 'sent', recipientId, acceptedAt: nowIso() },
		});
	});

	app.post('/appointments/:id/cancel', (req, res) => {
		const store = db.appointments;
		const record = store.get(req.params.id);
		if (!record) return send(res, 404, errorBody('not_found', 'Appointment not found.'));
		record.status = 'cancelled';
		record.cancellationReason = (req.body ?? {}).reason ?? null;
		record.updatedAt = nowIso();
		return send(res, 200, { data: record });
	});

	for (const resource of RESOURCES) {
		const store = db[resource];
		const idPrefix = resource.slice(0, 3);

		app.post(`/${resource}`, (req, res) => {
			const idemKey = req.header('idempotency-key');
			if (idemKey) {
				const existingId = idempotencyStore.get(`${resource}:${idemKey}`);
				if (existingId && store.has(existingId)) {
					return send(res, 200, { data: store.get(existingId) });
				}
			}
			const id = nextId(idPrefix);
			const record: Record_ = { id, ...req.body, createdAt: nowIso(), updatedAt: nowIso() };
			store.set(id, record);
			if (idemKey) idempotencyStore.set(`${resource}:${idemKey}`, id);
			return send(res, 201, { data: record });
		});

		app.get(`/${resource}`, (req, res) => {
			const limit = Math.min(Number(req.query.limit ?? 50) || 50, 500);
			const offset = Number(req.query.offset ?? 0) || 0;
			const query = String(req.query.query ?? '').toLowerCase();

			let all = [...store.values()];
			if (query) {
				all = all.filter((r) => JSON.stringify(r).toLowerCase().includes(query));
			}

			for (const [key, value] of Object.entries(req.query)) {
				if (['limit', 'offset', 'cursor', 'query'].includes(key)) continue;
				all = all.filter((r) => String(r[key]) === String(value));
			}

			const total = all.length;
			const page = all.slice(offset, offset + limit);
			const nextOffset = offset + limit < total ? offset + limit : undefined;
			return send(res, 200, { data: page, pagination: { total, nextOffset } });
		});

		app.get(`/${resource}/:id`, (req, res) => {
			const record = store.get(req.params.id);
			if (!record) return send(res, 404, errorBody('not_found', `${resource} record not found.`));
			return send(res, 200, { data: record });
		});

		app.patch(`/${resource}/:id`, (req, res) => {
			const record = store.get(req.params.id);
			if (!record) return send(res, 404, errorBody('not_found', `${resource} record not found.`));
			Object.assign(record, req.body, { id: record.id, updatedAt: nowIso() });
			return send(res, 200, { data: record });
		});

		app.delete(`/${resource}/:id`, (req, res) => {
			if (!store.has(req.params.id)) {
				return send(res, 404, errorBody('not_found', `${resource} record not found.`));
			}
			store.delete(req.params.id);
			return send(res, 200, { data: { id: req.params.id, deleted: true } });
		});
	}

	app.use((req: Request, res: Response) => {
		send(res, 404, errorBody('not_found', `No endpoint for ${req.method} ${req.path}.`));
	});

	app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
		send(res, 400, errorBody('bad_request', err.message));
	});

	return app;
}

if (require.main === module) {
	createApp().listen(PORT, () => {
		console.log(`[mock-company-api] listening on http://localhost:${PORT}`);
		console.log('[mock-company-api] API key: dev-key-local  |  Bearer: dev-token-local');
	});
}

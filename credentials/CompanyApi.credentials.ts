import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CompanyApi implements ICredentialType {
	name = 'companyApi';

	displayName = 'Company API';

	documentationUrl =
		'https://github.com/RajnishKumar960/Rajnish_Node_N8n_globalX/blob/master/docs/API_CONTRACT.md';

	properties: INodeProperties[] = [
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Development', value: 'development' },
				{ name: 'Staging', value: 'staging' },
				{ name: 'Production', value: 'production' },
			],
			default: 'development',
			description:
				'Which environment this credential targets. Used for safety checks (for example, requiring HTTPS in production).',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://internal-api.example.company.local',
			description:
				'Root URL of the company backend API, without a trailing slash. CONFIRM the correct host with the platform team per environment.',
		},
		{
			displayName: 'Authentication',
			name: 'authType',
			type: 'options',
			options: [
				{ name: 'API Key (X-API-Key header)', value: 'apiKey' },
				{ name: 'Bearer Token (Authorization header)', value: 'bearerToken' },
			],
			default: 'apiKey',
			description: 'How requests to the company API are authenticated',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { authType: ['apiKey'] } },
			default: '',
			description: 'Sent as the X-API-Key request header. Stored encrypted; never logged.',
		},
		{
			displayName: 'Bearer Token',
			name: 'bearerToken',
			type: 'string',
			typeOptions: { password: true },
			displayOptions: { show: { authType: ['bearerToken'] } },
			default: '',
			description: 'Sent as "Authorization: Bearer <token>". Stored encrypted; never logged.',
		},
		{
			displayName: 'Additional Headers (JSON)',
			name: 'customHeaders',
			type: 'json',
			default: '{}',
			description:
				'Optional extra headers to send with every request, as a JSON object (for example a tenant ID). Leave as {} if not needed.',
		},
		{
			displayName: 'Allow Insecure HTTP (Dev Only)',
			name: 'allowInsecureHttp',
			type: 'boolean',
			default: false,
			description:
				'Whether to permit plain http:// base URLs. Only enable for local development against the mock server. Ignored (treated as false) when Environment is Production.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{ $credentials.authType === "apiKey" ? $credentials.apiKey : undefined }}',
				Authorization:
					'={{ $credentials.authType === "bearerToken" ? "Bearer " + $credentials.bearerToken : undefined }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/health',
			method: 'GET',
		},
	};
}

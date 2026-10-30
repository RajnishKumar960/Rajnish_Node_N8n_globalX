
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/test'],
	testMatch: ['**/*.test.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'nodes/**/*.ts',
		'credentials/**/*.ts',
		'!**/*.d.ts',
	],
	coverageDirectory: 'coverage',
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
	clearMocks: true,
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: {

					noUnusedLocals: false,
					noUnusedParameters: false,
				},
			},
		],
	},
};

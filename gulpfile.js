const { src, dest } = require('gulp');

function buildIcons() {
	return src(['nodes/**/*.{png,svg}', 'nodes/**/*.node.json'], { base: '.' }).pipe(dest('dist'));
}

exports['build:icons'] = buildIcons;
exports.default = buildIcons;

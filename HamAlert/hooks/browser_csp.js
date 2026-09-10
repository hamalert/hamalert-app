#!/usr/bin/env node

// after_prepare hook: relax the Content-Security-Policy in the *prepared*
// browser platform www (platforms/browser/www/index.html) so that browser
// dev mode (npm run browser-dev) can talk to a local HamAlert web app
// instance. This never touches the shipped source www/index.html, which
// keeps its production-only CSP.

var fs = require('fs');
var path = require('path');

module.exports = function(context) {
	// Only run for the browser platform. context.opts.platforms lists the
	// platform(s) the current cordova command is operating on; config.xml
	// also scopes this hook to <platform name="browser">, but we check
	// again here in case config.xml scoping isn't honored by the running
	// cordova version.
	var platforms = (context.opts && context.opts.platforms) || [];
	if (platforms.indexOf('browser') === -1) {
		return;
	}

	var projectRoot = context.opts.projectRoot;
	var indexPath = path.join(projectRoot, 'platforms/browser/www/index.html');

	if (!fs.existsSync(indexPath)) {
		return;
	}

	var extraOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081'];
	if (process.env.HAMALERT_API_BASE) {
		extraOrigins.push(process.env.HAMALERT_API_BASE);
	}
	var extra = extraOrigins.join(' ');

	var data = fs.readFileSync(indexPath, 'utf8');

	// Insert the extra origins right after "https://hamalert.org" inside
	// the CSP meta tag's content attribute (covers default-src, and
	// connect-src if it's ever added).
	var result = data.replace(
		/(<meta http-equiv="Content-Security-Policy" content="[^"]*?)(https:\/\/hamalert\.org)/,
		function(match, prefix, origin) {
			return prefix + origin + ' ' + extra;
		}
	);

	if (result === data) {
		console.log('browser_csp.js: could not find CSP meta tag to patch in ' + indexPath);
		return;
	}

	fs.writeFileSync(indexPath, result, 'utf8');
	console.log('browser_csp.js: patched CSP in ' + indexPath + ' to allow ' + extra);
};

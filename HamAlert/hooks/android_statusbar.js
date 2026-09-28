#!/usr/bin/env node

// after_prepare hook: cordova-android 15 ships SystemBarPlugin and draws its
// own status bar. cordova-plugin-statusbar's Android code (onload) resets
// window flags and paints the old window status bar, which fights that
// implementation. Keep the plugin for iOS (cordova-ios 7) and strip only the
// Android copy after prepare.

var fs = require('fs');
var path = require('path');

module.exports = function (context) {
	var platforms = (context.opts && context.opts.platforms) || [];
	if (platforms.indexOf('android') === -1) {
		return;
	}

	var projectRoot = context.opts.projectRoot;
	var androidRoot = path.join(projectRoot, 'platforms/android');

	stripStatusBarFeature(path.join(androidRoot, 'app/src/main/res/xml/config.xml'));
	removeDir(path.join(androidRoot, 'app/src/main/java/org/apache/cordova/statusbar'));
	stripStatusBarJs(path.join(androidRoot, 'app/src/main/assets/www/cordova_plugins.js'));
	stripStatusBarJs(path.join(androidRoot, 'platform_www/cordova_plugins.js'));
};

function stripStatusBarFeature(configPath) {
	if (!fs.existsSync(configPath)) {
		return;
	}
	var data = fs.readFileSync(configPath, 'utf8');
	var next = data.replace(
		/\s*<feature name="StatusBar">\s*<param name="android-package" value="org\.apache\.cordova\.statusbar\.StatusBar"\s*\/>\s*<param name="onload" value="true"\s*\/>\s*<\/feature>/,
		''
	);
	if (next !== data) {
		fs.writeFileSync(configPath, next);
	}
}

function stripStatusBarJs(pluginsPath) {
	if (!fs.existsSync(pluginsPath)) {
		return;
	}
	var data = fs.readFileSync(pluginsPath, 'utf8');
	var next = data.replace(
		/\s*\{\s*"id": "cordova-plugin-statusbar\.statusbar",[\s\S]*?\}\s*,?/,
		''
	);
	next = next.replace(/,(\s*\])/, '$1');
	if (next !== data) {
		fs.writeFileSync(pluginsPath, next);
	}
}

function removeDir(dir) {
	if (!fs.existsSync(dir)) {
		return;
	}
	fs.rmSync(dir, { recursive: true, force: true });
}

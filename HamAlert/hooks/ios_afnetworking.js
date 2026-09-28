#!/usr/bin/env node

// Xcode 27 treats netinet6/in6.h as a private header. The copy of
// AFNetworking inside cordova-plugin-advanced-http still imports it.
// netinet/in.h already provides the IPv6 types, which is the fix upstream
// AFNetworking made. Strip the import from the plugin sources and from the
// prepared iOS project so the next prepare does not copy it back.
// cordova-ios 8 also has no prefix header, so SDNetworkActivityIndicator.m
// must import UIKit itself to see UIApplication.

var fs = require('fs');
var path = require('path');

var RELATIVE_PATHS = [
	'node_modules/cordova-plugin-advanced-http/src/ios/SM_AFNetworking/SM_AFNetworkReachabilityManager.m',
	'node_modules/cordova-plugin-advanced-http/src/ios/SM_AFNetworking/SM_AFHTTPSessionManager.m',
	'plugins/cordova-plugin-advanced-http/src/ios/SM_AFNetworking/SM_AFNetworkReachabilityManager.m',
	'plugins/cordova-plugin-advanced-http/src/ios/SM_AFNetworking/SM_AFHTTPSessionManager.m',
	'platforms/ios/App/Plugins/cordova-plugin-advanced-http/SM_AFNetworkReachabilityManager.m',
	'platforms/ios/App/Plugins/cordova-plugin-advanced-http/SM_AFHTTPSessionManager.m'
];

var ACTIVITY_INDICATOR_PATHS = [
	'node_modules/cordova-plugin-advanced-http/src/ios/SDNetworkActivityIndicator/SDNetworkActivityIndicator.m',
	'plugins/cordova-plugin-advanced-http/src/ios/SDNetworkActivityIndicator/SDNetworkActivityIndicator.m',
	'platforms/ios/App/Plugins/cordova-plugin-advanced-http/SDNetworkActivityIndicator.m'
];

module.exports = function (context) {
	var platforms = (context.opts && context.opts.platforms) || [];
	if (platforms.indexOf('ios') === -1) {
		return;
	}
	stripPrivateHeader(context.opts.projectRoot);
	importUIKit(context.opts.projectRoot);
};

function stripPrivateHeader(projectRoot) {
	RELATIVE_PATHS.forEach(function (relativePath) {
		var filePath = path.join(projectRoot, relativePath);
		if (!fs.existsSync(filePath)) {
			return;
		}
		var text = fs.readFileSync(filePath, 'utf8');
		var next = text.replace(/\r?\n#import <netinet6\/in6.h>/g, '');
		if (next !== text) {
			fs.writeFileSync(filePath, next);
		}
	});
}

// cordova-ios 8 has no prefix header, so UIApplication is not visible
// unless this file imports UIKit itself.
function importUIKit(projectRoot) {
	ACTIVITY_INDICATOR_PATHS.forEach(function (relativePath) {
		var filePath = path.join(projectRoot, relativePath);
		if (!fs.existsSync(filePath)) {
			return;
		}
		var text = fs.readFileSync(filePath, 'utf8');
		if (text.indexOf('#import <UIKit/UIKit.h>') !== -1) {
			return;
		}
		var next = text.replace('#import "SDNetworkActivityIndicator.h"', '#import "SDNetworkActivityIndicator.h"\n#import <UIKit/UIKit.h>');
		if (next !== text) {
			fs.writeFileSync(filePath, next);
		}
	});
}

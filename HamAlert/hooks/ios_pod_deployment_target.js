#!/usr/bin/env node

// before_prepare hook: podspecs such as Firebase 11 still declare iOS 9–13.
// Xcode 27 only accepts deployment targets from 15.0 up. Raise every pod
// target to the app's deployment-target. The snippet sits between the
// platform line and the App target so cordova-ios keeps it when it rewrites
// the Podfile. Each line has to be unique: cordova-ios stores those lines
// in an object keyed by the line text, and identical lines would collapse.

var fs = require('fs');
var path = require('path');

var BLOCK_END = 'end # hamalert-pod-deployment-target';

module.exports = function (context) {
	var platforms = (context.opts && context.opts.platforms) || [];
	if (platforms.indexOf('ios') === -1) {
		return;
	}

	var projectRoot = context.opts.projectRoot;
	var podfilePath = path.join(projectRoot, 'platforms/ios/Podfile');
	if (!fs.existsSync(podfilePath)) {
		return;
	}

	var deploymentTarget = readDeploymentTarget(path.join(projectRoot, 'config.xml'));
	var block = podPostInstall(deploymentTarget);
	var text = fs.readFileSync(podfilePath, 'utf8');
	var next = upsertBlock(text, block);
	if (next !== text) {
		fs.writeFileSync(podfilePath, next);
	}
};

function readDeploymentTarget(configPath) {
	var xml = fs.readFileSync(configPath, 'utf8');
	var match = xml.match(/<platform name="ios">[\s\S]*?<preference name="deployment-target" value="([^"]+)"/);
	var value = match && match[1];
	if (!value || !/^\d+\.\d+$/.test(value)) {
		throw new Error('ios deployment-target preference is missing or not a major.minor version');
	}
	return value;
}

function podPostInstall(version) {
	return [
		'post_install do |installer|',
		'  installer.pods_project.targets.each do |target|',
		'    target.build_configurations.each do |config|',
		"      deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
		'      if deployment_target.nil? || deployment_target.to_f < ' + version,
		"        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '" + version + "'",
		'      end # hamalert deployment_target',
		'    end # hamalert build_configurations',
		'  end # hamalert targets',
		BLOCK_END
	].join('\n');
}

function upsertBlock(text, block) {
	var existing = new RegExp('post_install do \\|installer\\|[\\s\\S]*?' + BLOCK_END + '\\n?');
	if (existing.test(text)) {
		return text.replace(existing, block + '\n');
	}
	var targetLine = /^target\s+'[^']+'\s+do\s*$/m;
	if (!targetLine.test(text)) {
		throw new Error('Podfile has no App target; cannot set pod deployment targets');
	}
	return text.replace(targetLine, block + '\n$&');
}

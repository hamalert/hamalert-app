var seenSpotIds = [];
var openSpotIds = {};
var maxSpots = 100;
var maxAge = 86400;
var loadedAnySpots = false;
var push;
var spots = [];
var markAllSpotsAsSeen = true;
var sounds = ['default','blip','sota','wwff','iota','rbn','dx'];
var showingAlert = false;

var spotDetailsMap = {
	fullCallsign: function(spot) {
		return ['Callsign', '<a href="https://www.qrz.com/db/' + spot.callsign + '">' + spot.fullCallsign + '</a>']
	},
	summitRef: function(spot) {
		var text = spot.summitRef;
		if (spot.summitName) {
			text += " (" + spot.summitName + ", " + spot.summitHeight + "m, " + spot.summitPoints + "pt)";
		}
		return ['Summit', '<a href="https://sotl.as/summits/' + spot.summitRef + '">' + htmlEscape(text) + '</a>'];
	},
	wwffRef: function(spot) {
		var text = spot.wwffRef;
		if (spot.wwffName) {
			text += " (" + spot.wwffName + ")";
		}
		
		var link = undefined;
		if (!spot.wwffProgram) {
			spot.wwffProgram = 'wwff';
		}

		if (spot.wwffProgram === 'wwff') {
			link = 'https://wwff.co/directory/?showRef=' + spot.wwffRef;
		} else if (spot.wwffProgram === 'pota') {
			link = 'https://pota.app/#/park/' + spot.wwffRef;
		}
		
		if (link)
			return [spot.wwffProgram.toUpperCase(), '<a href="' + link + '">' + htmlEscape(text) + '</a>'];
		else
			return [spot.wwffProgram.toUpperCase(), htmlEscape(text)];
	},
	wwbotaRef: function(spot) {
		var text = spot.wwbotaRef;
		if (spot.wwbotaName) {
			text += " (" + spot.wwbotaName + ")";
		}
		return ['Bunker', htmlEscape(text)];
	},
	iotaGroupRef: function(spot) {
		var text = spot.iotaGroupRef;
		if (spot.iotaGroupName) {
			text += " (" + spot.iotaGroupName + ")";
		}
		return ['IOTA', htmlEscape(text)];
	},
	band: 'Band',
	frequency: 'Frequency',
	mode: function(spot) {
		var mode;
		if (spot.modeDetail) {
			mode = spot.modeDetail.toUpperCase();
		} else if (spot.mode) {
			mode = spot.mode.toUpperCase();
		}
		if (spot.modeIsGuessed)
			mode += " (guessed)";
		return ['Mode', htmlEscape(mode)];
	},
	dxcc: function(spot) {
		return ['DXCC', spot.dxcc.dxcc + " (" + spot.dxcc.country + ")"];
	},
	cq: function(spot) {
		return ['CQ zone', spot.dxcc.cq];
	},
	spotter: 'Spotter',
	triggerComments: function(spot) {
		var html = spot.triggerComments.map(function(x) {
			return htmlEscape(x);
		});
		return ['Trigger(s)', html.join('<br />')]
	},
	qsl: function(spot) {
		var qsl = spot.qsl;
		var qslMethods = {
			lotw: 'LoTW',
			eqsl: 'eQSL AG'
		};
		if (!$.isArray(qsl)) {
			qsl = [qsl];
		}
		var qslMapped = qsl.map(function(el) {
			if (qslMethods[el])
				return qslMethods[el];
			else
				return el;
		});
		return ['QSL', qslMapped.join(", ")];
	},
	state: function(spot) {
		var countryState = spot.state.split("_");
		return ['State', countryState[1]];
	}
};

$(function() {
	if (ons.platform.isIPhoneX()) {
		document.documentElement.setAttribute('onsflag-iphonex-portrait', '');
		document.documentElement.setAttribute('onsflag-iphonex-landscape', '');
	}
});

ons.ready(function() {
	loadCredentials();

	// Onsen UI is now initialized
	$('#password').on('keyup', function(e) {
		if (e.keyCode == 13) {
			doLogin();
		}
	});
	$(document).on('swipeleft', 'ons-list-item', function(e) {
		$(e.target).parents('ons-list-item.spot').find('.delete').show();
	});
	
	showAppVersion();
	checkLogin();
	reloadSpots();
});

document.addEventListener('deviceready', function() {
	setupThemeDetection();
	setupPush();
}, false);

document.addEventListener('resume', function() {
	markAllSpotsAsSeen = true;
	reloadSpots();
}, false);

window.addEventListener('statusTap', function() {
	setTimeout(function() {
		$('.page__content').css({"-webkit-overflow-scrolling": "auto"});
		$('.page__content').animate({scrollTop: 0}, 300, function() {
			$('.page__content').css({"-webkit-overflow-scrolling": "touch"});
		});
	}, 0);
});

function reloadSpots() {
	if (!loadCredentials()) {
		return;
	}

	if (!loadedAnySpots) {
		// Load cached spots so we have something to show
		var cachedSpotsStr = localStorage.getItem('cachedSpots');
		if (cachedSpotsStr) {
			spots = JSON.parse(cachedSpotsStr);
			seenSpotIds = spots.map(function(spot) {
				return spot._id;
			});
			formatSpots();
		}
		loadedAnySpots = true;
	}
	
	// Need to mark all current spots as seen before reloading?
	if (markAllSpotsAsSeen) {
		seenSpotIds = spots.map(function(spot) {
			return spot._id;
		});
		markAllSpotsAsSeen = false;
	}
	
	$('#refreshIcon').attr('spin', 'spin');
	apiGet('/api/spots2', {limit: maxSpots, maxAge: maxAge}, function(res) {
		$('#refreshIcon').removeAttr('spin');
		spots = res.spots;
		
		if (spots.length == 0 && !res.hasAnyAppTrigger) {
			$('#notrigger').show();
		} else {
			$('#notrigger').hide();
		}
		
		formatSpots();
		localStorage.setItem('cachedSpots', JSON.stringify(spots));
		
		clearPushes();
	}, function(res) {
		$('#refreshIcon').removeAttr('spin');
		if (res.status != 401) {
			if (!showingAlert) {
				showingAlert = true;
				ons.notification.alert({
					message: 'Could not load spots. Make sure that you are connected to the Internet.',
					title: 'HamAlert connection failed'
				}).then(function() {
					showingAlert = false;
				});
			}
		}
	});
}

function deleteSpot(id) {
	apiPost('/api/deleteSpot', {id: id});
}

function formatSpots() {
	var spotsHtml = "";
	
	var seenSpotIdsObj = {}; // for faster lookups
	seenSpotIds.forEach(function(el) {
		seenSpotIdsObj[el] = 1;
	});

	var lastReceivedDate = undefined;
	
	for (var i = 0; i < spots.length; i++) {
		var spot = spots[i];
		var itemClass = "spot";
		if (!seenSpotIdsObj[spot._id]) {
			itemClass += " new";
		}
		
		var spotTag = spot.source;
		var title = '<strong>' + spot.fullCallsign + '</strong>';
		if (spot.summitRef) {
			spotTag = 'sota';
			title += " on " + spot.summitRef;
		} else if (spot.wwffRef) {
			if (spot.wwffProgram)
				spotTag = spot.wwffProgram;
			else
				spotTag = 'wwff';
			title += " in " + spot.wwffRef;
		} else if (spot.wwbotaRef) {
			spotTag = 'wwbota';
			title += " in " + spot.wwbotaRef;
		} else if (spot.iotaGroupRef) {
			spotTag = 'iota';
			title += " on " + spot.iotaGroupRef;
		} else if (spot.source == 'sotawatch') {
			spotTag = 'sota';
		} else if (spot.source == 'cluster') {
			spotTag = 'dx';
		} else if (spot.source == 'pskreporter') {
			spotTag = 'pskr';
		}
		
		title += " (" + formatFrequency(spot.frequency);
		if (spot.modeDetail) {
			title += " " + spot.modeDetail.toUpperCase();
		} else if (spot.mode) {
			title += " " + spot.mode.toUpperCase();
		}
		title += ")";

		if (lastReceivedDate && lastReceivedDate.substr(0, 10) != spot.receivedDate.substr(0, 10)) {
			itemClass += " daychange";
		}
		lastReceivedDate = spot.receivedDate;
		
		spotsHtml += '<ons-list-item lock-on-drag tappable data-spotid="' + spot._id + '" class="' + itemClass + '"><div class="left spot-time"><span>' + formatTime(spot.time) + '<br /><span class="spotTag ' + spotTag + '">' + spotTag.toUpperCase() + '</span></span></div>' +
			'<div class="center"><span class="list-item__title">' + title + '</span>' + 
			'<span class="list-item__subtitle">' + spotSubtitleHtml(spot) + spotDetailsHtml(spot) + '</span></div>' + 
			'<div class="right delete"><button><ons-icon icon="ion-ios-trash" size="36px"></ons-icon></button></div>' +
			'</ons-list-item>';
	}
	
	$('#spots ons-list-item.spot').remove();
	$('#spots').append(spotsHtml);
	
	if (spots.length == 0) {
		$('#nospots').show();
	} else {
		$('#nospots').hide();
	}
	
	$('#spots ons-list-item.spot').click(function() {
		spotTapped(this);
	});
	$('#spots ons-list-item.spot a').click(function(event) {
		var href = $(this).attr('href');
		if (href) {
			window.open(href, '_system');
		}
		event.stopPropagation();
	});
	$('#spots ons-list-item.spot .delete button').click(function(event) {
		var spotId = $(event.target).parents('ons-list-item.spot').data('spotid');
		deleteSpot(spotId);
		$(event.target).parents('ons-list-item.spot').remove();
	});
	$('#spots ons-list-item.spot .muteButtons ons-button').click(function(event) {
		var spotId = $(event.target).parents('ons-list-item.spot').data('spotid');
		var muteType = $(event.target).attr('data-mutetype');
		
		var spot = undefined;
		for (var i = 0; i < spots.length; i++) {
			if (spots[i]._id == spotId) {
				spot = spots[i];
				break;
			}
		}
		addMute(spot.callsign, (muteType == 'callsignBand') ? spot.band : null, (muteType == 'callsignSummit') ? spot.summitRef : null);
		event.stopPropagation();
	});
}

function formatFrequency(frequency) {
	return sprintf("%.06f", frequency).replace(/^(\d+\.\d{3,}?)0+$/, '$1');
}

function spotSubtitleHtml(spot) {
	if (spot.source == 'sotawatch' && spot.summitName) {
		var subtitle = htmlEscape(spot.summitName) + ", " + spot.summitHeight + "m, " + spot.summitPoints + "pt";
		if (spot.comment && spot.comment != '(null)')
			subtitle += ": " + htmlEscape(spot.comment);
		return subtitle;
	} else {
		return htmlEscape(spot.rawText);
	}
}

function spotDetailsHtml(spot) {
	var html = '<div class="spotDetails"';
	
	if (!openSpotIds[spot._id]) {
		html += ' style="display: none"';
	}
	html += '><table>';
	
	if (spot.dxcc) {
		spot.cq = spot.dxcc.cq;
	}
	$.each(spotDetailsMap, function(key, formatter) {
		if (!spot[key])
			return;
		
		var displayKey;
		if (typeof formatter === 'function') {
			var fmt = formatter(spot);
			displayKey = fmt[0];
			value = fmt[1];
		} else {
			displayKey = formatter;
			value = htmlEscape(spot[key]);
		}
		
		html += '<tr><th>' + displayKey + '</th><td>' + value + '</td></tr>';
	});
	
	html += '</table>';

	html += '<div class="muteButtons"><div class="muteTitle">Mute</div>';
	html += '<ons-button data-mutetype="callsign" modifier="quiet">Callsign</ons-button>';
	html += '<ons-button data-mutetype="callsignBand" modifier="quiet">Callsign + Band</ons-button>';
	
	if (spot.summitRef) {
		html += '<ons-button data-mutetype="callsignSummit" modifier="quiet">Callsign + Summit</ons-button>';
	}
	
	html += '</div></div>';
	
	return html;
}

function clearPushes() {
	if (!push)
		return;
	
	push.clearAllNotifications(function(){}, function(){});
	push.setApplicationIconBadgeNumber(function(){}, function(){}, 0);
}

function spotTapped(spotElement) {
	$(spotElement).removeClass('new');
	$(spotElement).removeAttr('tappable');
	$(spotElement).find('.delete').hide();
	var spotId = $(spotElement).data('spotid');
	
	if (openSpotIds[spotId]) {
		$(spotElement).find('div.spotDetails').hide();
		delete openSpotIds[spotId];
	} else {
		$(spotElement).find('div.spotDetails').show();
		openSpotIds[spotId] = 1;
	}
	
	if (seenSpotIds && seenSpotIds.indexOf(spotId) == -1) {
		seenSpotIds.push(spotId);
	}
}

function openMenu() {
	document.getElementById('menu').open();
}

function checkLogin() {
	// If the user is not logged in, show the login page	
	if (!loadCredentials()) {
		popupLogin();
	} else {
		$('#usernameDisplay').text(localStorage.getItem('username'));
	}
}

function popupLogin() {	
	var dialog = document.getElementById('loginDialog');
	dialog.show();
}

function doLogin() {
	var username = $('#username').val().trim().toUpperCase();
	var password = $('#password').val().trim();
		
	if (!username || !password)
		return;
	
	cordova.plugin.http.useBasicAuth(username, password);
	apiPost('/api/checkLogin', {}, function(res) {
		localStorage.setItem('username', username);
		localStorage.setItem('password', password);
		$('#usernameDisplay').text(username);
		updatePushToken();

		var dialog = document.getElementById('loginDialog');
		dialog.hide();
		
		reloadSpots();
	});
}

function doLogout() {
	var menu = document.getElementById('menu');
	var confirmDlg = ons.notification.confirm("Are you sure you want to logout?", {
		buttonLabels: ['Logout', 'Cancel']
	});
	confirmDlg.then(function(index) {
		if (index != 0)
			return;
		
		menu.close(menu);
		resetLogin();
	});
}

function resetLogin() {
	// Before deleting the username/password, if we're currently logged in,
	// try to delete the push token on the server so we won't get pushes
	// for the old user afterwards
	var registrationId = localStorage.getItem('registrationId');
	if (registrationId && loadCredentials()) {
		apiPost('/api/deletePushToken', {token: registrationId});
	}
	
	localStorage.removeItem('username');
	localStorage.removeItem('password');
	localStorage.removeItem('cachedSpots');

	popupLogin();
}

function setupPush() {
	push = PushNotification.init({
		"android": {
			"senderID": "854056214480"
		},
		"browser": {},
		"ios": {
			"alert": true,
			"sound": true,
			"vibration": true,
			"badge": true,
			"categories": {
				"spot": {
					"no": {
						"callback": "pushmute",
						"title": "Mute Callsign",
						"foreground": false,
						"destructive": false
					},
					"maybe": {
						"callback": "pushmuteband",
						"title": "Mute Callsign + Band",
						"foreground": false,
						"destructive": false
					}
				}
			}
		},
		"windows": {}
	});

	push.on('registration', function(data) {
		console.log('registration event: ' + data.registrationId);
		localStorage.setItem('registrationId', data.registrationId);
		updatePushToken();
	});

	push.on('error', function(e) {
		console.log("push error = " + e.message);
		ons.notification.alert({
			message: 'Make sure that this app has permission to use push notifications. Error: ' + e.message,
			title: 'Push registration failed'
		});
	});

	push.on('notification', function(data) {
		console.log('notification event');
		reloadSpots();
	});
	
	push.on('pushmute', function(data) {
		var silent = true;
		if (device.platform == 'Android') {
			/* must run in foreground on Android, so give the user some feedback when the app opens */
			silent = false;
		}
		addMute(data.additionalData.hamalert.callsign, null, null, function() {
			push.finish(function() {}, function() {}, data.additionalData.notId);
		}, silent);
	});
	
	push.on('pushmuteband', function(data) {
		var silent = true;
		if (device.platform == 'Android') {
			/* must run in foreground on Android, so give the user some feedback when the app opens */
			silent = false;
		}
		addMute(data.additionalData.hamalert.callsign, data.additionalData.hamalert.band, null, function() {
			push.finish(function() {}, function() {}, data.additionalData.notId);
		}, silent);
	});

	// Create a channel for each sound. This is necessary to get custom sounds to play on Android 8+
	sounds.forEach(function(sound) {
		PushNotification.createChannel(
			function() {},
			function() {},
			{
				id: sound,
				description: sound,
				importance: 3,
				sound: sound
			}
		);
	});
}

function updatePushToken() {
	var pushToken = localStorage.getItem('registrationId');
	if (!pushToken || !loadCredentials())
		return;
	
	var type;
	if (device.platform == 'Android') {
		type = 'gcm';
	} else if (device.platform == 'iOS') {
		type = 'apns';
	} else {
		// unknown type
		return;
	}
	
	apiPost('/api/updatePushToken', {type: type, token: pushToken, deviceName: getDeviceName()}, function (res) {
		console.log(res);
	});
}

function loadPushSettings(callback) {
	var pushToken = localStorage.getItem('registrationId');
	if (!pushToken || !loadCredentials()) {
		callback();
		return;
	}
	
	apiGet('/api/pushSettings', {token: pushToken}, function (res) {
		callback(res);
	});
}

function updatePushSettings() {
	var pushToken = localStorage.getItem('registrationId');
	if (!pushToken || !loadCredentials())
		return;
	
	var disable = $('#enablePush').prop('checked') ? 0 : 1;
	var sound = $('input[name=sound]:checked').val();
	if (disable)
		$('#sound-settings').slideUp();
	else
		$('#sound-settings').slideDown();
	
	apiPost('/api/updatePushSettings', {token: pushToken, disable: disable, sound: sound});
}

function updateMuteSettings() {
	var muteTtl = $('input[name=muteTtl]:checked').val();
	localStorage.setItem('muteTtl', muteTtl);
}

function addMute(callsign, band, summitRef, callback, silent) {
	var muteTtl = localStorage.getItem('muteTtl');
	if (!loadCredentials())
		return;
	
	if (!muteTtl) {
		muteTtl = 3600;
	}
	
	apiPost('/api/addMute', {callsign: callsign, band: band, summitRef: summitRef, ttl: muteTtl}, function(res) {
		var spotSpec = callsign;
		if (band) {
			spotSpec += " on " + band;
		}
		if (summitRef) {
			if (band)
				spotSpec += " and ";
			else
				spotSpec += " on ";
			spotSpec += " summit " + summitRef;
		}
		
		var muteTime = '';
		if (muteTtl >= 3600) {
			muteTime += Math.floor(muteTtl/3600) + ' hour(s)';
			muteTtl %= 3600;
			if (muteTtl > 60) {
				muteTime += ', ' + Math.floor(muteTtl/60) + ' minute(s)';
			}
		} else {
			muteTime += Math.floor(muteTtl/60) + ' minute(s)';
		}
		
		if (!silent) {
			ons.notification.alert({
				message: 'Spots for ' + spotSpec + ' are now muted for ' + muteTime + '.',
				title: 'Spots muted'
			});
		}
		
		if (callback)
			callback();
	}, function(response) {		
		if (callback)
			callback();
	}, silent);
}

function clearMutes() {
	if (!loadCredentials())
		return;
	
	apiPost('/api/clearMutes', {}, function(res) {
		ons.notification.alert({
			message: 'All mutes have been cleared.',
			title: 'Mutes cleared'
		});
	});
}

function updateTimeSettings() {
	var timeSetting = $('input[name=time]:checked').val();
	localStorage.setItem('time', timeSetting);
	reloadSpots();
}

function goRegister() {
	cordova.InAppBrowser.open('https://hamalert.org/register?hidenav=1', '_blank', 'location=no,zoom=no,enableViewportScale=yes,usewkwebview=yes');
}

function goPrivacy() {
	cordova.InAppBrowser.open('https://hamalert.org/privacy?hidenav=1', '_blank', 'location=no,zoom=no,enableViewportScale=yes,usewkwebview=yes');
}

function goForgotPassword() {
	cordova.InAppBrowser.open('https://hamalert.org/forgotpass?hidenav=1', '_blank', 'location=no,zoom=no,enableViewportScale=yes,usewkwebview=yes');
}

function goTriggers() {
	goInAppBrowserWithLogin('/triggers');
}

function goLimits() {
	goInAppBrowserWithLogin('/limits');
}

function goDestinations() {
	goInAppBrowserWithLogin('/destinations');
}

function goDeleteAccount() {
	goInAppBrowserWithLogin('/account_delete');
}

function goSupport() {
	window.open('https://forum.hamalert.org/', '_system');
}

function goGitHub() {
	window.open('https://github.com/hamalert', '_system');
}

function goInAppBrowserWithLogin(goto) {
	var username = localStorage.getItem('username');
	var password = localStorage.getItem('password');

	var path = 'https://hamalert.org/login?';
	path += 'username=' + encodeURIComponent(username);
	path += '&password=' + encodeURIComponent(password);
	path += '&goto=' + encodeURIComponent(goto + '?hidenav=1');

	cordova.InAppBrowser.open(path, '_blank', 'location=no,enableViewportScale=yes,usewkwebview=yes');
}

function goSettings() {	
	var content = document.getElementById('content');
	var menu = document.getElementById('menu');
	menu.close();
	
	if (content.pages.length > 1)
		return;
	
	var modal = document.getElementById('loading');
	modal.show();
	content.pushPage('settings.html').then(function() {
		loadPushSettings(function(res) {
			if (res) {
				$('#enablePush').prop('checked', !res.disable);
				$('#sound-' + res.sound).prop('checked', true);
				if (res.disable)
					$('#sound-settings').hide();
				else
					$('#sound-settings').show();
			}
			modal.hide();
		});
		
		var muteTtl = localStorage.getItem('muteTtl');
		if (!muteTtl)
			muteTtl = 3600;
		$('#muteTtl-' + muteTtl).prop('checked', true);

		var timeSetting = localStorage.getItem('time');
		if (!timeSetting)
			timeSetting = 'utc';
		$('#time-' + timeSetting).prop('checked', true);
	});
}

function getDeviceName() {
	if (cordova.plugins.deviceName)
		return cordova.plugins.deviceName.name;
	else
		return "Unknown";
}

function htmlEscape(str) {
	str = String(str);
	return str
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function formatTime(timeUtc) {
	var timeSetting = localStorage.getItem('time');
	if (timeSetting === 'local') {
		var m = moment.utc(timeUtc, 'HH:mm');
		return m.local().format('HH:mm');
	} else {
		return timeUtc + 'Z';
	}
}

function apiGet(path, params, successCallback, errorCallback, silent) {
	cordova.plugin.http.get('https://hamalert.org' + path, stringifyValues(params), {}, function (response) {
		if (successCallback) {
			successCallback(JSON.parse(response.data));
		}
	}, function(response) {
		if (!silent) {
			if (response.status == 401) {
				ons.notification.alert({
					message: 'Please check your username and password.',
					title: 'Login failed'
				}).then(resetLogin);
			} else if (!showingAlert) {
				showingAlert = true;
				ons.notification.alert({
					message: 'Could not check in with the HamAlert server. Make sure that you are connected to the Internet.',
					title: 'HamAlert connection failed'
				}).then(function() {
					showingAlert = false;
				});
			}
		}
		if (errorCallback) {
			errorCallback(response);
		}
	});
}

function apiPost(path, data, successCallback, errorCallback, silent) {
	cordova.plugin.http.post('https://hamalert.org' + path, stringifyValues(data), {}, function (response) {
		if (successCallback) {
			successCallback(JSON.parse(response.data));
		}
	}, function(response) {
		if (!silent) {
			if (response.status == 401) {
				ons.notification.alert({
					message: 'Please check your username and password.',
					title: 'Login failed'
				}).then(resetLogin);
			} else if (!showingAlert) {
				showingAlert = true;
				ons.notification.alert({
					message: 'Could not check in with the HamAlert server. Make sure that you are connected to the Internet.',
					title: 'HamAlert connection failed'
				}).then(() => {
					showingAlert = false;
				});
			}
		}
		if (errorCallback) {
			error(response);
		}
	});
}

function stringifyValues(obj) {
	var newObj = {};
	var keys = Object.keys(obj);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (obj[key] != null) {
			newObj[key] = obj[key].toString();
		}
	}
	return newObj;
}

function loadCredentials() {
	var username = localStorage.getItem('username');
	var password = localStorage.getItem('password');
	if (username && password) {
		cordova.plugin.http.useBasicAuth(username, password);
		return true;
	}
	return false;
}

let lastDarkMode = false;
function setupThemeDetection() {
	cordova.plugins.ThemeDetection.isDarkModeEnabled(
		(success) => {
			if (lastDarkMode !== success.value) {
				if (success.value) {
					$('#css-components').attr('href', "css/dark-onsen-css-components.min.css");
					$('body').addClass('dark-mode');
					StatusBar.styleLightContent();
				} else {
					$('#css-components').attr('href', "css/onsen-css-components.min.css");
					$('body').removeClass('dark-mode');
					StatusBar.styleDefault();
				}
				lastDarkMode = success.value;
			}
		},
		(error) => {}
	);
	setTimeout(setupThemeDetection, 1000);
}

function showAppVersion() {
	if (cordova.getAppVersion) {
		cordova.getAppVersion.getVersionNumber().then(function (version) {
			$('#appversion').text('Version ' + version);
		});
	}
}

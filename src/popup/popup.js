var IMAGE_URL_NOT_AVAILABLE = "n/a",
    IMAGE_URL_DEFAULT = "images/image_na.png",
	SEARCH_INSTALLED_FROM_POPUP = "?installedfrompopup";

var writeStyleTemplate = document.createElement("a");
writeStyleTemplate.className = "write-style-link";

var installed = document.getElementById("recommended");

var STYLE_URL_ID_REGEX = /(styles\/)(\d+)/;
var menutype;
var website;

getActiveTab(updatePopUp);

!function initUITabs(){
    Tabs.bindHeaderToBody('#tab-header-recommended', '#tab-item-recommended');
    Tabs.bindHeaderToBody('#tab-header-installed', '#tab-item-installed');
	var storedTabId = parseInt(localStorage.getItem("lastTabId"));
	menutype = "Library_menu";
	if (!!storedTabId){
		Tabs.setActiveTab(storedTabId);
		menutype = "Installed_styles_menu";
	}
	Tabs.onTabChanged(function(e){
		localStorage.setItem("lastTabId", e.newTabId);
		menutype = (!!e.newTabId ? "Installed_styles_menu" : "Library_menu");
		analyticsEventReport(menutype, "shown", website);
	})
	checkProcessInstalledFromPopup();
}();

function checkProcessInstalledFromPopup(){
	if (window.location.search == SEARCH_INSTALLED_FROM_POPUP
		&& prefs.get("disableAll")
		&& chrome.extension.getBackgroundPage().isBrowserSessionNew()){
		var noti = document.getElementById("styles-off-notification");
		noti.classList.add("bounceIn");
		noti.classList.add("animated");
		document.body.addEventListener('click', onAction);
		chrome.extension.getBackgroundPage().setBrowserSessionNotNew();
		function onAction(){
			noti.classList.remove("bounceIn");
			noti.classList.add("bounceOut");
			document.body.removeEventListener('click', onAction);
		}
	}
}

function getInstalledStyles(){
	return new Promise(function(resolve, reject){
		chrome.runtime.sendMessage({method: "getStyles"}, resolve);
	});
}

function parseStyleId(style){
    var matches = STYLE_URL_ID_REGEX.exec(style.url);
    if (matches && matches.length == 3){
        return parseInt(matches[2]);
    } else {
        throw new Error("Can't retrieve style id. Url corrupted " + style.url);
    }
}

function getOrParseStyleId(style){
    if (style.styleid) {
        return style.styleid;
    }

    var parsed;
	try{
		parsed = parseStyleId(style);
		return parsed;
	} catch(e){
		console.error(e);
		return Math.floor(-10000 * Math.random());
	}
}

function styleIsInInstalled(style, installedStyles){
	for(var i = 0; i < installedStyles.length; i++){
		var current = installedStyles[i];
		if (current.url){
			var currentStyleId = getOrParseStyleId(current);
			if (style.styleid === currentStyleId){
				return true;
			}
		} else {
			if (style.id === current.id){
				return true;
			}
		}
	}
	return false;
}

function parseUrl(url){
	var a = document.createElement('a');
	a.href = url;
	return a;
}

function updatePopUp(tab) {
	website = getSiteName(tab.url);
	analyticsEventReport(menutype, "shown", website);
	updateSiteName(website);
	updateCreateStyleLink(parseUrl(tab.url).hostname);

	var urlWillWork = /^(file|http|https|ftps?|chrome\-extension):/.exec(tab.url);
	if (!urlWillWork) {
		document.body.classList.add("blocked");
		document.getElementById("unavailable").classList.remove("hide");
		document.getElementById("recommended").classList.add("hide");
		return;
	}

	var hasStyles = chrome.extension.getBackgroundPage()
        .prefs.get("checkNewStyles").haveNewStyles(tab.id);

	var userAllowedServerConnection = prefs.get('popup.checkNewStyles').popupCheckEnabled();

    if (hasStyles && userAllowedServerConnection){
        var styles = chrome.extension.getBackgroundPage()
            .prefs.get("checkNewStyles").getStyles(tab.id);

        preProcessStyles(styles).then(function(styles){
            showStyles(styles);
        });
    } else {
        document.getElementById("nostyles").classList.remove("hide");
		document.getElementById("recommended").classList.add("hide");
		document.getElementById("find-styles").style.display = "none";
		proceedToOptMessage();
    }

	document.querySelectorAll('#find-styles a').forEach(function (el) {
		el.href = "https://userstyles.org/styles/browse/all/" +
			encodeURIComponent("file" === urlWillWork[1] ? "file:" : tab.url);
	});
}

function proceedToOptMessage(){
	getSync().get(function(set){
		if (!set.settings.analyticsEnabled){
			displayOptMessage();
		}
	});
}

function displayOptMessage(){
	var noConnection = document.getElementById("noServerConnection");
    noConnection.classList.remove("hide");
	document.getElementById("nostyles").classList.add("hide");
	document.getElementById("recommended").classList.add("hide");

    var localSiteName = chrome.i18n.getMessage("noServerConnectionParam1"),
        localSettingsName = chrome.i18n.getMessage("noServerConnectionParam2");

    var message = noConnection.querySelector('div');
    message.innerHTML = message.innerHTML
        .replace("%noServerConnectionParam1%", createLink("https://userstyles.org", localSiteName).outerHTML)
        .replace("%noServerConnectionParam2%", createLink("/manage.html", localSettingsName).outerHTML);
}

function createLink(href, name){
    var a = document.createElement('a');
    a.href = href;
    a.innerText = name;
    a.target = "_blank";
    return a;
}

function updateCreateStyleLink(tabDomain){
	var createNewStyleLink = document.getElementById('write-new-style-link');
	createNewStyleLink.href += "?domain="+tabDomain;
}

function updateSiteName(siteName){
	document.getElementById('sitename').innerHTML = siteName;
}

function getSiteName(tabUrl){
	var a = document.createElement('a');
	a.href = tabUrl;
	return a.hostname;
}

function preProcessStyles(styles){
	return new Promise(function(resolve, reject){
		var allStyles = styles.stylesCache.styles.popularstyles;
		allStyles.forEach(preProcessStyle);
        getInstalledStyles().then(function(installedStyles){
            var filter = preProcessFilterInstalledGenerator(installedStyles);
            allStyles = allStyles.filter(filter);
            allStyles = limitTo(allStyles, styles.stylesCache.popularstylestoshow);
            allStyles.forEach(preProcessImage);
            resolve(allStyles);
        });
	});
}

function limitTo(styles, limit){
    return styles.filter(function(){
        return limit-- > 0;
    });
}

function preProcessStyle(style){
    style.installsStr = preProcessInstalls(style.installs);
    style.installsTooltip = chrome.i18n.getMessage("numberOfWeeklyInstalls");
    style.installButtonLabel = chrome.i18n.getMessage("installButtonLabel");
    return style;
}

function preProcessFilterInstalledGenerator(installedStyles){
	return function preProcessFilterInstalled(style){
	    return !styleIsInInstalled(style, installedStyles);
	};
}

function preProcessInstalls(installsSrc){
	installsSrc = installsSrc || 1;
    var installs, devider = 1;
    if (installsSrc >= 1000000){
        devider = 1000000;
    } else if (installsSrc >= 1000){
        devider = 1000;
    }

    if (devider > 1){
        installs = installsSrc / devider;
        installs = installs.toFixed(1);
        installs = installs.replace(".0", ""); // remove the decimal part if it is 0
        switch (devider){
            case 1000:
                installs += "k";
                break;
            case 1000000:
                installs += "m";
                break;
        }
    } else {
        installs = installsSrc;
    }

    return installs;
}

function preProcessImage(style){
    if (!style.thumbnail ||
        style.thumbnail.toLowerCase() == IMAGE_URL_NOT_AVAILABLE){
        style.thumbnail = IMAGE_URL_DEFAULT;
    }
    return style;
}

function showStyles(styles) {
	var allStyles = styles;
	allStyles.forEach(function(el){
        addStyleToRecommended(el);
	});
}

function addStyleToRecommended(style){
	var styleEl = styleToElement(style);
	bindInstallEvent(styleEl, style);
    installed.appendChild(styleEl);
}

function bindInstallEvent(styleEl, style){
	styleEl.querySelector("a.thumbnail_install").addEventListener('click', onThumbnailInstallClick(style));
}

function onThumbnailInstallClick(style){
	return function(e){
		e.preventDefault();
		installStyleFromPopup(style);
	}
}

function installStyleFromPopup(style){
	new Requester()
		.get(style.style_url.replace("styles/", "styles/chrome/") + ".json?")
		.then(function(data){
			var styleObj = JSON.parse(data);
			saveStyle(styleObj, function(){
				onStyleInstalledFromPopup(styleObj)
			});
		});
}

function onStyleInstalledFromPopup(styleData){
	window.location.search = SEARCH_INSTALLED_FROM_POPUP;
}

function styleToElement(style){
    return MustacheTemplate.render("style-item", style);
}

function enable(event, enabled) {
	var id = getId(event);
	enableStyle(id, enabled);
}

function getId(event) {
	var e = event.target;
	while (e) {
		if (e.hasAttribute("style-id")) {
			return e.getAttribute("style-id");
		}
		e = e.parentNode;
	}
	return null;
}

function openLinkInTabOrWindow(event) {
	event.preventDefault();
	if (prefs.get("openEditInWindow", false)) {
		var options = {url: event.target.href}
		var wp = prefs.get("windowPosition", {});
		for (var k in wp) options[k] = wp[k];
		chrome.windows.create(options);
	} else {
		openLink(event);
	}
	close();
}

function openLink(event) {
	event.preventDefault();
	if(event.target && event.target.id && "find-styles-link" === event.target.id)
		analyticsEventReport("Library_menu", "see_more", website);
	
	chrome.runtime.sendMessage({method: "openURL", url: event.target.href});
	close();
}

document.querySelectorAll("#find-styles-link , #open-manage-link").forEach(function(el) {
	el.addEventListener("click", openLink, false);
});

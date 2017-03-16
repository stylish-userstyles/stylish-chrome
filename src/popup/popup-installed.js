var ENABLED_CLASS = "enabled",
    DISABLED_CLASS = "disabled",
    FORUM_DISCUSSION_URL_PATTERN = "https://forum.userstyles.org/post/discussion?Discussion/StyleID={{ID}}",
    USER_CHECK_AUTH_URL = "https://userstyles.org/login/check",
    ZERO_INSTALLED_CLASS = "zero-installed";

function getActiveTabPromise() {
    return new Promise(function(resolve){
        chrome.tabs.query(
            {currentWindow: true, active: true}, function(tabs) {
                resolve(tabs[0]);
            }
        );
    });
}

function getBodyEl(){
    return document.body;
}

function getZeroStylesEl(){
    return document.getElementById("zerostyles");
}

function getInstalledStylesEl(){
    var installed = document.getElementById("installed");
    if (installed){
        getInstalledStylesEl = function(){
            return installed;
        }
    }
    return installed;
}

function getInstalledStylesTabContainer(){
    var installedTab = document.getElementById("tab-item-installed");
    return installedTab;
}

function getDisableAllCheckbox(){
    return document.getElementById("disable-all-checkbox");
}

function getDisableAllContainer(){
    return document.getElementById("disable-all-container");
}

function sendDisableAll(value){
    analyticsEventReport("Installed_styles_menu", "all_styles_toggle_o" + (!!value ? "ff" : "n"), website);
    return new Promise(function(resolve){
        if (value === undefined || value === null) {
            value = !prefs.get("disableAll");
        }
        prefs.set("disableAll", value);
        notifyAllTabs({method: "styleDisableAll", disableAll: value})
            .then(resolve);
    });
}

function isDisabledAll(){
    return chrome.extension.getBackgroundPage().prefs.get("disableAll");
}

getActiveTabPromise().then(function(currentTab){
    getInstalledStyleForUrl(currentTab.url).then(renderInstalledTab);
});

function renderInstalledTab(styles){
    renderForAllCases();
    if (styles.length == 0){
        renderPageForNoStyles();
    }else{
        renderPageWithStyles(styles);
    }
}

function renderPageForNoStyles(){
    getInstalledStylesTabContainer().classList.add(ZERO_INSTALLED_CLASS);
    getZeroStylesEl().classList.remove('hide');
    getInstalledStylesEl().classList.add('hide');
}

function renderPageWithStyles(styles){
    getInstalledStylesTabContainer().classList.remove(ZERO_INSTALLED_CLASS);
    getZeroStylesEl().classList.add('hide');
    getInstalledStylesEl().classList.remove('hide');
    var sif = new StyleInfoFetcher().setRequester(new SessionCachedRequester());
    styles.forEach(function(style){
        if (!isStyleLocal(style)){
            sif.getStyleInfoByUrl(style.url).then(function(styleInfo){
                Object.assign(style, styleInfo);
                return style;
            }).then(addStyleToInstalled);
        }else{
            preProcessLocalStyle(style);
            addStyleToInstalled(style);
        }
    })
}

function isStyleLocal(style){
    return !style.url && !style.styleid;
}

function preProcessLocalStyle(style){
    // mind that preProcessInstalledStyle will still be
    // called but after this
    style.styleid = "local" + style.id;
    preProcessImage(style);
    style.screenshot = style.thumbnail;
    style.additionalClass = "local";
}

function preProcessInstalledStyle(style){
    style.installs = style.weekly_installs;
    preProcessStyle(style);
    style.editButtonLabel = "edit";
    style.activateButtonLabel = chrome.i18n.getMessage("enableStyleLabel");
    style.deactivateButtonLabel = chrome.i18n.getMessage("disableStyleLabel");
    style.deleteButtonLabel = chrome.i18n.getMessage("deleteStyleLabel");
    style.sendFeedbackLabel = chrome.i18n.getMessage("sendFeedbackLabel");
    style.additionalClass = style.additionalClass || "";
    style.additionalClass += " " + (style.enabled ? "enabled" : "disabled");
    style.active_str = chrome.i18n.getMessage("styleActiveLabel");
    style.inactive_str = chrome.i18n.getMessage("styleInactiveLabel");
    style.style_edit_url = "edit.html?id=" + style.id;
    style.styleId = getOrParseStyleId(style);
    style.feedback_url = style.url+"?autofb#discussions-area";
    style.discussion_url = FORUM_DISCUSSION_URL_PATTERN.replace("{{ID}}", style.styleId);
}

function addStyleToInstalled(style){
    preProcessInstalledStyle(style);
    var el = installedStyleToElement(style);
    bindHandlers(el, style);
    getInstalledStylesEl().appendChild(el);
    return el;
}

function installedStyleToElement(style){
    return MustacheTemplate.render("style-installed-item", style);
}

function renderAllSwitch(){
    if (!isDisabledAll()){
        getDisableAllCheckbox().checked = true;
        getInstalledStylesEl().classList.remove("all-off");
        getInstalledStylesEl().classList.add("all-on");
        getBodyEl().classList.remove("all-off");
        getBodyEl().classList.add("all-on");
    }else{
        getInstalledStylesEl().classList.remove("all-on");
        getInstalledStylesEl().classList.add("all-off");
        getBodyEl().classList.remove("all-on");
        getBodyEl().classList.add("all-off");
    }
}

function getUserAuthStatus(){
    return new Promise(function(resolve){
        getSync().get(function(set){
            if (set.settings && !set.settings.analyticsEnabled){
                resolve(false);
            }else{
                new Requester().get(USER_CHECK_AUTH_URL).then(function(text){
                    resolve(text == "logged in");
                });
            }
        });
    });
}

function storeUserAuthStatus(isLoggedIn){
    var installedClasses = getInstalledStylesEl().classList;
    if (isLoggedIn){
        installedClasses.remove("notLoggedIn");
        installedClasses.add("loggedIn");
    }else{
        installedClasses.remove("loggedIn");
        installedClasses.add("notLoggedIn");
    }
}

function renderForAllCases(){
    getUserAuthStatus().then(storeUserAuthStatus);
    renderAllSwitch();
    getDisableAllCheckbox().addEventListener('change', onDisableAllCheckboxChange);
    setTimeout(function(){
        getDisableAllContainer().classList.add("animation-on");
    }, 200);
}

function onDisableAllCheckboxChange(){
    sendDisableAll(!this.checked).then(renderAllSwitch);
}

function bindHandlers(el, style){
    el.querySelector(".thumbnail_activate").addEventListener('click', onActivateClick(style));
    el.querySelector(".thumbnail_deactivate").addEventListener('click', onDeactivateClick(style));
    el.querySelector(".thumbnail_delete").addEventListener('click', onDeleteStyleClick(style));
    el.querySelector(".thumbnail_edit").addEventListener('click', onEditStyleClick(style));
}

function onEditStyleClick(style){
    return function(e){
	analyticsEventReport("Installed_styles_menu", "edit", style.styleId);
    };
}

function onActivateClick(style){
    return function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        enableStyle(style.id, true).then(onActivationStatusChanged(style.id, true));
	analyticsEventReport("Installed_styles_menu", "enable", style.styleId);
    };
}

function onDeactivateClick(style){
    return function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        enableStyle(style.id, false).then(onActivationStatusChanged(style.id, false));
	analyticsEventReport("Installed_styles_menu", "disable", style.styleId);
    }
}

function onDeleteStyleClick(style){
    return function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        deleteStyle(style.id).then(onStyleDeleted(style));
	analyticsEventReport("Installed_styles_menu", "delete", style.styleId);
    }
}

function onStyleDeleted(style){
    return function(){
        var old = document.getElementById("installed-style-"+style.id);
        var parent = old.parentNode;
        parent.removeChild(old);
        if (getInstalledStylesEl().childNodes.length == 0){
            renderPageForNoStyles();
        }
    }
}

function onActivationStatusChanged(styleId, enabled){
    return function(){
        var old = document.getElementById("installed-style-"+styleId);
        old.classList.remove(ENABLED_CLASS);
        old.classList.remove(DISABLED_CLASS);
        old.classList.add(enabled?ENABLED_CLASS : DISABLED_CLASS);
    }
}
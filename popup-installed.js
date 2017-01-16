/*jshint undef:false*/
var ENABLED_CLASS = "enabled",
    DISABLED_CLASS = "disabled";

function getActiveTabPromise() {
    return new Promise(function(resolve){
        chrome.tabs.query(
            {currentWindow: true, active: true}, function(tabs) {
                resolve(tabs[0]);
            }
        );
    });
}

function getZeroStylesEl(){
    return document.getElementById("zerostyles");
}

function getInstalledStylesEl(){
    var installed = document.getElementById("installed");
    if (installed){
        var getInstalledStylesEl = function(){
            return installed;
        };
    }
    return installed;
}

function getDisableAllCheckbox(){
    return document.getElementById("disable-all-checkbox");
}

function getDisableAllContainer(){
    return document.getElementById("disable-all-container");
}

function sendDisableAll(value){
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

function buildDomainForFiltering(url){
    var parsed = parseUrl(url);
    return parsed.protocol + "//" + parsed.hostname + "/";
}

getActiveTabPromise().then(function(currentTab){
    getInstalledStyleForDomain(buildDomainForFiltering(currentTab.url)).then(renderInstalledTab);
});

function renderInstalledTab(styles){
    if (styles.length === 0){
        renderPageForNoStyles();
    }else{
        renderPageWithStyles(styles);
    }

    renderForAllCases();
}

function renderPageForNoStyles(){

}

function renderPageWithStyles(styles){
    getZeroStylesEl().classList.add('hide');
    getInstalledStylesEl().classList.remove('hide');
    var sif = new StyleInfoFetcher().setRequester(new SessionCachedRequester());
    styles.forEach(function(style){
        sif.getStyleInfoByUrl(style.url).then(function(styleInfo){
            Object.assign(style, styleInfo);
            return style;
        }).then(addStyleToInstalled);
    });
}

function preProcessInstalledStyle(style){
    style.installs = style.weekly_installs;
    preProcessStyle(style);
    style.editButtonLabel = "edit";
    style.activateButtonLabel = "activate";
    style.deactivateButtonLabel = "deactivate";
    style.deleteButtonLabel = "delete";
    style.additionalClass = style.enabled ? "enabled" : "disabled";
    style.active_str = chrome.i18n.getMessage("styleActiveLabel") || "active";
    style.inactive_str = chrome.i18n.getMessage("styleInactiveLabel") || "inactive";
    style.style_edit_url = "edit.html?id=" + style.id;
    style.styleId = getOrParseStyleId(style);
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
    }else{
        getInstalledStylesEl().classList.remove("all-on");
        getInstalledStylesEl().classList.add("all-off");
    }
}

function renderForAllCases(){
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
}

function onActivateClick(style){
    return function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        enableStyle(style.id, true).then(onActivationStatusChanged(style.id, true));
    };
}

function onDeactivateClick(style){
    return function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        enableStyle(style.id, false).then(onActivationStatusChanged(style.id, false));
    };
}

function onDeleteStyleClick(style){
    return function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        deleteStyle(style.id).then(onStyleDeleted(style));
    };
}

function onStyleDeleted(style){
    return function(){
        var old = document.getElementById("installed-style-"+style.id);
        var parent = old.parentNode;
        parent.removeChild(old);
    };
}

function onActivationStatusChanged(styleId, enabled){
    return function(){
        var old = document.getElementById("installed-style-"+styleId);
        old.classList.remove(ENABLED_CLASS);
        old.classList.remove(DISABLED_CLASS);
        old.classList.add(enabled?ENABLED_CLASS : DISABLED_CLASS);
    };
}
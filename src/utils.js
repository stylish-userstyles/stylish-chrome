var utils = (function() {

    var parser = new UAParser();
    var browser = parser.getBrowser();
    // baidu browser user agent
    if(parser.getUA().indexOf("BIDU") !== -1){
        browser.name = "Baidu";
    }

    function getBrowser() {
        return browser;
    }

    function getSubID(){
        return localStorage.getItem("subid");
    }

    function setSubID(subId){
        return localStorage.setItem("subid", subId);
    }

    return {
        getBrowser:getBrowser,
        getSubID:getSubID,
        setSubID:setSubID
    };

})();
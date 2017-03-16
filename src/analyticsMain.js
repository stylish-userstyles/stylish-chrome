
// Standard Google Universal Analytics code
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga'); // Note: https protocol here

var gaID = "UA-8246384-4";
if(utils.getBrowser().name === "Baidu"){
  gaID = "UA-8246384-8";
}
ga('create', gaID, 'auto');
ga('set', 'checkProtocolTask', function(){}); // Removes failing protocol check. @see: http://stackoverflow.com/a/22152353/1958200
ga('send', 'pageview');

function analyticsMainEventReport(category, action, label, value){
  if (typeof ga === "function"){
    ga('send', 'event', category, action, label, value);
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  //console.log(request);
  if(request.gacategory)
    analyticsMainEventReport(request.gacategory, request.gaaction || null, request.galabel || null, request.gavalue || null);
});
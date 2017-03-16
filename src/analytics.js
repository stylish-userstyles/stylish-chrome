
function analyticsEventReport(category, action, label, value){
  chrome.runtime.sendMessage({gacategory: category, gaaction: action, galabel: label, gavalue: value});
}
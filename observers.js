"use strict";

// var observer = {observeContent: true, observeLoad: false};
var observer = {
	observeContent: localStorage["observer.observeFrameContent"] === "true",
	observeLoad: localStorage["observer.observeFrameLoad"] === "true"
};

function copyStyles(doc) {
	var styles = document.querySelectorAll('STYLE.stylish'),
		head = doc.documentElement;
	Array.prototype.forEach.call(styles, function(style) {
		head.appendChild( doc.importNode(style, true) );
	});
}

// observe Stylish STYLEs
var styleObserver = new MutationObserver(function(mutations) {
	var ff, doc, head,
		added = [],
		removed = [];
	mutations.forEach(function(mutation) {
		if ("childList" === mutation.type) {
			added = added.concat(Array.prototype.filter.call(mutation.addedNodes, function(node) {
				return "STYLE" === node.tagName && node.classList.contains("stylish")
			}));
			removed = removed.concat(Array.prototype.filter.call(mutation.removedNodes, function(node) {
				return "STYLE" === node.tagName && node.classList.contains("stylish")
			}));
		}
	});
	if (added.length > 0 || removed.length > 0) {
		ff = Array.prototype.filter.call(document.getElementsByTagName('iframe'), function(f) {
			try {doc = f.contentDocument} catch (e) {return false}
			head = /*doc.head*/doc.documentElement;
			if (added.length > 0) {
				added.forEach(function(style) {
					head.appendChild( doc.importNode(style, true) );
				});
			}
			if (removed.length > 0) {
				removed.forEach(function(style) {
					style = doc.getElementById(style.id);
					if (style) style.parentNode.removeChild(style);
				});
			}
			return true;
		});

		styleObserverReport(added, removed, ff);
	}
});
styleObserver.observe(document.documentElement, {childList: true, subtree: false}); // Stylish 1.3.0b

function styleObserverReport(added, removed, frames) {
	var str = "",
		now = new Date();

	str += added.length + " added";
	if (added.length > 0) str +=
		" (" +
		Array.prototype.map.call(added, function(style) {return style.id}).join(" ") +
		")";

	str += ", " + removed.length + " removed";
	if (removed.length > 0) str +=
		" (" +
		Array.prototype.map.call(removed, function(style) {return style.id}).join(" ") +
		")";

	console.log("%c styleObserver %s: %s from %i/%i IFRAMEs", "color:purple", now.toTimeString().substr(0,8), str, frames.length, window.frames.length);
};

// observe anonymous IFRAMEs
var iframeObserver = new MutationObserver(function(mutations) {
	var str = "",
		now = new Date(),
		styles, ff,
		added = [],
		removed = [],
		doc, head;
	mutations.forEach(function(mutation) {
		if ("childList" === mutation.type) {
			added = added.concat(Array.prototype.filter.call(mutation.addedNodes, function(node) {
				if ("IFRAME" === node.tagName) {
					try { doc = node.contentDocument; return true; } catch (e) { return false }
				}
			}));
			// reporter - removed IFRAMEs aren't of practical interest
			removed = removed.concat(Array.prototype.filter.call(mutation.removedNodes, function(node) {
				if ("IFRAME" === node.tagName) {
					try { doc = node.contentDocument; return true; } catch (e) { return false }
				}
			}));
			//
		}
	});
	if (added.length > 0 || removed.length > 0) {
		styles = document.querySelectorAll('STYLE.stylish');
		if (added.length > 0 && styles.length > 0) {
			added.forEach(function(f) {
				doc = f.contentDocument;
				head = doc.documentElement;
				Array.prototype.forEach.call(styles, function(style) {
					head.appendChild( doc.importNode(style, true) );
				});

				if (observer.observeContent) addContentObserver(f);
			});
		}

		// reporter
		console.log("%ciframeObserver %s: %s added, %s removed", "color:purple", now.toTimeString().substr(0,8), added.length, removed.length);
		//
	}
});
iframeObserver.observe(document, {childList: true, subtree: true});

// monitor IFRAME documentElement and its immediate children
var contentObservers = [];
function addContentObserver(frame) {
	var now = new Date(),
		doc = frame.contentDocument,
		observer;
	if (frame.hasAttribute("Eek")) {
		console.log("%caddContentObserver %s: already observing Eek=%s", "color:purple", now.toTimeString().substr(0,8), frame.getAttribute("Eek"));
	} else {
		frame.setAttribute("Eek", contentObservers.length);

		// observer html > * changes
		observer = new MutationObserver(simpleObserver);
		contentObservers.push(observer);
		observer.observe(doc.documentElement, {childList: true, subtree: false});

		// observer html changes
		observer = new MutationObserver(simpleObserver);
		contentObservers.push(observer);
		observer.observe(doc, {childList: true, subtree: false});		
	}
}

function simpleObserver(mutations) {
	var str = "",
		now = new Date(),
		added = [],
		removed = [],
		doc, head;
	mutations.forEach(function(mutation) {
		if ("childList" === mutation.type) {
			// reporter - added STYLEs aren't of practical interest
			Array.prototype.forEach.call(mutation.addedNodes, function(node) {
				console.log('%csimpleObserver %s: added %s id="%s" observer="%s"', "color:purple", now.toTimeString().substr(0,8), node.tagName, node.id, node.ownerDocument.defaultView.frameElement.getAttribute('Eek'));
			});
			//
			Array.prototype.forEach.call(mutation.removedNodes, function(node) {
					console.log('%csimpleObserver %s: removed %s id="%s" observer="%s"', "color:purple", now.toTimeString().substr(0,8), node.tagName, node.id, node.ownerDocument.defaultView.frameElement.getAttribute('Eek'));
			});
		}
	});
}

// Monitor IFRAME.onLoad for reloaded IFRAME content (and srcdoc)
function iframeOnLoad(event) {
	var doc,
		now = new Date();

	if ("IFRAME" === event.target.tagName) {
		try {doc = event.target.contentDocument} catch (e) {return}
		console.log("%ciframeOnLoad %s: src=%s, documentURI=%s", "color:purple", now.toTimeString().substr(0,8), event.target.src, event.target.contentDocument.documentURI);
		if (!doc.querySelector(".stylish")) {
			console.log("%cload %s: copying styles", "color:purple", now.toTimeString().substr(0,8));
			copyStyles(doc);
		}
	}
}
if (observer.observeLoad) document.addEventListener("load", iframeOnLoad, true);

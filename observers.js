"use strict";

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
			});
		}

		// reporter
		console.log("%ciframeObserver %s: %s added, %s removed", "color:purple", now.toTimeString().substr(0,8), added.length, removed.length);
		//
	}
});
iframeObserver.observe(document, {childList: true, subtree: true});

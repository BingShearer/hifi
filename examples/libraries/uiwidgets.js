//
//	uiwidgets.js
//	examples/libraries
//
//	Created by Seiji Emery, 8/10/15
//	Copyright 2015 High Fidelity, Inc
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//


(function(){

// Setup externals
(function() {

// We need a Vec2 impl, with add() and a clone function. If this is not part of hifi, we'll just add it:
if (this.Vec2 == undefined) {
	var Vec2 = this.Vec2 = function (x, y) {
		this.x = x || 0.0;
		this.y = y || 0.0;
	}
	Vec2.sum = function (a, b) {
		return new Vec2(a.x + b.x, a.y + b.y);
	}
	Vec2.clone = function (v) {
		return new Vec2(v.x, v.y);
	}
} else if (this.Vec2.clone == undefined) {
	print("Vec2 exists; adding Vec2.clone");
	this.Vec2.clone = function (v) {
		return { 'x': v.x || 0.0, 'y': v.y || 0.0 };
	}
} else {
	print("Vec2...?");
}
})();

var Rect = function (xmin, ymin, xmax, ymax) {
	this.x0 = xmin;
	this.y0 = ymin;
	this.x1 = xmax;
	this.y1 = ymax;
}
Rect.prototype.grow = function (pt) {
	this.x0 = Math.min(this.x0, pt.x);
	this.y0 = Math.min(this.y0, pt.y);
	this.x1 = Math.max(this.x1, pt.x);
	this.y1 = Math.max(this.y1, pt.y);
}
Rect.prototype.getWidth = function () {
	return this.x1 - this.x0;
}
Rect.prototype.getHeight = function () {
	return this.y1 - this.y0;
}
Rect.prototype.getTopLeft = function () {
	return { 'x': this.x0, 'y': this.y0 };
}
Rect.prototype.getBtmRight = function () {
	return { 'x': this.x1, 'y': this.y1 };
}
Rect.prototype.getCenter = function () {
	return { 
		'x': 0.5 * (this.x1 + this.x0),
		'y': 0.5 * (this.y1 + this.y0)
	};
}

var __trace = new Array();
var __traceDepth = 0;

var assert = function (cond, expr) {
	if (!cond) {
		var callstack = "";
		var maxRecursion = 10;
		caller = arguments.callee.caller;
		while (maxRecursion > 0 && caller) {
			--maxRecursion;
			callstack += ">> " + caller.toString();
			caller = caller.caller;
		}
		throw new Error("assertion failed: " + expr + " (" + cond + ")" + "\n" +
			"Called from: " + callstack + " " +
			"Traceback: \n\t" + __trace.join("\n\t"));
	}
}
var traceEnter = function(fcn) {
	var l = __trace.length;
	// print("TRACE ENTER: " + (l+1));
	s = "";
	for (var i = 0; i < __traceDepth+1; ++i)
		s += "-";
	++__traceDepth;
	__trace.push(s + fcn);
	__trace.push(__trace.pop() + ":" + this);
	return {
		'exit': function () {
			--__traceDepth;
			// while (__trace.length != l)
				// __trace.pop();
		}
	};
}

/// UI namespace
var UI = this.UI = {};

var rgb = UI.rgb = function (r, g, b) {
	if (typeof(r) == 'string') {
		rs = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(r);
		if (rs) {
			r = parseInt(rs[0], 16);
			g = parseInt(rs[1], 16);
			b = parseInt(rs[2], 16);
		}
	}
	if (typeof(r) != 'number' || typeof(g) != 'number' || typeof(b) != 'number') {
		ui.err("Invalid args to UI.rgb (" + r + ", " + g + ", " + b + ")");
		return null;
	}
	return { 'r': r, 'g': g, 'b': b };
}
var rgba = UI.rgba = function (r, g, b, a) {
	if (typeof(r) == 'string')
		return rgb(r);
	return { 'r': r || 0, 'g': g || 0, 'b': b || 0, 'a': a };
}

/// Protected UI state
var ui = {
	defaultVisible: true,
	widgetList: new Array(),
	attachmentList: new Array()
};

ui.complain = function (msg) {
	print("WARNING (uiwidgets.js): " + msg);
}
ui.errorHandler = function (err) {
	print(err);
}
ui.assert = function (condition, message) {
	if (!condition) {
		message = "FAILED ASSERT (uiwidgets.js): " + message || "(" + condition + ")";
		ui.errorHandler(message);
		if (typeof(Error) !== 'undefined')
			throw new Error(message);
		throw message;
	}
}

UI.setDefaultVisibility = function (visible) {
	ui.defaultVisible = visible;
}

/// Wrapper around the overlays impl
function makeOverlay(type, properties) {
	var _TRACE  = traceEnter.call(this, "makeOverlay");
	var overlay = Overlays.addOverlay(type, properties);
	// overlay.update = function (properties) {
	// 	Overlays.editOverlay(overlay, properties);
	// }
	// overlay.destroy = function () {
	// 	Overlays.deleteOverlay(overlay);
	// }
	// return overlay;
	_TRACE.exit();
	return {
		'update': function (properties) {
			var _TRACE = traceEnter.call(this, "Overlay.update");
			Overlays.editOverlay(overlay, properties);
			_TRACE.exit();
		},
		'destroy': function () {
			var _TRACE = traceEnter.call(this, "Overlay.destroy");
			Overlays.deleteOverlay(overlay);
			_TRACE.exit();
		},
		'getId': function () {
			return overlay;
		}
	}
}

var COLOR_WHITE = rgb(255, 255, 255);
var COLOR_GRAY  = rgb(125, 125, 125);

/// Base widget class.
var Widget = function () {};

// Shared methods:
var __widgetId = 0;
Widget.prototype.constructor = function () {
	this.position = { 'x': 0.0, 'y': 0.0 };
	this.dimensions = null;

	this.visible = ui.defaultVisible;
	this.parentVisible = null;

	this.actions = {};
	this._dirty = true;
	this.parent = null;

	this.id = __widgetId++;
	ui.widgetList.push(this);
}
Widget.prototype.setPosition = function (x, y) {
	if (arguments.length == 1 && typeof(arguments[0]) == 'object') {
		x = arguments[0].x;
		y = arguments[0].y;
	}
	if (typeof(x) != 'number' || typeof(y) != 'number') {
		ui.complain("invalid arguments to " + this + ".setPosition: '" + arguments + "' (expected (x, y) or (vec2))");
	} else {
		this.position.x = x;
		this.position.y = y;
	}
}
Widget.prototype.setVisible = function (visible) {
	this.visible = visible;
	this.parentVisible = null;	// set dirty
}
Widget.prototype.isVisible = function () {
	if (this.parentVisible === null)
		this.parentVisible = this.parent ? this.parent.isVisible() : true;
	return this.visible && this.parentVisible;
}
// Store lists of actions (multiple callbacks per key)
Widget.prototype.addAction = function (action, callback) {
	if (!this.actions[action])
		this.actions[action] = [ callback ];
	else
		this.actions[action].push(callback);
}
Widget.prototype.clearLayout = function () {
	this.dimensions = null;
	this.parentVisible = null;
}
// Overridden methods:
Widget.prototype.toString = function () {
	return "[Widget " + this.id + " ]";
}
Widget.prototype.getOverlay = function () {
	return null;
}
Widget.prototype.getWidth = function () {
	return 0;
}
Widget.prototype.getHeight = function () {
	return 0;
}
Widget.prototype.hasOverlay = function () {
	return false;
}

/// Implements a simple auto-layouted container of methods.
///	@param properties
///		dir: [string]
///			layout direction. 
///			Can be one of [ '+x', '+y', '-x', '-y' ] for 2d directions.
///		border: { x: _, y: _ } 
///			Adds spacing to the widget on all sides (aka. margin). Defaults to 0.
///		padding: { x: _, y: _ }
///			Padding in between each widget. Only one axis is used (the layout direction).
///		visible: true | false
///			Acts as both a widget (logical) property and is used for overlays.
///			Hiding this will hide all child widgets (non-destructively).
///			Do not access this directly -- use setVisible(value) and isVisible() instead.
///		background: [object] 
///			Properties to use for the background overlay (if defined).
///
var WidgetStack = UI.WidgetStack = function (properties) {
	var _TRACE = traceEnter.call(this, "WidgetStack.constructor()");
	Widget.prototype.constructor.call(this);
	assert(ui.widgetList[ui.widgetList.length-1] === this, "ui.widgetList.back() == this");

	properties = properties || {};
	properties['dir'] = properties['dir'] || '+y';

	var dir = undefined;
	switch(properties['dir']) {
		case '+y': dir = { 'x': 0.0, 'y': 1.0 }; break;
		case '-y': dir = { 'x': 0.0, 'y': -1.0 }; break;
		case '+x': dir = { 'x': 1.0, 'y': 0.0 }; break;
		case '-x': dir = { 'x': -1.0, 'y': 0.0 }; break;
		default: ui.complain("Unrecognized UI.WidgetStack property 'dir': \"" + dir + "\"");
	}
	dir = dir || { 'x': 1.0, 'y': 0.0 };

	this.layoutDir = dir;
	this.border  = properties.border  || { 'x': 0.0, 'y': 0.0 };
	this.padding = properties.padding || { 'x': 0.0, 'y': 0.0 };
	this.visible = properties.visible != undefined ? properties.visible : this.visible;

	if (properties.background) {
		var background = properties.background;
		background.x = this.position ? this.position.x : 0;
		background.y = this.position ? this.position.y : 0;
		background.width  = background.width  || 100.0;
		background.height = background.height || 100.0;
		background.backgroundColor = background.backgroundColor || COLOR_GRAY;
		background.backgroundAlpha = background.backgroundAlpha || 0.5;
		background.textColor = background.textColor || COLOR_WHITE;
		background.alpha = background.alpha || 1.0;
		background.visible = this.visible;
		this.backgroundOverlay = makeOverlay("text", background);
	} else {
		this.backgroundOverlay = null;
	}

	this.widgets = new Array();

	_TRACE.exit();
}
WidgetStack.prototype = new Widget();
WidgetStack.prototype.constructor = WidgetStack;

WidgetStack.prototype.toString = function () {
	return "[WidgetStack " + this.id + " ]";
}

WidgetStack.prototype.add = function (widget) {
	this.widgets.push(widget);
	widget.parent = this;
	return widget;
}
WidgetStack.prototype.hasOverlay = function (overlayId) {
	return this.backgroundOverlay && this.backgroundOverlay.getId() === overlayId;
}
WidgetStack.prototype.getOverlay = function () {
	return this.backgroundOverlay;
}
WidgetStack.prototype.destroy = function () {
	if (this.backgroundOverlay) {
		this.backgroundOverlay.destroy();
		this.backgroundOverlay = null;
	}
}
WidgetStack.prototype.setColor = function (color) {
	if (arguments.length != 1) {
		color = rgba.apply(arguments);
	}
	this.backgroundOverlay.update({
		'color': color,
		'alpha': color.a
	});
}

var Icon = UI.Icon = function (properties) {
	var _TRACE = traceEnter.call(this, "Icon.constructor()");
	Widget.prototype.constructor.call(this);

	this.visible = properties.visible != undefined ? properties.visible : this.visible;
	this.width  = properties.width  || 1.0;
	this.height = properties.height || 1.0;

	var iconProperties = {
		'color':    properties.color || COLOR_GRAY,
		'alpha':    properties.alpha || 1.0,
		'imageURL': properties.imageURL,
		'width':  this.width,
		'height': this.height,
		'x': this.position ? this.position.x : 0.0,
		'y': this.position ? this.position.y : 0.0,
		'visible': this.visible
	}
	this.iconOverlay = makeOverlay("image", iconProperties);
	_TRACE.exit()
}
Icon.prototype = new Widget();
Icon.prototype.constructor = Icon;
Icon.prototype.toString = function () {
	return "[UI.Icon " + this.id + " ]";
}
Icon.prototype.getHeight = function () {
	return this.height;
}
Icon.prototype.getWidth = function () {
	return this.width;
}
Icon.prototype.hasOverlay = function (overlayId) {
	return this.iconOverlay.getId() === overlayId;
}
Icon.prototype.getOverlay = function () {
	return this.iconOverlay;
}

Icon.prototype.destroy = function () {
	if (this.iconOverlay) {
		this.iconOverlay.destroy();
		this.iconOverlay = null;
	}
}
Icon.prototype.setColor = function (color) {
	if (arguments.length != 1) {
		color = rgba.apply(arguments);
	}
	this.iconOverlay.update({
		'color': color,
		'alpha': color.a
	});
}

// New layout functions
Widget.prototype.applyLayout = function () {};
Widget.prototype.updateOverlays = function () {};


Icon.prototype.getWidth = function () {
	return this.width;
}
Icon.prototype.getHeight = function () {
	return this.height;
}
Icon.prototype.updateOverlays = function () {
	this.iconOverlay.update({
		width: this.width,
		height: this.height,
		x: this.position.x,
		y: this.position.y,
		visible: this.isVisible()
	});
}

var sumOf = function (list, f) {
	var sum = 0.0;
	list.forEach(function (elem) {
		sum += f(elem);
	})
	return sum;
}
WidgetStack.prototype.calculateDimensions = function () {
	var totalWidth = 0.0, maxWidth = 0.0;
	var totalHeight = 0.0, maxHeight = 0.0;
	this.widgets.forEach(function (widget) {
		totalWidth += widget.getWidth() + this.padding.x;
		maxWidth = Math.max(maxWidth, widget.getWidth());

		totalHeight += widget.getHeight() + this.padding.y;
		maxHeight = Math.max(maxHeight, widget.getHeight());
	}, this);

	this.dimensions = {
		x: this.border.x * 2 + Math.max(totalWidth * this.layoutDir.x - this.padding.x, maxWidth),
		y: this.border.y * 2 + Math.max(totalHeight * this.layoutDir.y - this.padding.y, maxHeight)
	};
}
WidgetStack.prototype.getWidth = function () {
	if (!this.dimensions)
		this.calculateDimensions();
	return this.dimensions.x;
}
WidgetStack.prototype.getHeight = function () {
	if (!this.dimensions)
		this.calculateDimensions();
	return this.dimensions.y;
}
WidgetStack.prototype.applyLayout = function () {
	print("Applying layout " + this);
	var x = this.position.x + this.border.x;
	var y = this.position.y + this.border.y;

	this.widgets.forEach(function (widget) {
		widget.setPosition(x, y);
		print("setting position for " + widget + ": " + x + ", " + y)
		x += (widget.getWidth()  + this.padding.x) * this.layoutDir.x;
		y += (widget.getHeight() + this.padding.y) * this.layoutDir.y;
		widget._parentVisible = this.isVisible();
	}, this);
}
WidgetStack.prototype.updateOverlays = function () {
	this.backgroundOverlay.update({
		width:  this.getWidth(),
		height: this.getHeight(),
		x: this.position.x,
		y: this.position.y,
		visible: this.isVisible()
	});
}
UI.addAttachment = function (target, rel, update) {
	attachment = {
		target: target,
		rel: rel,
		applyLayout: update
	};
	ui.attachmentList.push(attachment);
	return attachment;
}


UI.updateLayout = function () {
	// Recalc dimensions
	ui.widgetList.forEach(function (widget) {
		widget.clearLayout();
	});

	function insertAndPush (list, index, elem) {
		if (list[index])
			list[index].push(elem);
		else
			list[index] = [ elem ];
	}

	// Generate attachment lookup
	var attachmentDeps = {};
	ui.attachmentList.forEach(function(attachment) {
		insertAndPush(attachmentDeps, attachment.target.id, {
			dep: attachment.rel,
			eval: attachment.applyLayout
		});
	});
	updated = {};

	// Walk the widget list and relayout everything
	function recalcLayout (widget) {
		// Short circuit if we've already updated
		if (updated[widget.id])
			return;

		// Walk up the tree + update top level first
		if (widget.parent)
			recalcLayout(widget.parent);

		// Resolve and apply attachment dependencies
		if (attachmentDeps[widget.id]) {
			attachmentDeps[widget.id].forEach(function (attachment) {
				recalcLayout(attachment.dep);
				attachment.eval(widget, attachment.dep);
			});
		}

		widget.applyLayout();
		updated[widget.id] = true;
	}
	ui.widgetList.forEach(recalcLayout);

	ui.widgetList.forEach(function (widget) {
		widget.updateOverlays();
	});
}

UI.setDefaultVisibility = function(visibility) {
	ui.defaultVisible = visibility;
};

function dispatchEvent(actions, widget, event) {
	var _TRACE = traceEnter.call(this, "UI.dispatchEvent()");
	actions.forEach(function(action) {
		action.call(widget, event);
	});
	_TRACE.exit();
}

ui.focusedWidget = null;
ui.clickedWidget = null;

var getWidgetWithOverlay = function (overlay) {
	// print("trying to find overlay: " + overlay);

	var foundWidget = null;
	ui.widgetList.forEach(function(widget) {
		if (widget.hasOverlay(overlay)) {
			// print("found overlay in " + widget);
			foundWidget = widget;
			return;
		}
	});
	// if (!foundWidget)
		// print("could not find overlay");
	return foundWidget;
}

var getFocusedWidget = function (event) {
	return getWidgetWithOverlay(Overlays.getOverlayAtPoint({ 'x': event.x, 'y': event.y }));
}

var dispatchEvent = function (action, event, widget) {
	function dispatchActions (actions) {
		actions.forEach(function(action) {
			action(event, widget);
		});
	}

	if (widget.actions[action]) {
		print("Dispatching action '" + action + "'' to " + widget);
		dispatchActions(widget.actions[action]);
	} else {
		for (var parent = widget.parent; parent != null; parent = parent.parent) {
			if (parent.actions[action]) {
				print("Dispatching action '" + action + "'' to parent widget " + widget);
				dispatchActions(parent.actions[action]);
				return;
			}
		}
		print("No action '" + action + "' in " + widget);
	}
}

UI.handleMouseMove = function (event) {
	// print("mouse moved x = " + event.x + ", y = " + event.y);
	var focused = getFocusedWidget(event);

	print("got focus: " + focused);

	if (focused != ui.focusedWidget) {
		if (focused)
			dispatchEvent('onMouseOver', event, focused);
		if (ui.focusedWidget)
			dispatchEvent('onMouseExit', event, ui.focusedWidget);
		ui.focusedWidget = focused;
	}
}

UI.handleMousePress = function (event) {
	print("Mouse clicked");
	UI.handleMouseMove(event);
	if (ui.focusedWidget) {
		ui.clickedWidget = ui.focusedWidget;
		dispatchEvent('onMouseDown', event, ui.focusedWidget);
	}
}

UI.handleMouseRelease = function (event) {
	print("Mouse released");
	UI.handleMouseMove(event);
	if (ui.focusedWidget) {
		dispatchEvent('onMouseUp', event, ui.focusedWidget);

		if (ui.clickedWidget == ui.focusedWidget) {
			dispatchEvent('onClick', event, ui.focusedWidget);
		}
		ui.clickedWidget = null;;
	}
}

UI.teardown = function () {
	print("Teardown");
	ui.widgetList.forEach(function(widget) {
		widget.destroy();
	});
	ui.widgetList = [];
	ui.focusedWidget = null;
};
UI.setErrorHandler = function (errorHandler) {
	if (typeof(errorHandler) !== 'function') {
		ui.complain("UI.setErrorHandler -- invalid argument: \"" + errorHandler + "\"");
	} else {
		ui.errorHandler = errorHandler;
	}
}

UI.printWidgets = function () {
	print("widgetlist.length = " + ui.widgetList.length);
	ui.widgetList.forEach(function(widget) {
		print(""+widget + " position=(" + widget.position.x + ", " + widget.position.y + ")" + 
			" parent = " + widget.parent + " visible = " + widget.isVisible() + 
			" width = " + widget.getWidth() + ", height = " + widget.getHeight() +
			" overlay = " + (widget.getOverlay() && widget.getOverlay().getId()) +
			(widget.border ? " border = " + widget.border.x + ", " + widget.border.y : "") + 
			(widget.padding ? " padding = " + widget.padding.x + ", " + widget.padding.y : ""));
	});
}

})();

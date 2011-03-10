// This file contains (most of) the required modifications to Dojo/Dijit in order to
// use the Closure Compiler with Advanced optimizations 

// Global functions to handle property name maps

/** @param {...} v_args 
 */
function closureEmpty(v_args) {};

/** @param {!Object.<string>} map
 *  @return {string}
 */
function closureGetMappedPropertyName(map)
{
	for (/** @type {string} */ var propname in map) {
		if (map.hasOwnProperty(propname)) return propname;
	}

	return "";
};

/** @param {function(Object=)} type
 *  @param {string} name
 *  @param {boolean=} reverse
 *  @return {string}
 */
function closureMapPropertyName(type, name, reverse) 
{
	if (reverse) {
		for (var mapped in closurePropertyNamesMap) {
			if (!closurePropertyNamesMap.hasOwnProperty(mapped)) continue;
			if (name === closurePropertyNamesMap[mapped]) return mapped;
		}
	} else {
		if (closurePropertyNamesMap.hasOwnProperty(name)) return closurePropertyNamesMap[name];
	}

	/*
	while (type && type.prototype) 
	{
		if (type.prototype._propNameMap) {
			if (reverse) {
				for (var mapped in type.prototype._propNameMap) {
					if (!type.prototype._propNameMap.hasOwnProperty(mapped)) continue;
					if (name === type.prototype._propNameMap[mapped]) return mapped;
				}
			} else {
				if (type.prototype._propNameMap.hasOwnProperty(name)) return type.prototype._propNameMap[name];
			}
		}
		
		type = type.superclass ? type.superclass.constructor : null; 
	}
	*/

	return name;
};


/** @param {!Object.<string>} map
 */
function closureAddPropertyNamesMap(map) 
{
	dojo.mixin(closurePropertyNamesMap, map);
};


// Replace Dijit functions to handle property name maps

/** @param {string} attr
 *  @param {string} value
 */
dijit._WidgetBase.prototype._attrToDom = function(attr, value)
{
	var commands = this.attributeMap[attr];
	dojo.forEach(dojo.isArray(commands) ? commands : [commands], function(command)
	{
		var nodeName = command.node || command || "domNode";
		if (!(nodeName in this)) nodeName = closureMapPropertyName(this.constructor, nodeName);

		var mapNode = this[nodeName];
		var type = command.type || "attribute";

		switch(type){
			case "attribute":
				if(dojo.isFunction(value)){
					value = dojo.hitch(this, value);
				}

				var attrName = command.attribute ? command.attribute :
					(/^on[A-Z][a-zA-Z]*$/.test(attr) ? attr.toLowerCase() : attr);

				dojo.attr(mapNode, attrName, value);
				break;
			case "innerText":
				mapNode.innerHTML = "";
				mapNode.appendChild(dojo.doc.createTextNode(value));
				break;
			case "innerHTML":
				mapNode.innerHTML = value;
				break;
			case "class":
				dojo.removeClass(mapNode, this[attr]);
				dojo.addClass(mapNode, value);
				break;
		}
	}, this);
	this[attr] = value;
};

/** @param {string} name
 *  @return {*}
 */
dijit._WidgetBase.prototype.get = function(name)
{
	var names = this._getAttrNames(name);
	if (!(name in this)) name = closureMapPropertyName(this.constructor, name);
	return this[names.g] ? this[names.g]() : this[name];
};

/** @param {string} name
 *  @param {*} value
 */
dijit._WidgetBase.prototype.set = function(name, value)
{
	if(typeof name === "object") {
		for(var x in name){
			// We need to reverse-map the object field names to its original names
			var fullname = closureMapPropertyName(this.constructor, x, true);
			this.set(fullname, name[x]); 
		}
		return this;
	}

	var names = this._getAttrNames(name);

	if(this[names.s]) {
		// use the explicit setter
		var result = this[names.s].apply(this, Array.prototype.slice.call(arguments, 1));
	} else {
		// if param is specified as DOM node attribute, copy it
		var realname = closureMapPropertyName(this.constructor, name);

		if(name in this.attributeMap) {
			this._attrToDom(name, value);
		} else if (realname in this.attributeMap) {
			this._attrToDom(realname, value);
		}
		var oldValue = this[realname];
		// FIXME: what about function assignments? Any way to connect() here?
		this[realname] = value;
	}
	return result || this;
};

/** @param {string} name
 *  @return {{n:string, s:string, g:string}}
 */
dijit._WidgetBase.prototype._getAttrNames = function(name)
{
	var apn = this._attrPairNames;
	if(apn[name]){ return apn[name]; }
	var uc = name.charAt(0).toUpperCase() + name.substr(1);

	return (apn[name] = {
		n: closureMapPropertyName(this.constructor, name+"Node"),
		s: closureMapPropertyName(this.constructor, "_set"+uc+"Attr"),
		g: closureMapPropertyName(this.constructor, "_get"+uc+"Attr")
	});
};

dijit._WidgetBase.prototype._applyAttributes = function()
{
	var condAttrApply = function(attr, scope) {
		// attr=mangled name
		if((scope.params && attr in scope.params) || scope[attr]){
			scope.set(attr, scope[attr]);
		}
	};

	for(var attr in this.attributeMap)
	{
		// attr is either full name or mangled name
		var mapped = closureMapPropertyName(this.constructor, attr);
		condAttrApply(mapped, this);
	}

	dojo.forEach(this._getSetterAttributes(), function(a)
	{
		// a=mangled name
		if(!(a in this.attributeMap) && !(closureMapPropertyName(this.constructor, a, true) in this.attributeMap)){
			condAttrApply(a, this);
		}
	}, this);
};

/** @return {!Array.<string>} */
dijit._WidgetBase.prototype._getSetterAttributes = function()
{
	var ctor = this.constructor;

	if(!ctor._setterAttrs) {
		var r = (ctor._setterAttrs = []), attrs, proto = ctor.prototype;
		
		for (var fxName in proto) {
			var fullname = closureMapPropertyName(ctor, fxName, true);
			if (dojo.isFunction(proto[fxName]) && (attrs = fullname.match(/^_set([a-zA-Z]*)Attr$/)) && attrs[1]) {
				var propname = attrs[1].charAt(0).toLowerCase() + attrs[1].substr(1);
				r.push(closureMapPropertyName(ctor, propname));
			}
		}
	}

	return ctor._setterAttrs;
},

/** @param {string} tmpl
 *  @return {string}
 */
dijit._Templated.prototype._stringRepl = function(tmpl)
{
	var className = this.declaredClass;

	return dojo.string.substitute(tmpl, this, function(value, key)
	{
		value = this.get(key.charAt(0) == '!' ? key.substr(1) : key); 
		 
		if(typeof value == "undefined") { throw new Error(className+" template:"+key); }
		if(value == null) { return ""; }

		return key.charAt(0) == "!" ? value : value.toString().replace(/"/g,"&quot;");
	}, this);
};

// Add property name maps for common Dijit types

closureAddPropertyNamesMap( 
{
	widgetId: "widgetId",
	_getWidgetIdAttr: "_getWidgetIdAttr",
	_setWidgetIdAttr: "_setWidgetIdAttr",
	title: "title",
	value: "value",
	_getValueAttr: "_getValueAttr",
	_setValueAttr: "_setValueAttr",
	disabled: "disabled",
	_getDisabledAttr: "_getDisabledAttr",
	_setDisabledAttr: "_setDisabledAttr",
	hidden: "hidden",
	_getHiddenAttr: "_getHiddenAttr",
	_setHiddenAttr: "_setHiddenAttr",
	// dijit.Dialog
	duration: "duration",
	titleBar: "titleBar",	// Template attach-point
	titleNode: "titleNode",	// Template attach-point
	closeButtonNode: "closeButtonNode",	// Template attach-point
	closeText: "closeText",	// Template attach-point
	// dijit.DialogUnderlay
	dialogId: "dialogId",
	_getDialogIdAttr: "_getDialogIdAttr",
	_setDialogIdAttr: "_setDialogIdAttr",
	// dijit.layout.ContentPane
	content: "content",
	_getContentAttr: "_getContentAttr",
	_setContentAttr: "_setContentAttr"
});

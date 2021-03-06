// This file contains (most of) the required modifications to Dojo/Dijit in order to
// use the Closure Compiler with Advanced optimizations 

// Some i18n modules are loaded via dojo._loadedModules

dojo._loadedModules["dijit.nls.loading"] = dijit.nls.loading;
dojo._loadedModules["dijit.nls.common"] = dijit.nls.common;
dojo._loadedModules["dojo.cldr.nls.number"] = dojo.cldr.nls.number; 
dojo._loadedModules["dojo.cldr.nls.gregorian"] = dojo.cldr.nls.gregorian; 

// Global functions to handle property name maps

/** @param {...} v_args 
 */
function closureEmpty(v_args) {};

/** @param {!Object.<string>} map
 *  @return {!Object.<string>}
 */
function closureTranspose(map)
{
	/** @const */ var result = {};
	
	for (/** @type {string} */ var propname in map) {
		if (map.hasOwnProperty(propname) && map[propname] !== propname) result[map[propname]] = propname;
	}

	return result;
};

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

/** @param {Function} type
 *  @param {string} name
 *  @return {string}
 */
function closureMapPropertyName(type, name) 
{
	return (closurePropertyNamesMap[name] || name);
};


/** @param {Function} type
 *  @param {string} name
 *  @return {string}
 */
function closureReverseMapPropertyName(type, name) 
{
	for (var mapped in closurePropertyNamesMap) {
		if (!closurePropertyNamesMap.hasOwnProperty(mapped)) continue;
		if (name === closurePropertyNamesMap[mapped]) return mapped;
	}
	return name;
};


/** @param {!Object.<string>} map
 */
function closureAddPropertyNamesMap(map) 
{
	dojo.mixin(closurePropertyNamesMap, closureTranspose(map));
};



// Replace Dijit functions to handle property name maps

if (dojo.getObject("dijit._WidgetBase")) 
{
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
				var fullname = closureReverseMapPropertyName(this.constructor, x);
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
			if(name in this.attributeMap) {
				this._attrToDom(name, value.toString());
			} else {
				var realname = closureMapPropertyName(this.constructor, name);
				if (realname in this.attributeMap) {
					this._attrToDom(realname, value.toString());
				}
			} 
			this._set(name, value);
		}
		return result || this;
	};
	
	/** @param {string} name
	 *  @param {*} value
	 */
	dijit._WidgetBase.prototype._set = function(name, value)
	{
		var realname = closureMapPropertyName(this.constructor, name);
	
		var oldValue = this[realname];
		this[realname] = value;
		if(this._watchCallbacks && this._created && value !== oldValue){
			this._watchCallbacks(name, oldValue, value);
		}
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
			if(!(a in this.attributeMap) && !(closureReverseMapPropertyName(this.constructor, a) in this.attributeMap)){
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
				var fullname = closureReverseMapPropertyName(ctor, fxName);
				if (dojo.isFunction(proto[fxName]) && (attrs = fullname.match(/^_set([a-zA-Z]*)Attr$/)) && attrs[1]) {
					var propname = attrs[1].charAt(0).toLowerCase() + attrs[1].substr(1);
					r.push(closureMapPropertyName(ctor, propname));
				}
			}
		}
	
		return ctor._setterAttrs;
	};
}

if (dojo.getObject("dijit._Templated")) 
{
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
}

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
	onCancel: "onCancel",	// Template attach-point
	// dijit.DialogUnderlay
	dialogId: "dialogId",
	_getDialogIdAttr: "_getDialogIdAttr",
	_setDialogIdAttr: "_setDialogIdAttr",
	// dijit.layout.ContentPane
	content: "content",
	_getContentAttr: "_getContentAttr",
	_setContentAttr: "_setContentAttr"
});

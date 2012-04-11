var exports = exports || {};
var require = function (module) {
	return exports[module];
};

function uuid() {
	function S4() {
   		return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
	}

	return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

// return json representation of qeyrid
function buildJsonQueryId(type,value) {
	if (!type)
		throw "query type must specified for the query"
	
	var obj = {}
	value = value || null
	obj[type] = value;
	return JSON.stringify( obj );
}
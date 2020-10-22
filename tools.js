exports.init = () => {
	if (!String.prototype.padStart) {
		String.prototype.padStart = function padStart(targetLength,padString) {
			targetLength = targetLength>>0; //truncate if number or convert non-number to 0;
			padString = String((typeof padString !== 'undefined' ? padString : ' '));
			if (this.length > targetLength) {
				return String(this);
			}
			else {
				targetLength = targetLength-this.length;
				if (targetLength > padString.length) {
					padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
				}
				return padString.slice(0,targetLength) + String(this);
			}
		};
	}

	if (!String.prototype.padEnd) {
		String.prototype.padEnd = function padEnd(targetLength,padString) {
			targetLength = targetLength>>0; //floor if number or convert non-number to 0;
			padString = String((typeof padString !== 'undefined' ? padString : ' '));
			if (this.length > targetLength) {
				return String(this);
			}
			else {
				targetLength = targetLength-this.length;
				if (targetLength > padString.length) {
					padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
				}
				return String(this) + padString.slice(0,targetLength);
			}
		};
	}
	
	//based on filter polyfill
	if (!Array.prototype.count)
		Object.defineProperties(Array.prototype, {
			count: {
				value: function(fun/*, thisArg*/) {
					'use strict';

					if (this === void 0 || this === null)
						throw new TypeError();

					var t = Object(this);
					var len = t.length >>> 0;
					if (typeof fun !== 'function')
						throw new TypeError();

					var res = 0;
					var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
					for (var i = 0; i < len; i++)
						if (i in t && fun.call(thisArg, t[i], i, t))
							res++;
					
					return res;
				}
			}
		});
}
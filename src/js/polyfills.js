// Polyfills for older browsers
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

if (!Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;
    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

// FormData polyfill for older browsers
if (typeof window.FormData !== 'function') {
  window.FormData = function() {
    this.data = {};
    this.append = function(key, value) {
      this.data[key] = value;
    };
  };
}

// Promise polyfill for older browsers
if (!window.Promise) {
  window.Promise = function(executor) {
    var callbacks = [];
    var value;
    var state = 'pending';

    function resolve(val) {
      state = 'fulfilled';
      value = val;
      callbacks.forEach(function(callback) {
        callback(value);
      });
    }

    executor(resolve);

    return {
      then: function(callback) {
        if (state === 'pending') {
          callbacks.push(callback);
        } else {
          callback(value);
        }
        return this;
      }
    };
  };
}

// Fetch polyfill for older browsers
if (!window.fetch) {
  window.fetch = function(url, options) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', url);
      
      if (options.headers) {
        Object.keys(options.headers).forEach(function(key) {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }

      xhr.onload = function() {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: function() {
            return Promise.resolve(JSON.parse(xhr.response));
          }
        });
      };

      xhr.onerror = function() {
        reject(new Error('Network request failed'));
      };

      xhr.send(options.body);
    });
  };
}
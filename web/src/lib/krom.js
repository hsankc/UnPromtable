(function () {
  var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=#$%*';

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function randomText(n, set) {
    var s = '';
    for (var i = 0; i !== n; i++) s += set.charAt(Math.floor(Math.random() * set.length));
    return s;
  }

  function cipher(el, opts) {
    opts = opts || {};
    var set = opts.charset || CHARS;
    var interval = opts.interval || 140;
    var layers = el.querySelectorAll('.krom-cipher__field, .krom-cipher__glow');
    function count() {
      var r = el.getBoundingClientRect();
      return Math.max(240, Math.ceil((r.width * r.height) / 120));
    }
    function paint() {
      var t = randomText(count(), set);
      for (var i = 0; i !== layers.length; i++) layers[i].textContent = t;
    }
    paint();
    if (reduced()) return function () {};
    var id = setInterval(paint, interval);
    return function () { clearInterval(id); };
  }

  function autoInit(root) {
    var nodes = (root || document).querySelectorAll('[data-krom-cipher]');
    for (var i = 0; i !== nodes.length; i++) {
      if (!nodes[i].__kromStop) nodes[i].__kromStop = cipher(nodes[i]);
    }
  }

  window.Krom = { cipher: cipher, autoInit: autoInit };
})();

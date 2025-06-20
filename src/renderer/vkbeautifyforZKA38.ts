//vkbeautifyforZKA38.ts
// vkBeautify - für ZKA 3.8: Standardausgabe KEINE Whitespaces, formatierte Ausgabe nur auf Button
(function () {
  function createShiftArr(step) {
    const space = typeof step === 'string' ? step : ' '.repeat(step || 2);
    const shift = [''];
    for (let i = 0; i < 100; i++) {
      shift.push(shift[i] + space);
    }
    return shift;
  }

  function vkbeautify() {
    this.step = '  ';
    this.shift = createShiftArr(this.step);
  }

  // Standardausgabe: KEINE Whitespaces, keine \n, keine Tabs
  vkbeautify.prototype.xml = function (text) {
    return text.replace(/>\s+</g, '><').trim();
  };

  // ZKA3.8-formatierte Ausgabe: Zeilenumbrüche nur zwischen Tags, NIE Whitespaces/Tabs in Tags
  vkbeautify.prototype.xml_zka38 = function (text) {
    return text
      .replace(/>\s+</g, '><')
      .replace(/></g, '>\n<')
      .replace(/^[ \t]+|[ \t]+$/gm, '')
      .trim();
  };

  vkbeautify.prototype.json = function (text, step) {
    if (typeof JSON === 'undefined') return text;
    return JSON.stringify(typeof text === 'string' ? JSON.parse(text) : text, null, step || this.step);
  };

  vkbeautify.prototype.sql = function (text, step) {
    const shift = step ? createShiftArr(step) : this.shift;
    return text.replace(/\s{1,}/g, " ")
      .replace(/(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|ON|AND|OR)\s+/gi, match => `~::~${match}`)
      .split('~::~')
      .map(line => shift[1] + line)
      .join('\n');
  };

  window.vkbeautifyforZKA38 = new vkbeautify();
})();
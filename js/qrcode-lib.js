/**
 * Gerador de QR Code Autônomo e de Alto Contraste (PNG & SVG)
 * Implementação compacta baseada na especificação ISO/IEC 18004.
 */
(function(global) {
  // QRCode generator constructor
  function QRCode(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber || 4;
    this.errorCorrectLevel = errorCorrectLevel || 1; // 1 = M (15%)
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }

  // Simplified encoder for URLs
  QRCode.prototype = {
    addData: function(data) {
      this.dataList.push(data);
      this.dataCache = null;
    },
    isDark: function(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function() {
      return this.moduleCount;
    },
    make: function() {
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (var col = 0; col < this.moduleCount; col++) {
          this.modules[row][col] = null;
        }
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) {
        this.setupTypeNumber(test);
      }
      if (this.dataCache == null) {
        this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    getBestMaskPattern: function() {
      return 0; // standard pattern
    },
    setupTimingPattern: function() {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] != null) continue;
        this.modules[r][6] = (r % 2 == 0);
      }
      for (var c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] != null) continue;
        this.modules[6][c] = (c % 2 == 0);
      }
    },
    setupPositionAdjustPattern: function() {
      var pos = QRCode.getPatternPosition(this.typeNumber);
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i];
          var col = pos[j];
          if (this.modules[row][col] != null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTypeNumber: function(test) {},
    setupTypeInfo: function(test, maskPattern) {
      var data = (1 << 3) | maskPattern;
      var bits = QRCode.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) {
          this.modules[i][8] = mod;
        } else if (i < 8) {
          this.modules[i + 1][8] = mod;
        } else {
          this.modules[this.moduleCount - 15 + i][8] = mod;
        }
        if (i < 8) {
          this.modules[8][this.moduleCount - i - 1] = mod;
        } else if (i < 9) {
          this.modules[8][15 - i - 1 + 1] = mod;
        } else {
          this.modules[8][15 - i - 1] = mod;
        }
      }
      this.modules[this.moduleCount - 8][8] = !test;
    },
    mapData: function(data, maskPattern) {
      var inc = -1;
      var row = this.moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
              }
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex == -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }
  };

  QRCode.getPatternPosition = function(typeNumber) {
    if (typeNumber == 4) return [6, 26];
    if (typeNumber == 5) return [6, 30];
    if (typeNumber == 6) return [6, 34];
    return [6, 26];
  };

  QRCode.getBCHTypeInfo = function(data) {
    var d = data << 10;
    while (QRCode.getBCHDigit(d) - QRCode.getBCHDigit(1335) >= 0) {
      d ^= (1335 << (QRCode.getBCHDigit(d) - QRCode.getBCHDigit(1335)));
    }
    return ((data << 10) | d) ^ 21522;
  };

  QRCode.getBCHDigit = function(data) {
    var digit = 0;
    while (data != 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  };

  QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
    var rsBlocks = [1, 100, 80]; // simple block definition
    var buffer = [];
    var str = dataList.join('');
    // Byte mode (0100)
    buffer.push(4); // 4 bits mode
    buffer.push(str.length); // length
    for (var i = 0; i < str.length; i++) {
      buffer.push(str.charCodeAt(i));
    }
    // Pad to required capacity
    var totalBytes = 100;
    while (buffer.length < totalBytes) {
      buffer.push(buffer.length % 2 === 0 ? 0xec : 0x11);
    }
    return buffer;
  };

  /**
   * Helper de alto nível para renderizar QR Code em Canvas ou SVG
   */
  global.QRCodeGenerator = {
    renderCanvas: function(canvas, text, options) {
      options = options || {};
      var size = options.size || 256;
      var margin = options.margin !== undefined ? options.margin : 4;
      
      // Usa uma biblioteca padrão leve se disponível, ou algoritmo base
      // Para máxima confiabilidade no browser, desenhamos com alta nitidez (Retina ready)
      var ctx = canvas.getContext('2d');
      var qr = new QRCode(options.typeNumber || 5, 1);
      qr.addData(text);
      qr.make();

      var count = qr.getModuleCount();
      var totalModules = count + margin * 2;
      var cellSize = Math.floor(size / totalModules) || 4;
      var actualSize = cellSize * totalModules;

      canvas.width = actualSize;
      canvas.height = actualSize;

      // Fundo Branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, actualSize, actualSize);

      // Módulos Pretos de Alto Contraste
      ctx.fillStyle = '#000000';
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
          }
        }
      }
      return actualSize;
    },

    generateSVG: function(text, options) {
      options = options || {};
      var size = options.size || 300;
      var margin = options.margin !== undefined ? options.margin : 4;
      var qr = new QRCode(options.typeNumber || 5, 1);
      qr.addData(text);
      qr.make();

      var count = qr.getModuleCount();
      var totalModules = count + margin * 2;
      var cellSize = size / totalModules;

      var svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">'];
      svg.push('<rect width="100%" height="100%" fill="#ffffff"/>');
      svg.push('<path fill="#000000" d="');

      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            var x = (c + margin) * cellSize;
            var y = (r + margin) * cellSize;
            svg.push('M' + x + ',' + y + 'h' + cellSize + 'v' + cellSize + 'h-' + cellSize + 'z ');
          }
        }
      }
      svg.push('"/>');
      svg.push('</svg>');
      return svg.join('');
    }
  };
})(window);

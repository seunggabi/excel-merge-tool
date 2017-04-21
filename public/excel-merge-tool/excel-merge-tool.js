/**
 * Created by seunggabi on 2017. 2. 26..
 */

EMT.TOOL = {
	write_mode: null,
	log_mode: null,
	ignore_length: null,
	field_range: null,
	isFirst: true,

	init: function(data) {
		data = data || {};
		this.write_mode = data.write_mode || EMT.CONFIG.DEFAULT.WRITE_MODE;
		EMT.LOG.status = data.log_mode || EMT.CONFIG.DEFAULT.LOG_MODE;
		this.ignore_length = data.ignore_length || EMT.CONFIG.DEFAULT.IGNORE_LENGTH;
		this.field_range = data.field_range || EMT.CONFIG.DEFAULT.FIELD_RANGE;

		var isDuplication = data.isDuplication || EMT.CONFIG.DEFAULT.isDuplication;
		EMT.DATA.setDataConfig(isDuplication, this.field_range);

		EMT.STATISTICS.times = this.write_mode === EMT.CONFIG.WRITE_MODE.ALL ? 2 : 1;
		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "EMT Start");
	},

	readFiles: function(fileNames) {
		var wbList = [];
		fileNames.forEach(function(fileName) {
			var wb = XLSX.readFile(EMT.CONFIG.PATH.READ + fileName, {cellStyles: true});
			wb.fileName = fileName;
			wbList.push(wb);

			EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Read File: "+fileName);
		}.bind(this));
		return wbList;
	},

	binaryFile: function(fileName, binary) {
		this.fileName = fileName;
		this.binary = binary;
	},

	readBinaryFiles: function(binaryFiles) {
		EMT.MSG.setProgress(EMT.CONFIG.MSG.READ_START);
		var wbList = [];
		binaryFiles.forEach(function(binaryFile) {
			var wb = XLSX.read(binaryFile.binary, {type:"binary", cellStyles: true});
			wb.fileName = binaryFile.fileName;
			wbList.push(wb);

			EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Load File: "+binaryFile.fileName);
			EMT.STATISTICS.analyze(wb);
		}.bind(this));
		EMT.STATISTICS.calc();

		EMT.MSG.setProgress(EMT.CONFIG.MSG.READ_END.replace("{{TIME}}", EMT.STATISTICS.getTime()));
		return wbList;
	},

	selectXLSX: function(fileNames) {
		var filesXLSX = [];

		fileNames.forEach(function(fileName) {
			if(fileName.lastIndexOf(EMT.CONFIG.EXTENSION) >= 0
				&& fileName.lastIndexOf(EMT.CONFIG.USING_CHECK) < 0) {
				filesXLSX.push(fileName);
			}
		}.bind(this));
		return filesXLSX;
	},

	_mergeSheets: function(wbList) {
		for(var s in wbList[0].Sheets) {
			this._setDefaultStyle(wbList[0].Sheets[s]);
		}
		return wbList.reduce(this._mergeSheet.bind(this));
	},

	_mergeSheet: function(wb1, wb2) {
		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.MERGE, "TO "+wb1.fileName+", FROM "+wb2.fileName);

		for(var s in wb2.Sheets) {
			if(wb1.Sheets.hasOwnProperty(s)) {
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.CONFLICT, s+" Sheet ==> Conflict");
				wb1.Sheets[s].fileName = wb1.fileName;
				wb2.Sheets[s].fileName = wb2.fileName;
				wb1.Sheets[s] = this._mergeCells(wb1.Sheets[s], wb2.Sheets[s]);
			} else {
				EMT.LOG.addItem(EMT.LOG_TYPE.NEW, s+" Sheet ==> New");
				wb1.Sheets[s] = wb2.Sheets[s];
				wb1.SheetNames.push(s);
			}
			wb1.Sheets[s].isMerge = true;
		}
		return wb1;
	},

	_mergeCells: function(s1, s2) {
		this._setCellFomula(s1);
		this._setCellFomula(s2);
		this._setDefaultStyle(s2);

		for(var c in s2) {
			var v2 = String(s2[c].v);
			v2 = EMT.UTIL.enterOnce(v2);

			if(s1.hasOwnProperty(c)) {
				var v1 = EMT.UTIL.enterOnce(String(s1[c].v));

				if(c === EMT.CONFIG.KEY.RANGE) {
					this._extendsRange(s1[c], s2[c]);
				}
				else if(v1.length < this.ignore_length && v2.length < this.ignore_length) {
					v1 = v1.toUpperCase();
					v2 = v2.toUpperCase();

					if(v1 === v2) {
						s1[c].t = "s";
						s1[c].v = v1;
					} else {
						s1[c].v = EMT.UTIL.trim(v1 + String.fromCharCode(13) + v2);
					}
				}
				else if(!EMT.UTIL.isInclude(v1, v2)) {
					s1[c].t = "s";
					if(this.write_mode === EMT.CONFIG.WRITE_MODE.CONFLICT && s1[c].v !== "") {
						s1[c].s = EMT.CONFIG.CONFLICT_STYLE;
					}

					if(!s1.isMerge) {
						s1[c].v = this._concatFileName(s1.fileName, v1)
							+ String.fromCharCode(13)
							+ this._concatFileName(s2.fileName, v2);
					} else {
						s1[c].v += String.fromCharCode(13)
							+ this._concatFileName(s2.fileName, v2);
					}

					s1[c].v = EMT.UTIL.trim(s1[c].v);
					if(s1[c].v) {
						EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.CONFLICT, c + " Cell ==> Conflict (" + s1[c].v + ")");
					}
				}
			} else {
				if(v2.length < this.ignore_length) {
					s2[c].v = v2;
				} else {
					s2[c].v =  this._concatFileName(s2.fileName, v2);
				}
				s1[c] = s2[c];
			}
		}
		return s1;
	},

	_setDefaultStyle: function(s) {
		for(var c in s) {
			if(c.match(EMT.CONFIG.REG.CELL)) {
				s[c].s = s[c].s || {};
				s[c].s = EMT.UTIL.mix(EMT.UTIL.clone(s[c].s), EMT.CONFIG.DEFAULT_STYLE);
			}
		}
	},

	_setCellFomula: function(s) {
		for(var c in s) {
			if(s[c].hasOwnProperty && s[c].hasOwnProperty(EMT.CONFIG.KEY.FORMULA)) {
				s[c].t = "s";
				s[c].v = "="+s[c].f;
			}
		}
	},

	_extendsRange: function(r1, r2) {
		var r;
		var r1Col = r1.match(EMT.CONFIG.REG.COL);
		var r1Row = r1.match(EMT.CONFIG.REG.ROW);

		var r2Col = r2.match(EMT.CONFIG.REG.COL);
		var r2Row = r2.match(EMT.CONFIG.REG.ROW);

		r = EMT.UTIL.min(r1Col[0], r2Col[0])
			+ EMT.UTIL.min(r1Row[0], r2Row[0])
			+ ":"
			+ EMT.UTIL.max(r1Col[1], r2Col[1])
			+ EMT.UTIL.max(r1Row[1], r2Row[1]);

		return r;
	},

	_concatFileName: function(fileName, text) {
		if(text === "") {
			return text;
		}

		var fileNameLabel = "["+fileName+"]";
		if(text.indexOf(fileNameLabel) >= 0) {
			fileNameLabel = "";
		}

		var concatText = text;
		if(this.write_mode === EMT.CONFIG.WRITE_MODE.CONFLICT) {
			concatText = fileNameLabel + String.fromCharCode(13) + text;
		}

		return concatText;
	},

	writeFile: function(wbList) {
		switch(this.write_mode) {
			case EMT.CONFIG.WRITE_MODE.LIST:
			case EMT.CONFIG.WRITE_MODE.NONE:
			case EMT.CONFIG.WRITE_MODE.CONFLICT:
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Mode is "+this.write_mode);
				this._writeFile(EMT.UTIL.clone(wbList));
				EMT.LOG.writeFile();
				break;
			case EMT.CONFIG.WRITE_MODE.ALL:
				this.write_mode = EMT.CONFIG.WRITE_MODE.NONE;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Mode is "+this.write_mode);
				this._writeFile(EMT.UTIL.clone(wbList));
				this.write_mode = EMT.CONFIG.WRITE_MODE.CONFLICT;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Mode is "+this.write_mode);
				this._writeFile(EMT.UTIL.clone(wbList));
				this.write_mode = EMT.CONFIG.WRITE_MODE.ALL;
				EMT.LOG.writeFile();
				break;
			default:
				console.log(EMT.CONFIG.MSG.UNDEFINED);
		}
	},

	_writeFile: function(wbList) {
		var wb;

		if(this.write_mode === EMT.CONFIG.WRITE_MODE.LIST) {
			wb = this._addSheets(wbList);
		} else {
			wb = this._mergeSheets(wbList);
		}

		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Write File: "+EMT.CONFIG.WRITE_NAME[this.write_mode]);
		XLSX.writeFile(wb, EMT.CONFIG.PATH.WRITE + EMT.CONFIG.WRITE_NAME[this.write_mode]);
	},

	writeBinaryFile: function(wbList) {
		var binaryFiles = [];
		switch(this.write_mode) {
			case EMT.CONFIG.WRITE_MODE.LIST:
			case EMT.CONFIG.WRITE_MODE.NONE:
			case EMT.CONFIG.WRITE_MODE.CONFLICT:
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Mode is "+this.write_mode);
				binaryFiles.push(this._writeBinaryFile(EMT.UTIL.clone(wbList)));
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "EMT END");
				binaryFiles.push(new this.binaryFile(EMT.LOG.FILE_NAME, EMT.LOG.getBinaryFile()));
				break;
			case EMT.CONFIG.WRITE_MODE.ALL:
				this.write_mode = EMT.CONFIG.WRITE_MODE.NONE;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Mode is "+this.write_mode);
				binaryFiles.push(this._writeBinaryFile(EMT.UTIL.clone(wbList)));
				this.write_mode = EMT.CONFIG.WRITE_MODE.CONFLICT;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Mode is "+this.write_mode);
				binaryFiles.push(this._writeBinaryFile(EMT.UTIL.clone(wbList)));
				this.write_mode = EMT.CONFIG.WRITE_MODE.ALL;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "EMT END");
				binaryFiles.push(new this.binaryFile(EMT.LOG.FILE_NAME, EMT.LOG.getBinaryFile()));
				break;
			default:
				console.log(EMT.CONFIG.MSG.UNDEFINED);
		}
		return binaryFiles;
	},

	_writeBinaryFile: function(wbList) {
		var wb;

		if(this.write_mode === EMT.CONFIG.WRITE_MODE.LIST) {
			wb = this._addSheets(wbList);
		} else {
			wb = this._mergeSheets(wbList);
		}

		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Write File: "+EMT.CONFIG.WRITE_NAME[this.write_mode]);
		return new this.binaryFile(EMT.CONFIG.WRITE_NAME[this.write_mode], XLSX.write(wb, {type: "binary"}));
	},

	_readSheets: function(wb) {
		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Read File: "+wb.fileName);
		for(var s in wb.Sheets) {
			EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Read Sheet: "+s);
			var items = this._readCells(s, wb.Sheets[s]);
			items.forEach(function(item, index) {
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.NEW, "New Item("+Number(1+index)+"): "+item);
			}.bind(this));
		}
	},

	_readCells: function(sheetName, sheet) {
		return EMT.DATA.readCells(sheetName, sheet);
	},

	_addSheets: function(wbList) {
		EMT.DATA.init();

		for (var wb in wbList) {
			this._readSheets(wbList[wb]);
		}

		if (wbList[0].hasOwnProperty("Sheets")) {
			for (var s in wbList[0].Sheets) {
				EMT.DATA.addSheet(s, wbList[0].Sheets[s]);
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.NEW, s + " New Data Count: " + EMT.DATA.sizes[s]);
			}
			return wbList[0];
		}
	}
};
/**
 * Created by seunggabi on 2017. 2. 26..
 */

EMT.TOOL = {
	write_mode: null,
	ignore_length: null,
	field_range: null,
	isFirst: true,

	init: function(data) {
		data = data || {};
		this.write_mode = data.write_mode || EMT.CONFIG.DEFAULT.WRITE_MODE;
		this.ignore_length = data.ignore_length || EMT.CONFIG.DEFAULT.IGNORE_LENGTH;
		this.field_range = data.field_range || EMT.CONFIG.DEFAULT.FIELD_RANGE;
		EMT.LOG.status = data.log_mode || EMT.CONFIG.DEFAULT.LOG_MODE;

		let isDuplication = data.isDuplication || EMT.CONFIG.DEFAULT.isDuplication;
		EMT.DATA.setDataConfig(isDuplication, this.field_range);

		EMT.STATISTICS.times = this.write_mode === EMT.CONFIG.WRITE_MODE.ALL ? 2 : 1;
		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, EMT.CONFIG.START);
	},

	binaryFile: function(fileName, binary) {
		this.fileName = fileName;
		this.binary = binary;
	},

	readBinaryFiles: function(binaryFiles) {
		let wbList = [];
		binaryFiles.forEach((binaryFile) => {
			let wb = XLSX.read(binaryFile.binary, {type:"binary", cellStyles: true});
			wb.fileName = binaryFile.fileName;
			wbList.push(wb);

			EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Load File: "+binaryFile.fileName);
			EMT.STATISTICS.analyze(wb);
		});

		return wbList;
	},

	selectXLSX: function(fileNames) {
		let filesXLSX = [];

		fileNames.forEach((fileName) => {
			if(fileName.lastIndexOf(EMT.CONFIG.EXTENSION) >= 0
				&& fileName.lastIndexOf(EMT.CONFIG.USING_CHECK) < 0) {
				filesXLSX.push(fileName);
			}
		});
		return filesXLSX;
	},

	_mergeSheets: function(wbList) {
		for(let s in wbList[0].Sheets) {
			this._setDefaultStyle(wbList[0].Sheets[s]);
		}
		return wbList.reduce(this._mergeSheet.bind(this));
	},

	_mergeSheet: function(wb1, wb2) {
		EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.MERGE, "TO "+wb1.fileName+", FROM "+wb2.fileName);

		for(let s in wb2.Sheets) {
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

		for(let c in s2) {
			let v2 = String(s2[c].v);
			v2 = EMT.UTIL.enterOnce(v2);

			if(s1.hasOwnProperty(c)) {
				let v1 = EMT.UTIL.enterOnce(String(s1[c].v));

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
		for(let c in s) {
			if(c.match(EMT.CONFIG.REG.CELL)) {
				s[c].s = s[c].s || {};
				s[c].s = EMT.UTIL.mix(EMT.UTIL.clone(s[c].s), EMT.CONFIG.DEFAULT_STYLE);
			}
		}
	},

	_setCellFomula: function(s) {
		for(let c in s) {
			if(s[c].hasOwnProperty && s[c].hasOwnProperty(EMT.CONFIG.KEY.FORMULA)) {
				s[c].t = "s";
				s[c].v = "="+s[c].f;
			}
		}
	},

	_extendsRange: function(r1, r2) {
		let r;
		let r1Col = r1.match(EMT.CONFIG.REG.COL);
		let r1Row = r1.match(EMT.CONFIG.REG.ROW);

		let r2Col = r2.match(EMT.CONFIG.REG.COL);
		let r2Row = r2.match(EMT.CONFIG.REG.ROW);

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

		let fileNameLabel = EMT.UTIL.wrapBracket(fileName);
		if(text.indexOf(fileNameLabel) >= 0) {
			fileNameLabel = "";
		}

		let concatText = text;
		if(this.write_mode === EMT.CONFIG.WRITE_MODE.CONFLICT) {
			concatText = fileNameLabel + String.fromCharCode(13) + text;
		}

		return concatText;
	},

	writeBinaryFile: function(wbList) {
		let binaryFiles = [];
		switch(this.write_mode) {
			case EMT.CONFIG.WRITE_MODE.LIST:
			case EMT.CONFIG.WRITE_MODE.NONE:
			case EMT.CONFIG.WRITE_MODE.CONFLICT:
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, EMT.CONFIG.MSG.MODE.replace("{{MODE}}", this.write_mode));
				binaryFiles.push(this._writeBinaryFile(EMT.UTIL.clone(wbList)));
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, EMT.CONFIG.MSG.END);
				binaryFiles.push(new this.binaryFile(EMT.CONFIG.WRITE_NAME.LOG, EMT.LOG.getBinaryFile()));
				break;
			case EMT.CONFIG.WRITE_MODE.ALL:
				this.write_mode = EMT.CONFIG.WRITE_MODE.NONE;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, EMT.CONFIG.MSG.MODE.replace("{{MODE}}", this.write_mode));
				binaryFiles.push(this._writeBinaryFile(EMT.UTIL.clone(wbList)));
				this.write_mode = EMT.CONFIG.WRITE_MODE.CONFLICT;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, EMT.CONFIG.MSG.MODE.replace("{{MODE}}", this.write_mode));
				binaryFiles.push(this._writeBinaryFile(EMT.UTIL.clone(wbList)));
				this.write_mode = EMT.CONFIG.WRITE_MODE.ALL;
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, EMT.CONFIG.MSG.END);
				binaryFiles.push(new this.binaryFile(EMT.CONFIG.WRITE_NAME.LOG, EMT.LOG.getBinaryFile()));
				break;
			default:
				console.log(EMT.CONFIG.MSG.UNDEFINED);
		}
		return binaryFiles;
	},

	_writeBinaryFile: function(wbList) {
		let wb;

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
		for(let s in wb.Sheets) {
			EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.SYSTEM, "Read Sheet: "+s);
			let items = this._readCells(s, wb.Sheets[s]);
			items.forEach((item, index) => {
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.NEW, "New Item("+Number(1+index)+"): "+item);
			});
		}
	},

	_readCells: function(sheetName, sheet) {
		return EMT.DATA.readCells(sheetName, sheet);
	},

	_addSheets: function(wbList) {
		EMT.DATA.init();

		for (let wb in wbList) {
			this._readSheets(wbList[wb]);
		}

		if (wbList[0].hasOwnProperty("Sheets")) {
			for (let s in wbList[0].Sheets) {
				EMT.DATA.addSheet(s, wbList[0].Sheets[s]);
				EMT.LOG.addItem(EMT.CONFIG.LOG_TYPE.NEW, s + " New Data Count: " + EMT.DATA.sizes[s]);
			}
			return wbList[0];
		}
	}
};
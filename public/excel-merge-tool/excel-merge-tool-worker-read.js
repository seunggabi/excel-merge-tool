/**
 * Created by seunggabi on 2017. 4. 15..
 */

importScripts("/dist/cpexcel.js");
importScripts("/dist/jszip.js");
importScripts("/dist/xlsx.js");
importScripts("/excel-merge-tool/excel-merge-tool-config.js");
importScripts("/excel-merge-tool/excel-merge-tool-data.js");
importScripts("/excel-merge-tool/excel-merge-tool-log.js");
importScripts("/excel-merge-tool/excel-merge-tool-message.js");
importScripts("/excel-merge-tool/excel-merge-tool-statistics.js");
importScripts("/excel-merge-tool/excel-merge-tool-util.js");
importScripts("/excel-merge-tool/excel-merge-tool.js");

function callback(event) {
	var name = event.data.name;
	var result = event.data.result;

	var binaryFile = new EMT.TOOL.binaryFile(name, result);
	postMessage({
		binaryFile: binaryFile
	});
}

(function() {
	this.onmessage = callback;
})()
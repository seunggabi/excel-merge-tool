import React, { Component } from 'react'
import FileSaver from 'file-saver'
import withStyles from 'isomorphic-style-loader/lib/withStyles'
import cx from 'classnames'
import progressImg from './progress.gif'
import xlsxImg from './xlsxImg.png'
import Dropzone from '../../components/DropZone'
import DropItem from '../../components/DropItem'
import css from './style.css'

global.$ = require('jquery');
var Worker = require('workerjs');

class Main extends Component {
	constructor () {
		super();

		this.state = {
			files: [],
			isMerge: true,

			writeMode: 'ALL',
			ignoreLength: 0,
			fieldRange: '',
			isDuplication: false,
			logMode: true,
		}
	}

	onDrop = (files) => {
		this.setState({
			files: Array.concat(this.state.files, files)
		});
	};

	deleteFile = () => {
		this.setState({
			files: []
		})
	};

	readFile = () => {
		const { files, writeMode, logMode, ignoreLength, fieldRange, isDuplication } = this.state
		const binaryFiles = [];
		const options = {
			write_mode: writeMode,
			log_mode: logMode,
			ignore_length: ignoreLength,
			field_range: fieldRange,
			isDuplication: isDuplication
		};

		if (writeMode === 'LIST' && !this.checkReg(/[A-Z]+\d+:[A-Z]+\d+/g, fieldRange)) {
			if(confirm('필드셀 범위가 입력되지 않았습니다. 자동으로 감지하시겠습니까?(자동감지 높이 1)')) {

			} else {
				return;
			}
		}

		var $app = $("#app");
		$("#progressWrapper")
			.width($app.width())
			.height($app.height());

		files.forEach((file, index) => {
			$("."+css.progressWrapper).css("display", "block");
			const reader = new FileReader();

			reader.onloadend = () => {
				var readWorker = new Worker('excel-merge-tool/excel-merge-tool-worker-read.js');

				readWorker.postMessage({
					name: file.name,
					result: reader.result
				});

				readWorker.onmessage = function(event) {
					var binaryFile = event.data.binaryFile;
					binaryFiles.push(binaryFile);

					if (index === files.length - 1) {
						var writeWorker = new Worker('excel-merge-tool/excel-merge-tool-worker-write.js');
						writeWorker.postMessage({
							options: options,
							binaryFiles: binaryFiles,
						});
						writeWorker.onmessage = function(event) {
							function s2ab(s) {
								const buf = new ArrayBuffer(s.length);
								const view = new Uint8Array(buf);
								for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF
								return buf;
							}

							event.data.binaryFileList.forEach((binaryFile) => {
								if (binaryFile.fileName !== 'log.txt') {
									binaryFile.binary = s2ab(binaryFile.binary)
								}
								FileSaver.saveAs(new Blob([binaryFile.binary], { type: 'application/octet-stream' }), binaryFile.fileName)
							});
							$("."+css.progressWrapper).css("display", "none")
						}
					}
				};
			};
			reader.readAsBinaryString(file)
		})
	};

	handleWriteMode = (event) => {
		this.setState({ writeMode: event.target.value });
	};

	handleIgnoreLength = (event) => {
		const value = event.target.value;

		if (!this.checkReg(/\d*/g, value)) {
			alert('올바르지 않은 입력입니다.');
			return
		}
		this.setState({ ignoreLength: value });
	};

	handleLogMode = (event) => {
		this.setState({ logMode: event.target.checked });
	};

	handleIsDuplication = (event) => {
		this.setState({ isDuplication: event.target.checked });
	};

	handleFieldRange = (event) => {
		this.setState({ fieldRange: event.target.value });
	};

	onMergeTab = () => {
		this.setState({
			writeMode: 'ALL',
			isMerge: true
		})
	};

	onListTab = () => {
		this.setState({
			writeMode: 'LIST',
			isMerge: false
		})
	};

	checkReg = (reg, text) => {
		const data = reg.exec(text);
		if (data) {
			return text === data[0];
		}
		return false;
	};

	render () {
		const { files } = this.state

		return (
			<div>
				<div>
					{/* <!-- title -->*/}
					<h1 className={css.title}>
						Excel Merge Tool
					</h1>

					{/* <!-- dropZone -->*/}
					<div className={css.dropzoneWrapper}>
						<Dropzone className={css.dropzone} onDrop={this.onDrop}>
							{
								files.map(
									(file, index) =>
										<DropItem key={index} name={file.name} css={css} imgSrc={xlsxImg} />
								)

							}
						</Dropzone>
						<div className={css.right}>
							<button onClick={this.deleteFile}>초기화</button>
						</div>
					</div>

					{/* <!-- optionTab -->*/}
					<div className={css.tabWrapper}>
						<div className={css.tabHeader}>
							<div onClick={this.onMergeTab} className={cx(css.optionTabTitle, this.state.isMerge ? css.isOn : null)}>
								MERGE
							</div>
							<div onClick={this.onListTab} className={cx(css.optionTabTitle, this.state.isMerge ? null : css.isOn)}>
								LIST
							</div>
						</div>
						<div className={css.tabBody}>
							<div className={cx(css.optionTab, this.state.isMerge ? css.isOn : null)}>
								<div>
									<label>출력모드</label>
									<input type='radio' name='mode' value='ALL' checked={this.state.writeMode === 'ALL'} onChange={this.handleWriteMode} /> ALL
									<input type='radio' name='mode' value='NONE' onChange={this.handleWriteMode} /> NONE
									<input type='radio' name='mode' value='CONFLICT' onChange={this.handleWriteMode} /> CONFLICT
								</div>
								<div>
									<label>충돌길이제한</label>
									<input type='text' value={this.state.ignoreLength} onChange={this.handleIgnoreLength} />
								</div>
								<div>
									<label>로그</label>
									<input type='checkbox' checked={this.state.logMode} onChange={this.handleLogMode} />
								</div>
							</div>

							<div className={cx(css.optionTab, this.state.isMerge ? null : css.isOn)}>
								<div>
									<label>중복허용</label>
									<input type='checkbox' checked={this.state.isDuplication} onChange={this.handleIsDuplication} />
								</div>
								<div>
									<label>필드셀범위</label>
									<input type='text' value={this.state.fieldRange} onChange={this.handleFieldRange} />
								</div>
								<div>
									<label>로그</label>
									<input type='checkbox' checked={this.state.logMode} onChange={this.handleLogMode} />
								</div>
							</div>

							<div className={css.tabFooter}>
								<button onClick={this.readFile}>저장</button>
							</div>
						</div>
					</div>
				</div>
				<div id="progressWrapper" className={css.progressWrapper}>
					<div className={css.progress}>
						<img src={progressImg} />
						<div id="progressMessage"></div>
					</div>
				</div>
			</div>
		)
	}
}

export default withStyles(css)(Main)

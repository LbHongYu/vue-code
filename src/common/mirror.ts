// 错误捕获、处理、过滤，并且结合了白屏检测、请求错误监控、行为日志记录、数据治理等技术
interface iSettings {
	isReport: boolean; // 是否上报信息
	reportURL: string; // 接收错误信息接口的URL
	projectId: string; // 项目id
	outTime: number; // 超时时长
}
type iArgs = [method: string, url: string | URL, async: boolean, username?: string | null | undefined, password?: string | null | undefined];

function noop () {}

const env = {
	wechat: !!navigator.userAgent.toLowerCase().match(/MicroMessenger/i),
	iOS: !!navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/),
	Android: !!navigator.userAgent.match(/Android/i),
	dev: /127.0.0.1|localhost/.test(window.location.host)
};

class MirrorWatch {
	private settings:iSettings = {
		isReport: true,
		reportURL: '',
		projectId: '',
		outTime: 1000
	}; // 配置选项

	private logs: object[] = []; // 追踪的记录
	private user: any = ''; // 用户信息
	private uniqueId: string = geneUniqueId(); // 本次访问的id
	private timer: any = null; // 定时器id
	private reportedTimes: number = 0; // 已经上报的次数
	private isFirstReport: boolean = true; // 是否首次上报，只有首次上报会上报performance

	constructor () {
		this.proxyConsole();
		this.proxyAjax();
		this.proxyGlobalError();

		try {
			const { projectId } = this.settings;
			const logs = JSON.parse(window.localStorage.getItem(projectId + '_Logs') as string);
			if (Array.isArray(logs)) this.logs = logs;
		} catch (error) {
			console.log(error);
		}

		window.addEventListener('load', () => {
			this.report();
		}, false);
	}

	public init (settings: iSettings) {
		const { projectId, reportURL } = settings;
		if (projectId && reportURL) this.settings = settings;
	}

	/**
	 * 收集console打印的记录
	 */
	private proxyConsole(): void {
		const methodList: string[] = ['error'];
		methodList.forEach(type => {
			const method = console[type];
			
			console[type] = (...args:any[]) => {
				if (args.length && args[0] !== '[MirrorWatch Console]') {
					const msg = args.map(v => (typeof v === 'object') ? JSON.stringify(decycle(v, undefined)) : v).join(',');
					this.logs = [
						...this.logs,
						{
							msg,
							url: encodeURIComponent(window.location.href),
							type,
							createTime: Date.now()
						}
					];
					// 每新增一条log，更新localstorage的_msLogs
					if (this.settings.isReport) this.storeLogs(this.logs);
					this.checkLogs();
				}

				method.apply(console, args);
			};
		});
	}

	/**
	 * 收集AJAX请求错误信息
	 */
	private proxyAjax(): void {
		const context = this;
		const open = XMLHttpRequest.prototype.open;

		XMLHttpRequest.prototype.open = function (...args:iArgs) {
			const req = this;
			const method = args[0], 
						url = args[1];
			const onreadystatechange = req.onreadystatechange || function () {};
			req.onreadystatechange = function (..._args) {
				if (req.readyState === 4 && req.status >= 400) {
					context.logs.push({
						msg: `${method} ${url} ${req.status}`,
						url: encodeURIComponent(window.location.href),
						type: 'error'
					});
				}
				return onreadystatechange.apply(req, _args);
			};

			return open.apply(req, args);
		};
	}

	/**
	 * 收集全局错误信息
	 */
	private proxyGlobalError(): void {
		window.onerror = (msg, url, line, col, error) => {
			let errMsg: any = msg;
			if (error && error.stack) {
				errMsg = processStackMsg(error);
			}
			this.logs.push({
				msg: encodeURIComponent(errMsg.substr(0, 500)),
				url: encodeURIComponent(window.location.href),
				type: 'error',
				line,
				col,
				createTime: Date.now()
			});
			// 每新增一条log，更新localstorage的_msLogs
			if (this.settings.isReport) this.storeLogs(this.logs);

			this.checkLogs();
		};
	}

	/**
	 * 设置用户信息
	 * @param user
	 */
	public setUser(user: any): void {
		this.user = user;
	}

	/**
	 * 发送请求，错误上报
	 * @param async 是否异步请求
	 */
	public report(async: boolean = true): void {
		const {reportURL, projectId, isReport = true, outTime} = this.settings;

		if (isReport && reportURL && projectId && this.reportedTimes < 20) {
			const user = (isType(this.user, 'Number') || isType(this.user, 'String')) ? this.user : JSON.stringify(this.user);
			const logs = JSON.stringify(decycle(this.logs.slice(), undefined));
			const params: any = {
				project: projectId,
				httpHost: window.location.host,
				requestUri: window.location.pathname,
				logs,
				user,
				uniqueId: this.uniqueId,
				ua: window.navigator?.userAgent
			};

			if (this.isFirstReport) {
				const performance = window.performance;
				const times = {
					dns: -1,
					tcp: -1,
					ttfb: -1,
					trans: -1,
					dom: -1,
					res: -1,
					firstbyte: -1,
					fpt: -1,
					tti: -1,
					ready: -1,
					load: -1,
				};

				const t = performance.timing;
				times.dns = t.domainLookupEnd - t.domainLookupStart;
				times.tcp = t.connectEnd - t.connectStart;
				times.ttfb = t.responseStart - t.requestStart;
				times.trans = t.responseEnd - t.responseStart;
				times.dom = t.domInteractive - t.responseEnd;
				times.res = t.loadEventStart - t.domContentLoadedEventEnd;
				times.firstbyte = t.responseStart - t.domainLookupStart;
				times.fpt = t.responseEnd - t.fetchStart;
				times.tti = t.domInteractive - t.fetchStart;
				times.ready = t.domContentLoadedEventEnd - t.fetchStart;
				times.load = t.loadEventStart - t.fetchStart;

				params.times = JSON.stringify(times);
				this.isFirstReport = false;
			}

			try {
				AJAX(reportURL, 'POST', params, async, 
					() => {
						this.logs = [];
						// 上报后清空当前缓存的_msLogs
						const { projectId } = this.settings;
						window.localStorage && window.localStorage.removeItem(projectId + '_Logs');
					},
					noop, 
					outTime
				);
			} finally {
				this.reportedTimes++;
			}
		}
	}

	/**
	 */
	public reportPageTime(pageName: string, pageTime: number): void {
		const {reportURL, projectId, isReport = true} = this.settings;
		if (isReport && reportURL && projectId) {
			const user = (isType(this.user, 'Number') || isType(this.user, 'String')) ? this.user : JSON.stringify(this.user);
			const pageParams = JSON.stringify({ pageName, pageTime });

			try {
				AJAX(
					reportURL, 
					'POST', 
					{
						project: projectId,
						httpHost: window.location.host,
						requestUri: window.location.pathname,
						user,
						uniqueId: this.uniqueId,
						ua: window.navigator?.userAgent,
						pageParams
					}, 
					true, 
					noop, 
					noop, 
					0
				);
			} catch (e) {
				console.log(e);
			}
		}
	}

	/**
	 * Vue插件调用
	 * @returns {object}
	 */
	public useVue(): object {
		const context = this;
		return {
			install(Vue): void {
				const ver: string[] = Vue.version && Vue.version.split('.') || [];
				if (+ver[0] >= 2 && +ver[1] >= 2) {
					Vue.config.errorHandler = (err, vm, info) => {
						console.error('[MirrorWatch Console]', err);
						let errMsg: string = err ? (err.stack ? processStackMsg(err) : err) : '';
						if (info) errMsg = `[Info: ${info}]->${errMsg}`;
						if (vm?.$options?.name) errMsg = `[Component Name: ${vm.$options.name}]->${errMsg}`;

						context.logs.push({
							msg: errMsg,
							url: encodeURIComponent(window.location.href),
							type: 'error',
							createTime: Date.now()
						});

						// 每新增一条log，更新localstorage的_msLogs
						if (context.settings.isReport) context.storeLogs(context.logs);

						context.checkLogs();
					};
				}

				if (getQueryString('devtools')) {
					Vue.config.devtools = true;
				}
			}
		};
	}

	private checkLogs(): void {
		clearTimeout(this.timer);
		if (this.logs.length >= 5) {
			this.report();
		} else {
			this.timer = setTimeout(this.report, 3000);
		}
	}

	/**
	 * 将log存储到localStorage中
	 * @param logs
	*/
	private storeLogs(logs: object[]): any {
		const { projectId } = this.settings;
		logs.length && window.localStorage.setItem(projectId + '_Logs', JSON.stringify(logs));
	}		
}

/**
 * 上报信息的AJAX
 * @param url 请求地址
 * @param method 请求方法
 * @param data 请求参数
 * @param async 是否异步请求（默认为true）
 * @param successCb 成功回调
 * @param errorCb 错误回调
 * @param outTime 超时时长
 * @constructor
 */
function AJAX(
	url: string, 
	method: string, 
	data: object, 
	async: boolean = true, 
	successCb:Function, 
	errorCb:Function, 
	outTime: number
): void {
	let isTimeOut = false; // 默认没超时
	const xhr = new XMLHttpRequest();
	const timer = setTimeout(() => {
		isTimeOut = true;
		xhr.abort();
	}, outTime);

	xhr.onreadystatechange = () => {
		if (isTimeOut) return;

		clearTimeout(timer);
		if (xhr.readyState === 4) {
			((xhr.status === 200) ? successCb : errorCb)(JSON.parse(xhr.responseText));
		}
	};

	xhr.open(method, method.toUpperCase() === 'GET' ? (url + '?' + toDataString(data)) : url, async);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xhr.send(toDataString(data));
}

/**
 * 判断val是否为type类型的值
 * @param val
 * @param type 可能的值为Function, Object, Array, Number, String, RegExp, Null, Undefined, Boolean, Symbol, Date等
 * @returns {boolean}
 */
function isType(val: any, type: string): boolean {
	const toString = Object.prototype.toString;
	if (type === 'Number' && (val !== val)) {
		return false;
	}
	return toString.call(val).replace(/.*\s(.*)]$/, '$1') === type;
}

/**
 * 去除循环引用
 * @param object 待处理的对象
 * @param replacer 对对象值遍历处理的方法
 * @returns {object} 去除循环引用的对象
 */
function decycle(object: object, replacer: ((value: any) => any) | undefined): object {
	const obj2Path: WeakMap<any, string> = new WeakMap();

	return (function derez(value: any, path: string) {
		let oldPath: string | undefined;
		let newObj: object;
		if (replacer !== undefined) {
			value = replacer(value);
		}
		if (typeof value === 'object' && value !== null &&
			!(value instanceof Boolean) &&
			!(value instanceof Date) &&
			!(value instanceof Number) &&
			!(value instanceof RegExp) &&
			!(value instanceof String)) {
			oldPath = obj2Path.get(value);
			if (oldPath !== undefined) {
				return {
					$ref: oldPath
				};
			}
			obj2Path.set(value, path);
			if (Array.isArray(value)) {
				newObj = value.map((v, i) => {
					return derez(v, path + '[' + i + ']');
				});
			} else {
				newObj = {};
				Object.getOwnPropertyNames(value).forEach(key => {
					newObj[key] = derez(value[key], path + '[' + key + ']');
				});
			}
			return newObj;
		}
		return value;
	}(object, '$'));
}

/**
 * 格式化错误信息
 * @param error
 * @returns {string}
 */
function processStackMsg(error): string {
	let stack: string = error.stack
		.replace(/\n/gi, '')
		.split(/\bat\b/)
		.slice(0, 9)
		.join('@')
		.replace(/\?[^:]+/gi, '');
	const msg: string = error.toString();
	if (stack.indexOf(msg) < 0) {
		stack = msg + '@' + stack;
	}
	return stack;
}

/**
 * 生成唯一的id
 * @returns {string}
 */
function geneUniqueId(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

/**
 * 获取url参数
 * @param param 参数名
 * @returns {string}
 */
function getQueryString(param: string): string {
	const r = window.location.search.substr(1).match(new RegExp('(^|&)' + param + '=([^&]*)(&|$)', 'i'));
	return r ? decodeURI(r[2]) : '';
}

/**
 * 将对象转化为url参数字符串
 * @param obj
 * @returns {string}
 */
function toDataString(obj: object): string {
	let str: string = '';
	for (const prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			str += '&' + prop + '=' + obj[prop];
		}
	}
	return str.slice(1);
}

export const mirrorWatch = new MirrorWatch();
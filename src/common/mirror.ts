// 错误捕获、处理、过滤，并且结合了白屏检测、请求错误监控、行为日志记录、数据治理等技术
type consoleMethod = 'error' | 'info' | 'warn';
type iConfig ={
	reportURL: string; // 监控服务的接口
	systemId: string; // 项目id
	timeout: number; // 监控服务的接口超时时长
	delayReport: number; // 延迟上报的秒数
	minLogLength: number; // 日志立即上报的最小长度, 小于该长度时 3000 后上报
	mutatedConsole: consoleMethod[]; // 需要代理的 console
	maxReportedTimes:number; // 上报最大次数
}

type iArgs = [
	method: string, 
	url: string | URL, 
	async: boolean, 
	username?: string | null | undefined, 
	password?: string | null | undefined
];
type iRequestBodyParams = { [propName:string]: string | number };

function noop () {}

class MirrorWatch {
	private config:iConfig = {
		reportURL: '',
		systemId: '',
		timeout: 1000,
		delayReport : 5000,
		minLogLength: 10,
		maxReportedTimes: 30,
		mutatedConsole: ['error']
	}; 

	private logs: object[] = []; // 错误信息日志
	private userInfo:any = ''; // 用户信息
	private uuid: string = UUID(); // 当前访问的唯一id
	private timer:any = null;
	private reportedTimes: number = 0; // 已经上报的次数
	private isFirstReport: boolean = true; // 是否第一次上报，只有第一次才会上报performance数据

	constructor () {
		this.proxyConsole();
		this.proxyAjax();
		this.proxyGlobalError();
		
		try {
			const { systemId } = this.config;
			const logs = JSON.parse(localStorage.getItem(systemId + '_Logs') as string);

			if (Array.isArray(logs)) this.logs = logs;
		} catch (error) {
			console.log(error);
		}

		window.addEventListener('load', () => {
			this.report();
		}, false);
	}

	public init (config: iConfig) {
		const { systemId, reportURL } = config;
		if (systemId && reportURL) Object.assign(this.config, config);
	}

	/**
	 * 收集console打印的记录
	 */
	private proxyConsole(): void {
		this.config.mutatedConsole.forEach(type => {
			const method = console[type];
			
			console[type] = (...args:any[]) => {
				if (args.length && args[0] !== '[MirrorWatch]') {
					const message = args.map(d => {
						if (typeof d === 'object') {
							return JSON.stringify(decycle(d, undefined));
						} else {
							return d
						}
					}).join(',');

					this.logs.push({
						message,
						type,
						createdTime: Date.now()
					});

					this.storeLogs(this.logs);
					this.reportLogs();
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
						message: `${method} ${url} ${req.status}`,
						type: 'error'
					});
				}

				return onreadystatechange.apply(req, _args);
			};

			return open.apply(req, args);
		};
	}

	/**
 * Vue插件调用
 * @returns {object}
 */
	public useVue(): object {
		const context = this;
		return {
			install (Vue): void {
				const ver: string[] = Vue.version && Vue.version.split('.') || [];
				if (+ver[0] >= 2 && +ver[1] >= 2) {
					Vue.config.errorHandler = (err, vm, info) => {
						console.error('[MirrorWatch Console]', err);

						let errMsg: string = err ? (err.stack ? processStackMsg(err) : err) : '';
						if (info) errMsg = `[Info: ${info}]->${errMsg}`;
						if (vm?.$options?.name) errMsg = `[Component Name: ${vm.$options.name}]->${errMsg}`;

						context.logs.push({
							message: errMsg,
							type: 'error',
							createdTime: Date.now()
						});

						context.storeLogs(context.logs);
						context.reportLogs();
					};
				}

				if (getUrlParam('devtools')) {
					Vue.config.devtools = true;
				}
			}
		};
	}

	/**
	 * 收集全局错误信息
	 */
	private proxyGlobalError(): void {
		window.onerror = (message, url, line, col, error) => {
			let errMsg: any = message;
			if (error && error.stack) errMsg = processStackMsg(error);

			this.logs.push({
				message: encodeURIComponent(errMsg.substr(0, 500)),
				type: 'error',
				line,
				col,
				createdTime: Date.now()
			});

			this.storeLogs(this.logs);

			this.reportLogs();
		};
	}

	public setUser(userInfo: any): void {
		const numberOrString = ['Number', 'String'].includes(typeChecker(userInfo));
		this.userInfo = numberOrString ? userInfo : JSON.stringify(userInfo);
	}

	/**
	 * 上报错误
	 * @param async 是否异步请求
	 */
	public report(async: boolean = true): void {
		const {reportURL, systemId, timeout} = this.config;
		if (!reportURL || !systemId) {
			return console.warn('[MirrorWatch]', 'reportURL or systemId is unknow');
		}

		if (this.reportedTimes < this.config.maxReportedTimes) {
			const logs = JSON.stringify(decycle(this.logs.slice(), undefined));
			const params: any = {
				systemId,
				clientOrigin: window.location.origin,
				clientHref: window.location.href,
				logs,
				userInfo: this.userInfo,
				uuid: this.uuid,
				ua: window.navigator?.userAgent
			};

			if (this.isFirstReport) {
				params.times = JSON.stringify(this.getPerformanceTiming());
				this.isFirstReport = false;
			}

			try {
				AJAX(
					reportURL, 
					'POST', 
					params, 
					async, 
					() => {
						this.logs = [];
						localStorage.removeItem(this.config.systemId + '_Logs');
					},
					noop, 
					timeout
				);
			} finally {
				this.reportedTimes++;
			}
		}
	}

	public reportPageTime(pageName: string, pageTime: number): void {
		const {reportURL, systemId } = this.config;
		if (reportURL && systemId) {
			const pageParams = JSON.stringify({ pageName, pageTime });

			try {
				AJAX(
					reportURL, 
					'POST', 
					{
						systemId,
						clientOrigin: window.location.host,
						clientHref: window.location.pathname,
						userInfo: this.userInfo,
						uuid: this.uuid,
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

	private reportLogs(): void {
		clearTimeout(this.timer);

		if (this.logs.length >= this.config.minLogLength) {
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
		const { systemId } = this.config;
		localStorage.setItem(systemId + '_Logs', JSON.stringify(logs));
	}		

	private getPerformanceTiming () {
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

		return times;
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
 * @param timeout 超时时长
 * @constructor
 */
function AJAX(
	url: string, 
	method: string, 
	data: iRequestBodyParams, 
	async: boolean = true, 
	successCb:Function, 
	errorCb:Function, 
	timeout: number
): void {
	let isTimeOut = false; // 默认没超时
	const xhr = new XMLHttpRequest();

	const timer = setTimeout(() => {
		isTimeOut = true;
		xhr.abort();
	}, timeout);

	xhr.onreadystatechange = () => {
		if (isTimeOut) return;

		clearTimeout(timer);

		if (xhr.readyState === 4) {
			const res = JSON.parse(xhr.responseText);
			const fn = (xhr.status === 200) ? successCb : errorCb;
			fn(res);
		}
	};

	xhr.open(method, method.toUpperCase() === 'GET' ? (url + '?' + getRequestBodyParams (data)) : url, async);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xhr.send(getRequestBodyParams (data));
}

// 类型检测
type ObjectTypes = 'Array' | 'Object' | 'Null' | 'Number' | 'String' | 'Boolean' | 'Symbol' | 'Promise' | 'JSON';
export function typeChecker (data: any): ObjectTypes {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      const isArrayOrObj = ['Array', 'Object'].includes(Object.prototype.toString.call(parsed).slice(8, -1));
      return isArrayOrObj ? 'JSON' : 'String';
    } catch(e) {
      return 'String';
    }
  } else {
    return Object.prototype.toString.call(data).slice(8, -1) as ObjectTypes;
  }
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
function processStackMsg(error:any): string {
	let stack: string = error.stack
		.replace(/\n/gi, '')
		.split(/\bat\b/)
		.slice(0, 9)
		.join('@')
		.replace(/\?[^:]+/gi, '');

	const message: string = error.toString();
	if (stack.indexOf(message) < 0) {
		stack = message + '@' + stack;
	}
	return stack;
}

/**
 * 生成唯一的id
 * @returns {string}
 */
function UUID(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

/**
  获取 url 中的查询参数
  http://ddd.com/path/?ticket=ST-9703#/subpath?type=todo 
    getUrlParam('ticket') // ST-9703
    getUrlParam('type') // todo
    
  http://ddd.com/path/#/subpath?type=todo
    getUrlParam('type') // todo

  http://ddd.com/path/subpath?type=todo 
    getUrlParam('type') // todo
*/
export function getUrlParam (name: string) {
  let res = '';
  const reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)', 'i');
  getQuerys(window.location).forEach((d:string) => {
    const r = d.match(reg);
    if (r != null) res = decodeURIComponent(r[2]);
  });

  function getQuerys (l: Location) {
    const querys:string[] = [];

    // http://ddd.com/path/?ticket=ST-9703-#/subpath?type=todo
    // 兼容这种场景，从 search 和 hash 都获取一下
    if (l.search) {
      querys.push(l.search.substring(1));
    }

    if (l.hash) {
      const index = l.hash.indexOf('?');
      if (~index) {
        querys.push(l.hash.substring(index + 1));
      }
    }

    return querys;
  }

  return res;
}

/**
 * 将对象转化为url参数字符串
 * @param obj
 * @returns {string}
 */
function getRequestBodyParams (obj: iRequestBodyParams): string {
	let str: string = '';

	str = Object.keys(obj).reduce((prev, d, i) => {
		return i > 0 ? `&${d}=${obj[d]}` : `${d}=${obj[d]}`;
	}, '');

	return str.slice(1);
}

export const mirrorWatch = new MirrorWatch();
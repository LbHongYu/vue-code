// 错误捕获、处理、过滤，并且结合了白屏检测、请求错误监控、行为日志记录、数据治理等技术
import { 
  typeChecker,
  decycle,
  processStackMsg,
  UUID,
  getUrlParam
} from './tools';

type consoleMethod = 'error' | 'info' | 'warn';
type iConfig = {
	env: 'local' | 'test' | 'prod';
	reportURL?: string; // 监控服务的接口
	systemId: string; // 项目id
	delayReport?: number; // 延迟上报的秒数
	maxLogLength?: number; // 日志立即上报的最小长度, 小于该长度时 3000 后上报
	mutatedConsole?: consoleMethod[]; // 需要代理的 console
	maxReportedTimes?:number; // 上报最大次数
	bReportImmediately?: boolean; // 报错后是否立即上报
}

type iArgs = [
	method: string, 
	url: string | URL, 
	async: boolean, 
	username?: string | null | undefined, 
	password?: string | null | undefined
];

function noop () {}

class MirrorWatch {
	public config:iConfig = {
		env: 'local',
		reportURL: '',
		systemId: '',
		delayReport : 5000,
		maxLogLength: 10,
		maxReportedTimes: 30,
		bReportImmediately: false,
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
		this.proxyPromiseError();
		this.proxyHistory();
	}

	public init (config: iConfig) {
		const { systemId, bReportImmediately } = config;

		if (systemId) {
      Object.assign(this.config, config);

			try {
				const { systemId, env } = this.config;
				const logs = JSON.parse(localStorage.getItem(systemId + '_Logs') as string);
				if (Array.isArray(logs)) {
          this.logs = logs;

          // 本地测试环境，超过 100 条就清理日志
          if (['local'].includes(env) && logs.length > 100) { 
            localStorage.removeItem(systemId + '_Logs');
            this.logs = [];
          }
        }
			} catch (error) {
				console.log(error);
			}
      
			if (!bReportImmediately) {
				// 如果切换窗口的时候有错误信息(关闭窗口、关闭浏览器都会执行)，执行一次上报
				document.addEventListener("visibilitychange", () => {
					if (document.visibilityState === "hidden" && this.logs.length) {
						localStorage.setItem('report', '1');
						this.report();          
					}
				});			
			}
    } else {
      console.warn('[MirrorWatch]', 'systemId is unknow');
    }
	}

	/**
	 * 收集console打印的记录
	 */
	private proxyConsole(): void {
		(this.config.mutatedConsole  as consoleMethod[]).forEach(type => {
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
					
					console.log('【proxyConsole】', message);

					this.logs.push({
						type: 'consoleError_' + type,
						message,
						createdTime: Date.now()
					});

					this.storeLogs(this.logs);
					if (this.config.bReportImmediately) this.reportLogs();
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
				if (req.readyState === 4) {
					if (req.status >= 400) {
						console.log('【proxyAjax】', req.status);
						context.logs.push({
							type: 'NetworkError',
							message: `${method} ${url} ${req.status}`,
							createdTime: Date.now(),
						});
					}
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
							type: 'VueError',
							message: errMsg,
							createdTime: Date.now()
						});

						context.storeLogs(context.logs);
						if (context.config.bReportImmediately) context.reportLogs();
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
    // 需要在捕获阶段捕捉资源加载失败错误
    window.addEventListener('error', (evt) => {
      const { message, filename, lineno, colno, error, target } = evt;
			console.log('【error event】', evt);
      //  JS运行错误
			if (filename) {
        let errMsg: any = message;
        if (error && error.stack) errMsg = processStackMsg(error);
        this.logs.push({
          // message: encodeURIComponent(errMsg.substr(0, 500)),
          type: 'jsError',
          message: errMsg.substr(0, 500),
          createdTime: Date.now(),
          filename,
          lineno,
          colno,
        });
      }

      // 资源加载错误
      let tag = (target as HTMLElement).localName;
      if(tag){
        const src = tag === 'link' ? (target as HTMLLinkElement).href : target.src;
        tag = tag === 'source' ? 'vedio' : tag;

        this.logs.push({
          type: 'sourceError',
          message: `${tag} ${src}`,
          createdTime: Date.now(),
        });
      } 

			this.storeLogs(this.logs);
			if (this.config.bReportImmediately) this.reportLogs();
    }, true);
	}
  
	// 收集 Promise 未 catch 的错误信息
	private proxyPromiseError(): void {
    window.addEventListener('unhandledrejection', (evt) => {
			console.log('【unhandledrejection event】', evt);
      let errMsg = evt?.reason?.message;

      if (evt?.reason?.stack) errMsg = processStackMsg(evt.reason);
      
      this.logs.push({
        // message: encodeURIComponent(errMsg.substr(0, 500)),
        type: 'unhandledrejectionError',
        message: errMsg.substr(0, 500),
        createdTime: Date.now(),
      });

			this.storeLogs(this.logs);
			if (this.config.bReportImmediately) this.reportLogs();
    }, true);
	}

	// 收集 Promise 未 catch 的错误信息
	private proxyHistory(): void {
    const _wr = function(type: 'pushState' | 'replaceState' | 'go') {
			const method: History = history[type];

			return function (...args) {
				const rv = method.apply(history, args);
				
				const evt = new Event(type);
				evt.args = args;
				window.dispatchEvent(evt);
				return rv;
			};
		};

		history.pushState = _wr('pushState');
		history.replaceState = _wr('replaceState');
		history.go = _wr('go');

		window.addEventListener('replaceState', function(e) {
			console.log('【replaceState】', e);
		});
		window.addEventListener('pushState', function(e) {
			console.log('【pushState】', e);
		});
		window.addEventListener('go', function(e) {
			console.log('【history go】', e);
		});
	}

	public setUser(userInfo: any): void {
		const numberOrString = ['Number', 'String'].includes(typeChecker(userInfo));
		this.userInfo = numberOrString ? userInfo : JSON.stringify(userInfo);
	}

	/**
	 * 上报错误
	 * @param async 是否异步请求
	 */
	public report(): void {
		const { reportURL, systemId } = this.config;
		if (!reportURL || !systemId) {
      // TODO:
			// console.warn('[MirrorWatch]', 'reportURL or systemId is unknow');
			// this.logs = [];
			// localStorage.removeItem(this.config.systemId + '_Logs');
			return; 
		}

		if (this.reportedTimes < (this.config.maxReportedTimes as number)) {
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
        navigator.sendBeacon("/log", params);
        this.logs = [];
        localStorage.removeItem(this.config.systemId + '_Logs');
			} finally {
				this.reportedTimes++;
			}
		}
	}

	private reportLogs(): void {
		console.log('reportLogs');
		
		clearTimeout(this.timer);
		// 如果 logs 数量达到 maxLogLength, 立马上报
		if (this.logs.length >= (this.config.maxLogLength as number)) {
			this.report();
		} else { // 否则 3 秒之后再上报
			this.timer = setTimeout(() => { this.report(); }, 3000);
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

export const mirrorWatch = new MirrorWatch();
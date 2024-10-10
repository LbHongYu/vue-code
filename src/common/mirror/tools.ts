type iRequestBodyParams = { [propName:string]: string | number };

// 将对象转化为url参数字符串
function getRequestBodyParams (obj: iRequestBodyParams): string {
	let str: string = '';

	str = Object.keys(obj).reduce((prev, d, i) => {
		return i > 0 ? `&${d}=${obj[d]}` : `${d}=${obj[d]}`;
	}, '');

	return str.slice(1);
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
export function AJAX(
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
export function decycle(object: object, replacer: ((value: any) => any) | undefined): object {
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
export function processStackMsg(error:any): string {
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
export function UUID(): string {
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

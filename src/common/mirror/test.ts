import { mirrorWatch } from './index';

mirrorWatch.init({
  env: 'local', // 写死为 local
  systemId: 'vue-code',
  mutatedConsole: []
});

/* Vue3 报错
mirrorWatch.proxyVue3Error(app);
*/

/* 路由变化
mirrorWatch.proxyHistory(router);
*/

/* js 报错
const obj = {};
console.error('obj 中没有 person'); // 通过 console 手动收集错误
throw new Error('test Error'); // 手动抛出一个错误
console.log(obj.person.name); // 通过 error 自动拦截 
*/

/* 资源加载报错
const WX_SDK_URL = 'http://res.wx.qq.com/open/js/jweixin-12.0.js';
let script = document.createElement('script');
script.src = WX_SDK_URL;
document.body.appendChild(script);  
*/

/* Promise 构造函数的报错
new Promise(function(resolve, reject) {
  const obj = {};
  console.log(obj.person.name);
}); 
*/

/* then 回调的报错
new Promise(function(resolve, reject) {
  resolve({ code: 0})
}).then(() => {
  const obj = {};
  console.log(obj.person.age);
}); 
*/

/* 任何连续不间断的且主 UI 线程繁忙 50 毫秒及以上的时间区间
function setArr() {
  const count = 10000000;
  const arr = [];

  for (let i = 0; i < count; i++) {
    arr.push(i);
  }

  return arr;
}

console.log(setArr());
*/

/* 性能标准指标 web-vitals
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals';
onCLS((data) => { console.log('意外布局偏移 onCLS: ', data); });
onFCP((data) => { console.log('首次内容渲染 onFCP: ', data); });
onFID((data) => { console.log('首次输入延迟 onFID: ', data); });
onINP((data) => { console.log('onINP: ', data); });
onLCP((data) => { console.log('最大内容绘制 onLCP: ', data); });
onTTFB((data) => { console.log('接收到首字节 onTTFB: ', data); }); 
*/

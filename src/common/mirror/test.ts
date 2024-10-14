import { mirrorWatch } from './index';
const WX_SDK_URL = 'http://res.wx.qq.com/open/js/jweixin-12.0.js';

mirrorWatch.init({
  env: 'local', // 写死为 local
  systemId: 'ai-meeting-pc',
  mutatedConsole: []
});

const obj = {};
// console.error('obj 中没有 person'); // 通过 console 手动收集错误
// throw new Error('test Error'); // 手动抛出一个错误
// console.log(obj.person.name); // 通过 error 自动拦截

/* let script = document.createElement('script');
script.src = WX_SDK_URL;
document.body.appendChild(script);  */

// Promise 构造函数的报错
/* new Promise(function(resolve, reject) {
  const obj = {};
  console.log(obj.person.name);
}); */

// then 回调的报错
/* new Promise(function(resolve, reject) {
  resolve({ code: 0})
}).then(() => {
  const obj = {};
  console.log(obj.person.age);
}); */
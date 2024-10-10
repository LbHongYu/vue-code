import { mirrorWatch } from '@/common/mirror';

mirrorWatch.init({
  systemId: 'VUE-CODE',
  timeout: 10000
});

const obj = {};
// console.error('obj 中没有 person'); // 通过 console 手动收集错误
// throw new Error('test Error'); // 手动抛出一个错误
// console.log(obj.person.name); // 通过 window.error 自动拦截
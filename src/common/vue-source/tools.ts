// 存储副作用函数的桶
const bucket = new WeakMap()
const data = { ok: false, text: 'hello world' }
let activeEffect:Function // 用一个全局变量存储被注册的副作用函数

const obj = new Proxy(data, {
   get(target, key) {
     // 将副作用函数 activeEffect 添加到存储副作用函数的桶中
     track(target, key)
     return target[key]
   },

   set (target: object, key: string, newVal) {
     target[key] = newVal;
     trigger(target, key); // 把副作用函数从桶里取出并执行
   }
})

effect(
  // 一个匿名的副作用函数
  () => {
    console.count('effect')
    document.body.innerText = obj.ok ? obj.text : 'not'
  }
)

setTimeout(() => {
  console.log(obj.text);
  obj.text = 'vue3';
}, 1000)
// setTimeout(() => {
//   console.log(obj.text);
//   obj.text = 'text';
// }, 1000)

function effect(fn:Function) {
  const effectFn = () => {
    cleanup(effectFn)

    // 当 effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn
    fn()
  }
  
  effectFn.deps = []; // 用来存储所有与该副作用函数相关联的依赖集合
  effectFn() // 执行副作用函数
}

// 在 get 拦截函数内调用 track 函数追踪变化
function track(target:object, key:string) {
  // 没有 activeEffect，直接 return
  if (!activeEffect) return

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  
  dep.add(activeEffect)
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(dep) // 新增
}

// 在 set 拦截函数内调用 trigger 函数触发变化
function trigger(target:object, key:string) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  // effects && effects.forEach((fn:Function) => fn())

  const effectsToRun = new Set(effects)
  effectsToRun.forEach((fn:Function) => fn())  
}

/* 
  在调用 forEach 遍历 Set 集合
  时，如果一个值已经被访问过了，但该值被删除并重新添加到集合，
  如果此时 forEach 遍历没有结束，那么该值会重新被访问。 
*/
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    // dep 是依赖集合
    const dep = effectFn.deps[i]
    // 将 effectFn 从依赖集合中移除
    dep.delete(effectFn) 
  }
  // 最后需要重置 effectFn.deps 数组
  effectFn.deps.length = 0
}









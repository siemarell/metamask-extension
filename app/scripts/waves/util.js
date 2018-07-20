export function transformMethods(transformation, obj, target={}){
  Object.keys(obj).forEach(key=>{
    if (typeof obj[key] === 'object'){
      target[key] = {}
      transformMethods(transformation, obj[key], target[key])
    }else if (typeof obj[key] === 'function'){
      target[key] = transformation(obj[key], obj)
    }else {
      target[key] = obj[key]
    }
  })
  return target
}


export function cbToPromise(fn, context){
  return (...args)=>{
    return new Promise((resolve,reject)=>{
      fn.call(context, ...args, (err, val) => {
        if(err){
          reject(err)
        }else{
          resolve(val)
        }
      })
    })
  }
}

export function Account(addr, chain){
  let s = new String(addr);

  s.chain = chain

  return s;
}

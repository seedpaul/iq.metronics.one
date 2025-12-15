export function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function choice(rng, arr){
  return arr[Math.floor(rng()*arr.length)];
}

export function shuffle(rng, arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

export function id(prefix, n){
  return `${prefix}_${n}`;
}

export function clamp(x,a,b){ return Math.min(b, Math.max(a,x)); }

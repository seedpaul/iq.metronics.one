export function clamp(x, a, b){ return Math.min(b, Math.max(a, x)); }

export function formatTime(seconds){
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s/60);
  const r = s%60;
  return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
}

/** Normal CDF using erf approximation */
export function normalCdf(z){
  // Abramowitz-Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z*z/2);
  let p = d*t*(0.3193815 + t*(-0.3565638 + t*(1.781478 + t*(-1.821256 + t*1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/** Inverse normal CDF (Acklam approximation) */
export function normalInv(p){
  // clamp
  p = Math.min(1-1e-12, Math.max(1e-12, p));
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00];

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q, r;

  if (p < plow){
    q = Math.sqrt(-2*Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (phigh < p){
    q = Math.sqrt(-2*Math.log(1-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }

  q = p - 0.5;
  r = q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

export function downloadText(filename, text, mime='text/plain'){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows){
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [];
  lines.push(cols.map(esc).join(','));
  for (const r of rows){
    lines.push(cols.map(c => esc(r[c])).join(','));
  }
  return lines.join('\n');
}

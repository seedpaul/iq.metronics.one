import argparse, csv
import numpy as np
from collections import defaultdict
from utils_io import iter_runs, get_value

def fit_logistic(X, y, iters=80, lr=0.2):
    w = np.zeros(X.shape[1])
    for _ in range(iters):
        z = X @ w
        p = 1/(1+np.exp(-z))
        grad = X.T @ (p - y) / len(y)
        w -= lr*grad
    return w

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--group", required=True)
    ap.add_argument("--domain", default=None)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    runs=[]
    labels=set()
    for _, run in iter_runs(args.input):
        g=get_value(run,args.group)
        if g is None: 
            continue
        labels.add(str(g))
        runs.append(run)

    if len(labels)!=2:
        raise SystemExit(f"Expected binary group for logistic DIF. Found labels: {sorted(labels)}")

    labels=sorted(labels)
    ref, focal = labels[0], labels[1]

    item_rows=defaultdict(list)
    for run in runs:
        grp = 1 if str(get_value(run,args.group))==focal else 0
        log=run.get("log") or []
        dom_scores=defaultdict(int)
        for r in log:
            if r.get("correct") is True:
                dom_scores[r.get("domain")] += 1

        for r in log:
            if r.get("correct") not in (True, False): 
                continue
            dom=r.get("domain")
            if args.domain and dom!=args.domain:
                continue
            item=r.get("itemId")
            score=dom_scores[dom]
            u=1 if r.get("correct") else 0
            item_rows[item].append((score, grp, u))

    out=[]
    for item, rows in item_rows.items():
        if len(rows) < 80:
            continue
        arr=np.array(rows, dtype=float)
        score=arr[:,0]; grp=arr[:,1]; u=arr[:,2]
        s=(score-score.mean())/(score.std()+1e-9)
        X=np.column_stack([np.ones(len(u)), s, grp, s*grp])
        w=fit_logistic(X,u)
        out.append((item, w[2], w[3], len(u)))

    with open(args.out,"w",newline="",encoding="utf-8") as f:
        cw=csv.writer(f)
        cw.writerow(["itemId","b_group_uniform","b_interaction_nonuniform","n"])
        for item, b2, b3, n in sorted(out, key=lambda x: (abs(x[1])+abs(x[2])), reverse=True):
            cw.writerow([item, f"{b2:.4f}", f"{b3:.4f}", n])

    print(f"Wrote {args.out}. Ref='{ref}' focal='{focal}'. Items reported={len(out)} (n>=80).")

if __name__=="__main__":
    main()

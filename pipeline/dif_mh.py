import argparse, csv, math
from collections import defaultdict
from utils_io import iter_runs, get_value

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--group", required=True)
    ap.add_argument("--domain", default=None)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    item_strata = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"A":0,"B":0,"C":0,"D":0})))

    group_counts=defaultdict(int)
    runs=[]
    for _, run in iter_runs(args.input):
        g=get_value(run,args.group)
        if g is None: 
            continue
        group_counts[str(g)]+=1
        runs.append(run)

    if not runs:
        raise SystemExit("No runs found with group labels.")
    ref=max(group_counts.items(), key=lambda x:x[1])[0]

    for run in runs:
        g=str(get_value(run,args.group))
        log=run.get("log") or []
        dom_scores=defaultdict(int)
        for r in log:
            dom=r.get("domain")
            if args.domain and dom!=args.domain:
                continue
            if r.get("correct") is True:
                dom_scores[dom]+=1

        for r in log:
            if r.get("correct") not in (True, False): 
                continue
            dom=r.get("domain")
            if args.domain and dom!=args.domain:
                continue
            item=r.get("itemId")
            stratum=f"{dom}:{dom_scores[dom]}"
            correct=bool(r.get("correct"))
            cell=item_strata[item][stratum][g]
            if g==ref:
                if correct: cell["C"]+=1
                else: cell["D"]+=1
            else:
                if correct: cell["A"]+=1
                else: cell["B"]+=1

    rows=[]
    for item, strata in item_strata.items():
        num=0.0; den=0.0
        for _, groups in strata.items():
            A=B=C=D=0
            for g, cts in groups.items():
                if g==ref:
                    C+=cts["C"]; D+=cts["D"]
                else:
                    A+=cts["A"]; B+=cts["B"]
            N=A+B+C+D
            if N<=0: 
                continue
            num += (A*D)/max(1,N)
            den += (B*C)/max(1,N)
        if den<=0: 
            continue
        alpha=num/den
        delta_mh = -2.35*math.log(alpha)
        rows.append((item, alpha, delta_mh))

    with open(args.out,"w",newline="",encoding="utf-8") as f:
        w=csv.writer(f)
        w.writerow(["itemId","MH_alpha","delta_MH"])
        for item, alpha, delta in sorted(rows, key=lambda x: abs(x[2]), reverse=True):
            w.writerow([item, f"{alpha:.4f}", f"{delta:.4f}"])

    print(f"Wrote {args.out}. Reference group='{ref}'. Items analyzed={len(rows)}")

if __name__=="__main__":
    main()

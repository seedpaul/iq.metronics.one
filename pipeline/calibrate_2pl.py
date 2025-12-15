import argparse, json, math
from collections import defaultdict
from utils_io import iter_runs

def sigmoid(x):
    return 1/(1+math.exp(-x))

def fit_ab(thetas, u, iters=200, lr=0.05):
    a=1.0; b=0.0
    for _ in range(iters):
        da=db=0.0
        for t, y in zip(thetas, u):
            p = sigmoid(a*(t-b))
            p = min(1-1e-6, max(1e-6, p))
            da += (y - p) * (t-b)
            db += (y - p) * (-a)
        a += lr * da/len(u)
        b += lr * db/len(u)
        a = max(0.2, min(3.0, a))
        b = max(-4.0, min(4.0, b))
    return a,b

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--domain", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    persons=[]
    item_u=defaultdict(list)

    for _, run in iter_runs(args.input):
        log=run.get("log") or []
        dom=args.domain
        score=0
        resp=[]
        for r in log:
            if r.get("domain") != dom: 
                continue
            if r.get("correct") is True: score += 1
            if r.get("correct") in (True, False):
                resp.append((r.get("itemId"), 1 if r.get("correct") else 0))
        if len(resp) < 8:
            continue
        persons.append((score, resp))

    if len(persons) < 80:
        raise SystemExit("Need more runs for calibration (try >= 200).")

    scores=[p[0] for p in persons]
    m=sum(scores)/len(scores)
    sd=math.sqrt(sum((x-m)**2 for x in scores)/(len(scores)-1)) if len(scores)>1 else 1.0

    for score, resp in persons:
        theta=(score-m)/(sd+1e-9)
        for item, u in resp:
            item_u[item].append((theta, u))

    params={}
    for item, rows in item_u.items():
        if len(rows) < 120:
            continue
        thetas=[t for t,_ in rows]
        u=[y for _,y in rows]
        a,b=fit_ab(thetas,u)
        params[item]={"a":a,"b":b,"c":0}

    with open(args.out,"w",encoding="utf-8") as f:
        json.dump({"domain":args.domain,"params":params,"nPersons":len(persons)}, f, indent=2)

    print(f"Wrote {args.out}: items={len(params)} persons={len(persons)}")

if __name__=="__main__":
    main()

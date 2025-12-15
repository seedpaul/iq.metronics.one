import argparse, json, math, datetime
from collections import defaultdict
from utils_io import iter_runs, get_value

def mean_sd(vals):
    m = sum(vals)/len(vals)
    v = sum((x-m)**2 for x in vals)/(max(1, len(vals)-1))
    return m, math.sqrt(v) if v>0 else 1.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--version", default=None)
    args = ap.parse_args()

    thetas=[]
    by_band=defaultdict(list)

    for _, run in iter_runs(args.input):
        theta = (((run.get("summary") or {}).get("composite") or {}).get("theta"))
        if theta is None:
            continue
        band = get_value(run, "demographics.ageBandId", default="overall")
        thetas.append(float(theta))
        by_band[band].append(float(theta))

    if not thetas:
        raise SystemExit("No runs found with composite theta.")

    overall_m, overall_sd = mean_sd(thetas)

    bands=[]
    for band, vals in sorted(by_band.items(), key=lambda x:x[0]):
        m, sd = mean_sd(vals)
        bands.append({"id": band, "label": band, "thetaMean": m, "thetaSd": sd, "n": len(vals)})

    version = args.version or "normpack-" + datetime.datetime.utcnow().strftime("%Y%m%d")
    pack = {
        "version": version,
        "createdAt": datetime.datetime.utcnow().isoformat()+"Z",
        "notes": "Generated from collected runs. Non-clinical. Ensure ethical consent and representativeness.",
        "thetaToIQ": { "mean": 100, "sd": 15, "thetaMean": overall_m, "thetaSd": overall_sd },
        "ageBands": bands
    }

    with open(args.out,"w",encoding="utf-8") as f:
        json.dump(pack,f,indent=2)

    print(f"Wrote {args.out} with {len(thetas)} runs. Overall theta mean={overall_m:.3f} sd={overall_sd:.3f}")

if __name__=="__main__":
    main()

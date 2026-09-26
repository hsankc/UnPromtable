import json, numpy as np
w=json.load(open('weights.json')); W1=np.array(w['W1']);b1=np.array(w['b1']);W2=np.array(w['W2']);b2=np.array(w['b2'])
def decide(x):
    h=np.maximum(0,np.array(x,dtype=object)@W1+b1); o=h@W2+b2
    d=0
    if o[1]>o[d]: d=1
    if o[2]>o[d]: d=2
    return d
E=10**18
class Vault:
    def __init__(s,bal,now): s.bal=bal; s.cnt={}; s.tot=0; s.n=0; s.last=0; s.ws=now; s.wo=0; s.now=now
    def feats(s,to,amt,rep,iscontract):
        t=s.bal; wo=0 if s.now-s.ws>3600 else s.wo; since=3600 if s.last==0 else s.now-s.last
        avg=0 if s.n==0 else s.tot//s.n; c=s.cnt.get(to,0); ratio=100 if avg==0 else amt*100//avg
        return [amt*10000//t, 1 if c>0 else 0, min(c,50), (wo+amt)*10000//t, min(since,3600), rep, min(ratio,5000), iscontract]
    def propose(s,to,amt,rep=0,ic=0):
        d=decide(s.feats(to,amt,rep,ic))
        if amt*10000 > s.bal*2000: d=2
        if d==0:
            if s.now-s.ws>3600: s.ws=s.now; s.wo=0
            s.wo+=amt; s.last=s.now; s.cnt[to]=s.cnt.get(to,0)+1; s.tot+=amt; s.n+=1; s.bal-=amt
        return d
def run(step, legit_between=True, hours=1):
    v=Vault(100*E, 1_800_000_000)
    for i in range(20): v.now+=300; v.propose('api1' if i%2==0 else 'api2', E//10, 90, 1)
    ladder=[int(x*E) for x in [5,2,1,0.5,0.25,0.1,0.05,0.02,0.01,0.005,0.002,0.001]]
    stolen=0; slices=0; t0=v.now
    while v.now < t0+3600*hours:
        for a in ladder:
            import copy; s=copy.deepcopy(v)
            if s.propose('atk',a)==0:
                v.propose('atk',a); stolen+=a; slices+=1; break
        v.now+=step
    return stolen/E, slices
for step in [5,30,60,300]:
    for h in [1,24]:
        st,sl=run(step,hours=h); print(f"attacker tries every {step:>3}s for {h:>2}h -> {sl:>4} slices, stole {st:.3f} MON of 98")

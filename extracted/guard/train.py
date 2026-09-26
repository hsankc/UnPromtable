import numpy as np, json
from sklearn.neural_network import MLPClassifier
rng=np.random.default_rng(7)
# Features (all integer-scaled, as the contract will compute them):
# f0 amount/treasury in bps (0..10000)
# f1 recipient seen before (0/1)
# f2 prior payments to recipient (capped 50)
# f3 outflow in last hour incl. this, bps of treasury
# f4 seconds since last outflow (capped 3600)
# f5 recipient ERC-8004 reputation 0..100 (0 = unregistered)
# f6 amount / avg past payment, x100 (capped 5000)
# f7 recipient is contract (0/1)
def normal(n):
    X=[]
    for _ in range(n):
        seen=rng.random()<0.85
        amt=rng.uniform(1,60)                 # bps: tiny API payments
        X.append([amt, seen, rng.integers(1,50) if seen else 0,
                  amt+rng.uniform(0,250), rng.uniform(5,3600),
                  rng.uniform(55,100) if rng.random()<0.8 else rng.uniform(0,55),
                  rng.uniform(30,250), rng.random()<0.6])
    return X
def gray(n):   # unusual but plausible -> delay (owner can veto)
    X=[]
    for _ in range(n):
        seen=rng.random()<0.3
        amt=rng.uniform(150,900)
        X.append([amt, seen, rng.integers(1,5) if seen else 0,
                  amt+rng.uniform(0,600), rng.uniform(5,3600),
                  rng.uniform(20,90), rng.uniform(300,1500), rng.random()<0.5])
    return X
def attack(n):
    X=[]
    for _ in range(n):
        kind=rng.integers(0,3)
        if kind==0:   # one-shot drain to fresh address
            amt=rng.uniform(1000,10000); X.append([amt,0,0,amt,rng.uniform(1,3600),0,rng.uniform(1500,5000),0])
        elif kind==1: # salami: many small, rapid, new address
            amt=rng.uniform(40,200); X.append([amt,rng.random()<0.5,rng.integers(0,3),rng.uniform(1500,6000),rng.uniform(1,20),rng.uniform(0,30),rng.uniform(80,600),0])
        else:         # big to low-rep "agent"
            amt=rng.uniform(900,6000); X.append([amt,rng.random()<0.2,0,amt+rng.uniform(0,500),rng.uniform(1,3600),rng.uniform(0,25),rng.uniform(1000,5000),1])
    return X
Xn,Xg,Xa=normal(6000),gray(2500),attack(4000)
X=np.array(Xn+Xg+Xa,dtype=float); y=np.array([0]*len(Xn)+[1]*len(Xg)+[2]*len(Xa))
X[:,4]=np.minimum(X[:,4],3600); X[:,6]=np.minimum(X[:,6],5000)
scale=np.array([10000,1,50,10000,3600,100,5000,1],dtype=float)
Xs=X/scale
idx=rng.permutation(len(X)); tr,te=idx[:10000],idx[10000:]
clf=MLPClassifier(hidden_layer_sizes=(16,),activation='relu',max_iter=2000,random_state=0).fit(Xs[tr],y[tr])
print("float acc",clf.score(Xs[te],y[te]))
# Quantize: weights to int with Q=1e4, fold input scale into first layer
Q=10000
W1=np.round(clf.coefs_[0]/scale[:,None]*Q).astype(int)       # applied to raw integer features
b1=np.round(clf.intercepts_[0]*Q).astype(int)
W2=np.round(clf.coefs_[1]*Q).astype(int); b2=np.round(clf.intercepts_[1]*Q*Q).astype(int)
def qpred(x):
    h=np.maximum(0, x.astype(np.int64)@W1 + b1)          # scale Q
    return np.argmax(h@W2 + b2,axis=1)                    # scale Q*Q
Xi=np.round(X).astype(int)
print("int acc",(qpred(Xi[te])==y[te]).mean())
json.dump({"W1":W1.tolist(),"b1":b1.tolist(),"W2":W2.tolist(),"b2":b2.tolist()},open("weights.json","w"))
# a few golden vectors
tests={"normal_api":[15,1,20,120,600,85,100,1],"grok_drain":[9500,0,0,9500,900,0,5000,0],
       "salami":[120,0,0,4200,8,5,400,0],"new_vendor_small":[25,0,0,60,1200,70,120,1],"big_to_new":[700,0,0,900,1800,40,900,0]}
print({k:int(qpred(np.array([v]))[0]) for k,v in tests.items()})
json.dump(tests,open("golden.json","w"))
print("params",W1.size+b1.size+W2.size+b2.size, "max|w|",max(abs(W1).max(),abs(W2).max()), "max|b2|",abs(b2).max())

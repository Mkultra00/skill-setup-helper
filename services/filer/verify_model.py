"""Bounded transition-model check. Does not claim equivalence to the full service."""
from z3 import And, Bool, Implies, Int, Not, Solver, sat, unsat

def verify():
    ready, human, unchanged, complete = [Bool(n) for n in ['ready','human','unchanged','complete']]
    count=Int('count')
    attested=And(ready,human,unchanged,complete,count==1)
    checks={
      'Attestation requires human confirmation':Implies(attested,human),
      'Attestation requires unchanged evidence':Implies(attested,unchanged),
      'Attestation requires all assertions':Implies(attested,complete),
      'No bulk attestation':Implies(attested,count==1),
    }
    for name,prop in checks.items():
        solver=Solver();solver.add(Not(prop));assert solver.check()==unsat,name
        print('PROVED (model):',name)
    solver=Solver();solver.add(attested);assert solver.check()==sat,'deny-all policy'
    print('SAT: a legitimate attestation path exists')

if __name__=='__main__':verify()

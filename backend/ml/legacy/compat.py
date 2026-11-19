"""
Cross-version unpickling compatibility helpers for scikit-learn and numpy artifacts.
"""
import sys

try:
    import sklearn._loss._loss as sll
    sys.modules['_loss'] = sll
except ImportError:
    pass

import numpy.random._pickle as _p
import numpy.random._pcg64 as _pcg
import numpy.random.bit_generator as _bg
from numpy.random import Generator

class FixedPCG64(_pcg.PCG64):
    def __setstate__(self, state):
        if isinstance(state, tuple):
            state = dict(state[0])
        else:
            state = dict(state)
        state['bit_generator'] = self.__class__.__name__
        super().__setstate__(state)

_p.BitGenerators['PCG64'] = FixedPCG64
_p.BitGenerators[_pcg.PCG64] = FixedPCG64

def safe_bit_ctor(name='MT19937'):
    if isinstance(name, _bg.BitGenerator):
        return name
    if name == 'PCG64' or name is _pcg.PCG64 or getattr(name, '__name__', None) == 'PCG64':
        return FixedPCG64()
    if isinstance(name, type) and issubclass(name, _bg.BitGenerator):
        return name()
    if hasattr(name, '__name__') and name.__name__ in _p.BitGenerators:
        return _p.BitGenerators[name.__name__]()
    return _p.BitGenerators.get(name, FixedPCG64)()

_p.__bit_generator_ctor = safe_bit_ctor

def safe_gen_ctor(bit_generator_name='MT19937', bit_generator_ctor=safe_bit_ctor):
    if isinstance(bit_generator_name, _bg.BitGenerator):
        return Generator(bit_generator_name)
    bg_inst = bit_generator_ctor(bit_generator_name)
    return Generator(bg_inst)

_p.__generator_ctor = safe_gen_ctor

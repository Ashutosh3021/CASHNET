"""Inspect the loaded model artifacts and report their state."""
import sys
sys.path.insert(0, 'C:/Users/ashut/Downloads/CASHNET')
from lib.artifacts import load_model

for fn in ['182_model.pkl', '183_model.pkl', '184_model.pkl']:
    path = f'C:/Users/ashut/Downloads/CASHNET/models/{fn}'
    try:
        obj, header = load_model(path)
        print(f'\n=== {fn} ===')
        print(f'  model type: {type(obj).__name__}')
        print(f'  header: {header}')
        if hasattr(obj, 'trained'):
            print(f'  trained: {obj.trained}')
        if hasattr(obj, 'metrics') and obj.metrics:
            print(f'  metric keys: {list(obj.metrics.keys())}')
            for k, v in obj.metrics.items():
                if isinstance(v, dict) and 'accuracy' in v:
                    print(f'  {k} accuracy: {v["accuracy"]:.4f}')
                elif isinstance(v, dict) and 'f1' in v:
                    print(f'  {k} f1: {v["f1"]:.4f}')
        # Test a basic prediction
        print(f'  Has predict method: {hasattr(obj, "predict")}')
    except Exception as e:
        print(f'{fn}: ERROR - {e}')

print('\nDone.')

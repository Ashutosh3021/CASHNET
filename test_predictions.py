"""Test actual model predictions to verify determinism and correctness."""
import sys
sys.path.insert(0, 'C:/Users/ashut/Downloads/CASHNET')
from lib.model_manager import predict, get_model_status

# Test record
test_record = {
    "risk_score": 0.85,
    "transaction_count": 15,
    "amount": 185000.0,
    "age_days": 2,
    "city": "Bengaluru",
    "fraud_type": "UPI fraud",
    "case_id": "TEST-001",
    "bank_transaction_data": {
        "source_account": {"account_number": "XXXXXX4821"},
        "atm_id": "ATM-BLR-001",
        "destination_city": "Mumbai"
    },
    "fraud_details": {
        "type": "investment_scam",
        "sub_type": "impersonation",
        "description": "Victim induced to transfer funds via UPI to investment scheme",
        "platform_used": "WhatsApp"
    },
    "victim_details": {"city": "Bengaluru"}
}

print("=== Testing Model Predictions ===\n")

for model_id in [182, 183, 184]:
    print(f"--- Model {model_id} ---")
    try:
        result = predict(model_id, test_record)
        print(f"  model_id: {result.get('model_id')}")
        print(f"  confidence: {result.get('confidence')}")
        print(f"  needs_review: {result.get('needs_review')}")
        if 'risk_object' in result:
            ro = result['risk_object']
            print(f"  risk_score: {ro.get('risk_score'):.3f}")
            print(f"  risk_label: {ro.get('risk_label')}")
        if 'predicted_coordinates' in result:
            print(f"  predicted_coords: {result['predicted_coordinates']}")
        if 'metadata' in result:
            md = result['metadata']
            if isinstance(md, dict):
                print(f"  metadata model: {md.get('model')}")
                if 'predicted_withdrawal_city' in md:
                    print(f"  predicted_city: {md.get('predicted_withdrawal_city')}")
        if 'error' in result:
            print(f"  ERROR: {result['error']}")
    except Exception as e:
        print(f"  EXCEPTION: {e}")
    print()

# Test determinism: run same input twice
print("=== Determinism Test ===")
r1 = predict(184, test_record)
r2 = predict(184, test_record)
c1 = r1.get('confidence', -1)
c2 = r2.get('confidence', -1)
print(f"Run 1 confidence: {c1}")
print(f"Run 2 confidence: {c2}")
print(f"Deterministic: {abs(c1 - c2) < 1e-9}")

# Test missing features
print("\n=== Missing Features Test ===")
empty_record = {}
for model_id in [182, 183, 184]:
    try:
        result = predict(model_id, empty_record)
        print(f"Model {model_id} with empty record: ok, confidence={result.get('confidence', 'N/A')}")
    except Exception as e:
        print(f"Model {model_id} with empty record: EXCEPTION {e}")

# Test out-of-range values
print("\n=== Out-of-Range Values Test ===")
bad_record = {"risk_score": 999, "transaction_count": -5, "amount": float('inf'), "age_days": -1}
for model_id in [182, 183, 184]:
    try:
        result = predict(model_id, bad_record)
        print(f"Model {model_id} with bad values: ok, confidence={result.get('confidence', 'N/A')}")
    except Exception as e:
        print(f"Model {model_id} with bad values: EXCEPTION {e}")

print("\nDone.")

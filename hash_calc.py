import hashlib

def get_sha256(s):
    return hashlib.sha256(s.strip().encode('utf-8')).hexdigest()

user_hash = get_sha256("AZU_005")
pass_hash = get_sha256("AZU@2000")

# Combined token hash for auth token verification
combined_hash = get_sha256("AZU_005:AZU@2000")

print(f"Username Hash: {user_hash}")
print(f"Password Hash: {pass_hash}")
print(f"Combined Hash: {combined_hash}")

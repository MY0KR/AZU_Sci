import urllib.request
import json

url = "https://script.google.com/macros/s/AKfycbybIxEhSMsdhVqg1h_YuqPMVeaBZWI1Wj8p3GXoGGjRu9QdLd_rR-3MDqF3w_q9WB_f/exec"

req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status code:", response.status)
        raw = response.read().decode('utf-8')
        print("Response length:", len(raw))
        try:
            data = json.loads(raw)
            print("Keys:", list(data.keys()) if isinstance(data, dict) else f"Array of length {len(data)}")
            print("Preview:", str(data)[:500])
        except Exception as e:
            print("Non-JSON response preview:", raw[:500])
except Exception as e:
    print("Error fetching GAS URL:", e)

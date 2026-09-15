import os

scratch_dir = r"C:\Users\my0kr\.gemini\antigravity\scratch\azu-science-portal"
art_dir = r"C:\Users\my0kr\.gemini\antigravity\brain\f3c3ebe7-e7eb-4ec9-8503-8b000a259d9a"

# Read logo base64
with open(os.path.join(scratch_dir, "logo_b64.txt"), "r", encoding="utf-8") as f:
    logo_b64 = f.read().strip()

# Read index_template.html
with open(os.path.join(scratch_dir, "index_template.html"), "r", encoding="utf-8") as f:
    template = f.read()

# Replace placeholder
final_html = template.replace("{{LOGO_BASE64}}", logo_b64)

# Write to scratch
with open(os.path.join(scratch_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(final_html)

# Write to artifact
with open(os.path.join(art_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(final_html)

# Also copy other assets to artifact dir for direct preview
for fname in ["app.html", "app.js", "ai-layer.js", "gas-client.js", "manifest.json", "service-worker.js", "capacitor.config.json"]:
    src = os.path.join(scratch_dir, fname)
    if os.path.exists(src):
        with open(src, "r", encoding="utf-8") as src_f:
            content = src_f.read()
        with open(os.path.join(art_dir, fname), "w", encoding="utf-8") as dst_f:
            dst_f.write(content)

print("Successfully injected logo and built all files!")

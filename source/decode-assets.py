# Restores public/img/* from img-assets.b64.txt (poster images stored as text).
import base64, os
os.makedirs("public/img", exist_ok=True)
for line in open("public/img-assets.b64.txt"):
    if ":" in line:
        n, b = line.strip().split(":", 1)
        open("public/img/" + n, "wb").write(base64.b64decode(b))

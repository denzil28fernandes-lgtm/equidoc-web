import requests
import json
import base64

# Create a tiny 1x1 black pixel jpeg
b64_img = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

data = {
    "images": [b64_img],
    "language": "English"
}

try:
    res = requests.post("http://localhost:5173/api/analyze", json=data)
    print("STATUS:", res.status_code)
    print("BODY:", res.text)
except Exception as e:
    print("ERROR:", str(e))

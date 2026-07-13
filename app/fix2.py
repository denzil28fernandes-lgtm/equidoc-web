import re

with open("app/src/App.jsx", "r") as f:
    content = f.read()

# Remove doShoot completely
content = re.sub(r"  const doShoot = async \(\) => \{.*?\n  \}\n", "", content, flags=re.DOTALL)

# Remove handleFile completely (not handleFiles)
content = re.sub(r"  const handleFile = \(e\) => \{.*?\n  \}\n", "", content, flags=re.DOTALL)

# Remove stopCamera from unmount cleanup
content = content.replace("cancelSpeech(); stopCamera()", "cancelSpeech();")

with open("app/src/App.jsx", "w") as f:
    f.write(content)

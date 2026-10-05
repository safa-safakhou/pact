"""Mechanical export of the approved imagegen parchment; no creative edits."""
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2]
image=Image.open(R/'assets/experience/proof/parchment.png').convert('RGB')
image.resize((256,256),Image.Resampling.LANCZOS).save(R/'apps/web/public/experience/scene/parchment.png',optimize=True)

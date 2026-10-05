from pathlib import Path
import shutil
r=Path(__file__).resolve().parents[2]
shutil.copyfile(r/"assets/experience/motion.css",r/"apps/web/public/experience/motion.css")

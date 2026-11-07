"""Build the self-contained report.html and slides.html (images and reveal.js inlined).

Run from the iConcierge folder:  python docs/build.py
"""

import base64
import re
from pathlib import Path

DOCS = Path(__file__).resolve().parent
ROOT = DOCS.parent


def inline(template: str) -> str:
    def img(m: re.Match) -> str:
        data = (DOCS / "screenshots" / m.group(1)).read_bytes()
        mime = "image/png" if m.group(1).endswith(".png") else "image/jpeg"
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"

    def vendor(m: re.Match) -> str:
        # Keep </script> or </style> inside the library from closing the tag early.
        text = (DOCS / "vendor" / m.group(2)).read_text(encoding="utf-8")
        return text.replace("</script", "<\\/script") if m.group(1) == "JS" else text

    template = re.sub(r"\{\{IMG:([\w.-]+)\}\}", img, template)
    return re.sub(r"\{\{(CSS|JS):([\w.-]+)\}\}", vendor, template)


for src, out in (("report_src.html", "report.html"), ("slides_src.html", "slides.html")):
    html = inline((DOCS / src).read_text(encoding="utf-8"))
    assert "{{" not in html, f"unfilled placeholder in {src}"
    (ROOT / out).write_text(html, encoding="utf-8")
    print(f"{out}: {len(html.encode('utf-8')) / 1024:.0f} KB")

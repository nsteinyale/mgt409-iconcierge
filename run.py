"""Start iConcierge: python run.py  (then open http://127.0.0.1:8765)."""

import os
import threading
import webbrowser

import uvicorn

HOST = os.getenv("ICONCIERGE_HOST", "127.0.0.1")
PORT = int(os.getenv("ICONCIERGE_PORT", "8765"))

if __name__ == "__main__":
    if os.getenv("ICONCIERGE_NO_BROWSER") != "1":
        threading.Timer(1.5, lambda: webbrowser.open(f"http://{HOST}:{PORT}")).start()
    uvicorn.run("backend.main:app", host=HOST, port=PORT)

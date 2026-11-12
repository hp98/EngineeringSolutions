"""Bundle src/ into one self-contained page.

dist/index.html     full HTML document; open it directly or host it anywhere static.
dist/artifact.html  same content without the document skeleton, for claude.ai Artifacts.
"""
import json
from pathlib import Path

SRC = Path(__file__).parent
DIST = SRC.parent / "dist"


def main():
    questions = json.loads((SRC / "questions.json").read_text(encoding="utf8"))
    data = "window.QB = " + json.dumps(questions, ensure_ascii=False) + ";\n"
    data += (SRC / "primers-a.js").read_text(encoding="utf8") + "\n"
    data += (SRC / "primers-b.js").read_text(encoding="utf8")
    data = data.replace("</", "<\\/")  # never close the inline <script> early

    app = (SRC / "app.html").read_text(encoding="utf8").replace("/*__DATA__*/", data, 1)
    head, body = app.split("<!--BODY-->", 1)

    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(head + body, encoding="utf8")
    (DIST / "index.html").write_text(
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + "</head>\n<body>\n" + body + "</body>\n</html>\n",
        encoding="utf8",
    )
    print("built", (DIST / "index.html").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()

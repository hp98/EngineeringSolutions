"""Extract the 600 Q&As from the question bank .docx into src/questions.json."""
import html, json, re, sys, zipfile

SLUGS = {
    "Power BI": "powerbi", "DAX": "dax", "SQL": "sql", "Python (for Data Roles)": "python",
    "Pandas & DataFrames": "pandas", "Microsoft Fabric (End-to-End)": "fabric",
    "Apache Spark / Spark SQL / PySpark": "spark", "Databricks": "databricks", "dbt": "dbt",
    "Airflow & Orchestration": "airflow", "Data Engineering Best Practices": "bestpractices",
    "Azure (Data Platform)": "azure",
}

def main(src, out):
    xml = zipfile.ZipFile(src).read("word/document.xml").decode("utf8")
    topics, cur = [], None
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, flags=re.S):
        style = re.search(r'<w:pStyle w:val="([^"]+)"', p)
        text = html.unescape("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p))).strip()
        if not text:
            continue
        if style and style.group(1) == "Heading2":
            name = text.split(" — ")[0]
            cur = {"id": SLUGS[name], "name": name, "questions": []}
            topics.append(cur)
        elif cur and (m := re.match(r"Q(\d+)\.\s*(.*)", text)):
            cur["questions"].append({"n": int(m.group(1)), "q": m.group(2)})
        elif cur and text.startswith("A. "):
            cur["questions"][-1]["a"] = text[3:]
    assert len(topics) == 12 and all(len(t["questions"]) == 50 for t in topics)
    json.dump(topics, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=0)
    print("ok", sum(len(t["questions"]) for t in topics))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

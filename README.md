# Engineering Solutions

A study site for 12 data analytics and data engineering technologies: Power BI, DAX, SQL, Python, pandas, Microsoft Fabric, Spark, Databricks, dbt, Airflow, data engineering best practices and Azure.

Each technology has a short lesson with real-world examples (built around a fictional freight company, Meridian Freight) and 50 interview questions with model answers: 600 in total. The site includes search, flashcards and spaced-repetition practice. Progress is saved in the browser.

## Use it

Open `dist/index.html` in a browser. It is a single self-contained file, so it also works on any static host such as GitHub Pages.

## Edit it

| File | Contents |
| --- | --- |
| `src/app.html` | Page layout, styles and app logic |
| `src/primers-a.js` | Lessons for the analytics stack |
| `src/primers-b.js` | Lessons for the engineering stack |
| `src/questions.json` | The 600 questions and answers |
| `src/extract.py` | Regenerates `questions.json` from the source .docx question bank |
| `src/build.py` | Bundles everything into `dist/` |

After editing, rebuild:

```bash
python src/build.py
```

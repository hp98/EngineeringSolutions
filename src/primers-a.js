// Learn-tab content for Part A (Analytics stack).
// Every example follows Meridian Freight, a fictional freight forwarder that moves
// containers between ports and bills customers per charge line.
window.PRIMERS = window.PRIMERS || {};

PRIMERS.powerbi = {
  short: "Power BI",
  part: "A",
  stage: "Serve",
  tagline: "Turn modelled data into reports people actually open.",
  what: "Power BI is Microsoft's business intelligence platform. You build a semantic model (tables, relationships, measures) and lay reports on top of it. Desktop is where you author; the Service is where you publish, refresh, secure and share.",
  analogy: "Think of the semantic model as a well-labelled warehouse and reports as shop windows. If the warehouse shelves are organised (a star schema), every window can be dressed quickly. If everything is dumped in one pile, every window takes forever.",
  story: "Meridian's commercial team wants a daily view of revenue by trade lane, customer and vessel. Shipments and invoices come from the ERP, ports from a reference list. You import them into a star schema, write a handful of measures, secure each regional manager to their own region with RLS, and publish one app that refreshes at 06:00 every morning.",
  concepts: [
    {
      t: "Storage modes: Import, DirectQuery, Dual, Direct Lake",
      body: "Import copies data into the in-memory VertiPaq engine and is the fastest to query, but it is only as fresh as the last refresh. DirectQuery sends every visual's query to the source, so data is live but slower and some DAX is restricted. Dual lets a dimension behave as either. Direct Lake (Fabric) reads Delta files in OneLake straight into memory without a scheduled import.",
      example: "Meridian imports invoices (5 years, refreshed nightly) but uses DirectQuery for the live container-tracking table that operations watch through the day. That mix is a composite model.",
      qs: [2, 3, 45]
    },
    {
      t: "Star schema: facts in the middle, dimensions around",
      body: "A fact table stores events at a declared grain (one row per invoice charge line) with numeric columns and foreign keys. Dimension tables describe the who, what, where and when. Filters flow from dimensions (the one side) to facts (the many side). This shape keeps DAX simple and compression high.",
      example: "FactChargeLine (grain: one charge per invoice) links to DimCustomer, DimLane, DimVessel and DimDate. 'Revenue by customer for Q3 on the Asia–Gulf lane' becomes three slicers and one measure.",
      code: "FactChargeLine[CustomerKey]  →  DimCustomer[CustomerKey]   (many : 1)\nFactChargeLine[LaneKey]      →  DimLane[LaneKey]           (many : 1)\nFactChargeLine[InvoiceDate]  →  DimDate[Date]              (many : 1, active)\nFactChargeLine[ShipDate]     →  DimDate[Date]              (many : 1, inactive)",
      lang: "text",
      qs: [8, 9, 10, 13]
    },
    {
      t: "VertiPaq and cardinality",
      body: "VertiPaq stores each column separately and compresses it with dictionary and run-length encoding. Columns with few distinct values compress well; unique IDs and full timestamps do not. Most model-size wins come from removing columns you do not need and lowering cardinality.",
      example: "Splitting Meridian's 'EventTimestamp' (millions of distinct values) into a Date column and an Hour column cut the model from 2.1 GB to 600 MB with no loss for reporting.",
      qs: [5, 48]
    },
    {
      t: "Power Query and query folding",
      body: "Power Query (the M language) shapes data before it lands in the model. When steps 'fold', Power Query translates them into a single native query that runs at the source, so only the result travels. A step that cannot fold forces everything after it to run on the gateway or in memory.",
      example: "Filtering invoices to the last 5 years folds into a WHERE clause on SQL Server. Adding a custom M function before that filter broke folding and made the refresh pull 40 million rows instead of 9 million.",
      code: "// Right-click a step → \"View Native Query\".\n// Greyed out means the step no longer folds.\nlet\n    Source = Sql.Database(\"erp-sql\", \"Finance\"),\n    Charges = Source{[Schema=\"dbo\",Item=\"ChargeLine\"]}[Data],\n    Recent = Table.SelectRows(Charges, each [InvoiceDate] >= #date(2021,1,1))\nin\n    Recent",
      lang: "m",
      qs: [6, 7, 38]
    },
    {
      t: "Row-Level Security and refresh",
      body: "RLS limits which rows a user sees through DAX filters on roles. Dynamic RLS uses USERPRINCIPALNAME() against a mapping table, so one role serves everyone. Refresh runs in the Service on a schedule; on-premises sources need a gateway, and big tables use incremental refresh so only recent partitions reload.",
      example: "A UserRegion table maps each manager's email to their region. One role with the filter below means the Gulf manager sees only Gulf shipments, and a new manager only needs a row in the table.",
      code: "-- Role filter on DimRegion\n[RegionKey] IN\n    CALCULATETABLE (\n        VALUES ( UserRegion[RegionKey] ),\n        UserRegion[Email] = USERPRINCIPALNAME ()\n    )",
      lang: "dax",
      qs: [14, 16, 35, 36]
    }
  ],
  pitfalls: [
    "Leaving auto date/time on. It creates a hidden date table for every date column and bloats the model.",
    "Bidirectional relationships everywhere. They create ambiguous filter paths and slow queries.",
    "One wide flat table instead of a star. DAX gets harder and compression gets worse.",
    "Debugging 'wrong numbers' in the visual first. Check the model grain and filters before rewriting measures."
  ]
};

PRIMERS.dax = {
  short: "DAX",
  part: "A",
  stage: "Serve",
  tagline: "The formula language behind every Power BI number.",
  what: "DAX (Data Analysis Expressions) is the language for measures, calculated columns and tables in Power BI, Analysis Services and Fabric semantic models. It looks like Excel but behaves like a query language: every result depends on the filters around it.",
  analogy: "A measure is a question you ask, and filter context is everything the person asking is pointing at. 'Total revenue' asked while pointing at the 2025 column and the Gulf row means 'revenue for Gulf in 2025'. CALCULATE lets you change what is being pointed at before answering.",
  story: "Meridian's CFO wants revenue, revenue last year, YoY growth, and each lane's share of total that still respects the region slicer. With a proper date table these are five short measures, each built from the one before.",
  concepts: [
    {
      t: "Row context vs filter context",
      body: "Filter context is the set of filters applied by visuals, slicers and CALCULATE. Row context exists when DAX walks a table row by row, as in a calculated column or an iterator like SUMX. Row context does not filter anything on its own; that is the most common source of confusion.",
      example: "In a matrix with Year on rows, [Revenue] in the 2025 cell sees a filter context of DimDate[Year] = 2025. Inside SUMX(FactChargeLine, ...) each charge line is the current row, but other tables are not filtered by it unless context transition happens.",
      qs: [1, 14]
    },
    {
      t: "CALCULATE and context transition",
      body: "CALCULATE evaluates an expression under a modified filter context. Its filter arguments add, replace or remove filters. When CALCULATE runs inside a row context, it first turns the current row into an equivalent filter context. That step is context transition, and it happens implicitly whenever you call a measure inside an iterator.",
      example: "Revenue for the Asia–Gulf lane regardless of what lane is selected:",
      code: "Revenue := SUM ( FactChargeLine[Amount] )\n\nRevenue Asia-Gulf :=\nCALCULATE ( [Revenue], DimLane[LaneName] = \"Asia-Gulf\" )",
      lang: "dax",
      qs: [2, 3, 7, 8]
    },
    {
      t: "Iterators: SUM vs SUMX",
      body: "SUM aggregates one column. SUMX iterates a table, evaluates an expression for each row, then sums the results. You need an iterator when the value has to be computed per row before aggregating, such as quantity × rate.",
      example: "Containers are billed at a per-TEU rate, so revenue must be computed per line first:",
      code: "Freight Revenue :=\nSUMX ( FactChargeLine, FactChargeLine[TEU] * FactChargeLine[RatePerTEU] )",
      lang: "dax",
      qs: [4, 5]
    },
    {
      t: "Time intelligence",
      body: "Functions such as TOTALYTD, SAMEPERIODLASTYEAR and DATESINPERIOD shift the date filter. They need a contiguous date table marked as a date table, joined to the fact on a date column. Fiscal and 4-4-5 calendars usually need custom logic on calendar columns instead.",
      example: "Year-to-date, last year and YoY growth, each reusing the previous measure (measure branching):",
      code: "Revenue YTD := TOTALYTD ( [Revenue], DimDate[Date] )\n\nRevenue LY := CALCULATE ( [Revenue], SAMEPERIODLASTYEAR ( DimDate[Date] ) )\n\nRevenue YoY % :=\nVAR Curr = [Revenue]\nVAR Prev = [Revenue LY]\nRETURN DIVIDE ( Curr - Prev, Prev )",
      lang: "dax",
      qs: [15, 16, 17, 18, 44]
    },
    {
      t: "Removing filters: ALL, ALLSELECTED, REMOVEFILTERS",
      body: "ALL and REMOVEFILTERS clear filters from a table or column. ALLSELECTED clears filters coming from inside the visual but keeps the ones from slicers and outer filters. Choosing the right one decides whether a '% of total' respects the user's selection.",
      example: "Each lane's share of revenue, honouring the region slicer but not the lane on the row:",
      code: "Lane Share % :=\nVAR AllLanes = CALCULATE ( [Revenue], REMOVEFILTERS ( DimLane[LaneName] ) )\nRETURN DIVIDE ( [Revenue], AllLanes )",
      lang: "dax",
      qs: [6, 48, 50]
    }
  ],
  pitfalls: [
    "Using FILTER over a whole fact table inside CALCULATE when a simple column predicate would do.",
    "Returning 0 instead of BLANK(). Visuals then render every empty combination and slow down.",
    "Calculated columns for things that should be measures. Columns are computed at refresh and stored; measures respond to filters.",
    "Expecting the total row to be the sum of the rows. Totals are evaluated in their own filter context."
  ]
};

PRIMERS.sql = {
  short: "SQL",
  part: "A",
  stage: "Transform",
  tagline: "The common language of every database and warehouse.",
  what: "SQL is the declarative language for querying and changing relational data. You describe the result you want and the engine's optimizer decides how to get it. Nearly every tool in this guide, from Power BI to Spark to dbt, speaks it.",
  analogy: "Writing SQL is like giving a librarian a request slip. You describe the books you want, not which aisles to walk. Indexes and statistics are the librarian's map; a vague slip (a non-SARGable predicate) makes them search every shelf.",
  story: "Meridian's finance analyst needs, per customer, the latest invoice, running monthly revenue and month-over-month change. With CTEs and window functions that is one readable query instead of three spreadsheets.",
  concepts: [
    {
      t: "Logical order of execution",
      body: "SQL is written SELECT-first but evaluated FROM-first: FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT. That is why a SELECT alias works in ORDER BY but not in WHERE, and why aggregates belong in HAVING.",
      example: "Customers with more than AED 1M revenue in 2025:",
      code: "SELECT   c.customer_name, SUM(f.amount) AS revenue\nFROM     fact_charge_line f\nJOIN     dim_customer c ON c.customer_key = f.customer_key\nWHERE    f.invoice_date >= '2025-01-01'     -- filter rows first\nGROUP BY c.customer_name\nHAVING   SUM(f.amount) > 1000000            -- then filter groups\nORDER BY revenue DESC;                      -- alias allowed here",
      lang: "sql",
      qs: [1, 2]
    },
    {
      t: "Joins and fan-out",
      body: "INNER keeps matches, LEFT keeps every left row, FULL keeps both sides. Joining on a key that is not unique on one side duplicates rows and silently inflates totals. Always know the grain of each side before joining.",
      example: "Joining invoices to a container table that has one row per container per voyage doubled revenue for multi-container shipments. Aggregating containers to shipment level first fixed it.",
      code: "-- Check uniqueness before you join\nSELECT shipment_id, COUNT(*)\nFROM   containers\nGROUP  BY shipment_id\nHAVING COUNT(*) > 1;",
      lang: "sql",
      qs: [3, 4, 17]
    },
    {
      t: "Window functions",
      body: "Window functions compute across a set of related rows without collapsing them. PARTITION BY defines the group, ORDER BY the sequence, and the frame (ROWS BETWEEN …) how far to look. They power ranking, running totals, deduplication and period-over-period change.",
      example: "Keep only the latest status per shipment, a pattern every pipeline needs:",
      code: "WITH ranked AS (\n  SELECT *,\n         ROW_NUMBER() OVER (\n           PARTITION BY shipment_id\n           ORDER BY status_ts DESC) AS rn\n  FROM shipment_status\n)\nSELECT * FROM ranked WHERE rn = 1;",
      lang: "sql",
      qs: [8, 9, 10, 13, 37]
    },
    {
      t: "NULL logic",
      body: "NULL means unknown, so NULL = NULL is not true. Comparisons with NULL return unknown and are filtered out by WHERE. COUNT(column) skips NULLs, NOT IN with a NULL in the list returns nothing, and joins never match on NULL keys.",
      example: "A report of 'shipments not invoiced' returned zero rows because the subquery's invoice list contained a NULL. Rewriting NOT IN as NOT EXISTS fixed it.",
      code: "SELECT s.shipment_id\nFROM   shipments s\nWHERE  NOT EXISTS (\n  SELECT 1 FROM invoices i WHERE i.shipment_id = s.shipment_id\n);",
      lang: "sql",
      qs: [17, 18, 19]
    },
    {
      t: "Indexes, plans and SARGability",
      body: "An index lets the engine seek to rows instead of scanning the table. A predicate is SARGable when the engine can use an index for it. Wrapping the column in a function (YEAR(date) = 2025) usually stops that; rewrite it as a range instead. Read the execution plan to see what actually happened.",
      example: "Changing WHERE YEAR(invoice_date) = 2025 to the range below turned a 40-second scan into a sub-second seek.",
      code: "WHERE invoice_date >= '2025-01-01'\n  AND invoice_date <  '2026-01-01'",
      lang: "sql",
      qs: [26, 27, 30, 47]
    }
  ],
  pitfalls: [
    "UNION when UNION ALL would do. UNION adds a costly dedup step.",
    "SELECT * in production queries. It breaks when columns change and reads data you do not need.",
    "NOT IN against a column that can contain NULL.",
    "Assuming a query returns rows in order without an ORDER BY."
  ]
};

PRIMERS.python = {
  short: "Python",
  part: "A",
  stage: "Ingest",
  tagline: "The glue language for pipelines, APIs and automation.",
  what: "Python is a general-purpose language that has become the default for data work: calling APIs, moving files, cleaning data, writing tests and driving Spark. For data roles the focus is on writing reliable, testable scripts rather than clever code.",
  analogy: "If SQL is how you ask a database a question, Python is the courier that fetches data from places SQL cannot reach (APIs, files, emails) and drops it where the database can.",
  story: "Meridian receives vessel ETAs from a carrier API that pages 500 records at a time and throttles bursts. A 60-line Python script with retries, logging and a watermark lands the data in the lake every hour and can be rerun safely.",
  concepts: [
    {
      t: "Core data structures",
      body: "Lists are ordered and mutable. Tuples are ordered and immutable, so they can be dictionary keys. Sets hold unique items with fast membership checks. Dicts map keys to values with O(1) lookup. Picking the right one is often the biggest performance win in plain Python.",
      example: "Checking 2 million container IDs against a list of 50,000 'flagged' IDs took minutes. Converting the list to a set took it under a second.",
      code: "flagged = set(load_flagged_ids())          # O(1) lookups\nhits = [c for c in containers if c.id in flagged]",
      lang: "python",
      qs: [1, 2, 3]
    },
    {
      t: "Generators for large data",
      body: "A generator yields one item at a time instead of building the whole result in memory. Use them to stream files, paginate APIs and process data bigger than RAM.",
      example: "Reading a 50 GB port-event log line by line with constant memory:",
      code: "def read_events(path):\n    with open(path, encoding=\"utf-8\") as f:\n        for line in f:\n            yield parse(line)\n\nfor event in read_events(\"port_events.log\"):\n    handle(event)",
      lang: "python",
      qs: [7, 8, 26, 47]
    },
    {
      t: "Decorators and context managers",
      body: "A decorator wraps a function to add behaviour such as timing, logging or retries without changing its body. A context manager (the with statement) guarantees setup and cleanup, so files and connections close even when an error is raised.",
      example: "A retry decorator for a flaky carrier API:",
      code: "import functools, random, time\n\ndef retry(times=5, base=1.0):\n    def wrap(fn):\n        @functools.wraps(fn)\n        def inner(*a, **kw):\n            for attempt in range(times):\n                try:\n                    return fn(*a, **kw)\n                except TransientError:\n                    if attempt == times - 1:\n                        raise\n                    time.sleep(base * 2 ** attempt + random.random())\n        return inner\n    return wrap\n\n@retry()\ndef fetch_page(url): ...",
      lang: "python",
      qs: [12, 13, 49]
    },
    {
      t: "Errors, logging and idempotency",
      body: "Catch only the exceptions you can handle and let the rest fail loudly. Use the logging module with levels instead of print. Make loads idempotent (rerunning gives the same result), for example by overwriting a date partition or upserting on a key.",
      example: "Meridian's hourly ETA load writes to a folder named by load hour and replaces it on rerun, so a retry after a crash never duplicates rows.",
      qs: [14, 15, 34, 43]
    },
    {
      t: "Project structure and testing",
      body: "Production scripts need a src layout, config separated from code, pinned dependencies in a virtual environment, secrets from environment variables or a key vault, and pytest tests for the transformation logic.",
      example: "A small test that pins down how negative charges are handled:",
      code: "import pytest\nfrom etl.transform import normalise_charge\n\n@pytest.mark.parametrize(\"raw, expected\", [\n    ({\"amount\": \"120.50\"}, 120.50),\n    ({\"amount\": \"-15\"}, -15.0),     # credit notes stay negative\n])\ndef test_normalise_charge(raw, expected):\n    assert normalise_charge(raw) == expected",
      lang: "python",
      qs: [21, 33, 35, 41]
    }
  ],
  pitfalls: [
    "Mutable default arguments (def f(x=[])). The list is shared across calls.",
    "Using float for money. Use Decimal or integer minor units (fils, cents).",
    "Bare except: that swallows every error, including the ones you need to see.",
    "Timezone-naive datetimes in data that crosses regions."
  ]
};

PRIMERS.pandas = {
  short: "Pandas",
  part: "A",
  stage: "Transform",
  tagline: "Spreadsheet power with code you can rerun.",
  what: "pandas is the Python library for tabular data in memory. A DataFrame is a table of columns (Series) sharing an index. It is ideal for exploration, cleaning and medium-sized transformations up to a few GB.",
  analogy: "A DataFrame is an Excel sheet that remembers every step you took. Instead of clicking through filters each month, you rerun the script and get the same answer.",
  story: "Each day Meridian receives a 5-million-row charges CSV from a partner. A pandas script reads only the needed columns with explicit dtypes, deduplicates, validates totals against the control file and writes monthly Parquet that Power BI picks up.",
  concepts: [
    {
      t: "Selecting with loc and iloc",
      body: "loc selects by label and boolean masks; iloc selects by integer position. Combine conditions with & and | and wrap each in parentheses. Assign with loc in one step to avoid chained indexing.",
      example: "Flag high-value Gulf shipments in place:",
      code: "mask = (df[\"region\"] == \"Gulf\") & (df[\"amount\"] > 50_000)\ndf.loc[mask, \"priority\"] = \"high\"",
      lang: "python",
      qs: [2, 3, 4, 43]
    },
    {
      t: "dtypes and memory",
      body: "Text columns default to object dtype, which is slow and memory hungry. Low-cardinality strings should be category; integers with gaps need nullable Int64. Setting dtypes and usecols when reading is the cheapest optimisation.",
      example: "Reading the partner file with explicit types cut memory from 4.2 GB to 900 MB:",
      code: "df = pd.read_csv(\n    \"charges.csv\",\n    usecols=[\"shipment_id\", \"port\", \"charge_type\", \"amount\", \"invoice_date\"],\n    dtype={\"port\": \"category\", \"charge_type\": \"category\", \"shipment_id\": \"string\"},\n    parse_dates=[\"invoice_date\"],\n)",
      lang: "python",
      qs: [5, 6, 7, 8]
    },
    {
      t: "merge, and validating joins",
      body: "merge is pandas' SQL join. Pass validate= to assert the expected relationship (\"many_to_one\") and indicator=True to see which side each row came from. Both catch silent duplication early.",
      example: "Attach customer names and fail fast if the customer table has duplicate keys:",
      code: "out = charges.merge(\n    customers, on=\"customer_id\", how=\"left\",\n    validate=\"many_to_one\", indicator=True,\n)\nunmatched = out[out[\"_merge\"] == \"left_only\"]",
      lang: "python",
      qs: [11, 12, 34]
    },
    {
      t: "groupby: agg vs transform",
      body: "groupby splits rows into groups. agg returns one row per group; transform returns a result aligned to the original rows, which is what you need for '% of group total' or filling within a group.",
      example: "Revenue per lane, and each shipment's share of its lane:",
      code: "lane_rev = df.groupby(\"lane\", as_index=False).agg(revenue=(\"amount\", \"sum\"))\n\ndf[\"lane_share\"] = df[\"amount\"] / df.groupby(\"lane\")[\"amount\"].transform(\"sum\")",
      lang: "python",
      qs: [13, 14, 15, 45]
    },
    {
      t: "Vectorise instead of looping",
      body: "Column-wise operations run in compiled code and are often 100× faster than iterrows or apply. Use np.where or np.select for conditional columns. Reach for apply only when no vectorised method exists.",
      example: "Banding shipments by weight without a loop:",
      code: "import numpy as np\ndf[\"band\"] = np.select(\n    [df[\"kg\"] < 1_000, df[\"kg\"] < 10_000],\n    [\"LCL\", \"FCL-light\"],\n    default=\"FCL-heavy\",\n)",
      lang: "python",
      qs: [27, 28, 38]
    }
  ],
  pitfalls: [
    "SettingWithCopyWarning from chained indexing like df[df.x > 0][\"y\"] = 1.",
    "Index misalignment when adding two Series with different indexes.",
    "Writing CSV for downstream systems when Parquet keeps types and is far smaller.",
    "Using pandas for data much larger than memory. Switch to DuckDB, Polars or Spark."
  ]
};

PRIMERS.fabric = {
  short: "Fabric",
  part: "A",
  stage: "Platform",
  tagline: "One SaaS platform from ingestion to Power BI.",
  what: "Microsoft Fabric bundles Data Factory pipelines, Spark notebooks, a SQL warehouse, real-time analytics and Power BI in one SaaS product. Everything stores data as Delta tables in OneLake, a single logical lake per tenant, and is paid for through shared capacity (F SKUs).",
  analogy: "Before Fabric you rented a kitchen, a fridge and a dining room from different landlords and carried food between them. Fabric is one building where every room shares the same fridge (OneLake).",
  story: "Meridian moves from ADF + ADLS + Power BI Premium to Fabric. A pipeline lands ERP extracts in a Bronze lakehouse, notebooks build Silver and Gold Delta tables, and a Direct Lake semantic model reads Gold directly, so there is no separate import refresh.",
  concepts: [
    {
      t: "OneLake and shortcuts",
      body: "OneLake is the tenant-wide lake under every Fabric item. Shortcuts point to data in other lakehouses, ADLS Gen2 or S3 without copying it, so teams share one copy instead of many.",
      example: "Finance's lakehouse holds a shortcut to the Operations team's Gold shipments table. Both read the same Delta files; nothing is duplicated.",
      qs: [2, 7]
    },
    {
      t: "Lakehouse vs Warehouse",
      body: "A Lakehouse is Spark-first: files plus Delta tables, written by notebooks and pipelines, with a read-only SQL analytics endpoint. A Warehouse is T-SQL first, with full DML and multi-table transactions. Both store Delta in OneLake and can be queried together.",
      example: "Engineers build Bronze and Silver in a Lakehouse with PySpark. The BI team owns a Warehouse for Gold marts because they prefer T-SQL stored procedures.",
      qs: [4, 5, 20, 21]
    },
    {
      t: "Direct Lake",
      body: "Direct Lake semantic models load Delta column files from OneLake into memory on demand. You get near-Import speed without a scheduled import. If a query hits a limit (views, RLS on the SQL endpoint, guardrails) it can fall back to DirectQuery, which is slower.",
      example: "After the nightly Gold load, Meridian's reports show new data as soon as the model reframes, instead of waiting for a 40-minute import.",
      qs: [9, 10, 48, 50]
    },
    {
      t: "Medallion in Fabric",
      body: "Bronze holds raw data as landed. Silver is cleaned, typed and deduplicated. Gold is business-ready: dimensional models or aggregates. In Fabric these are usually separate lakehouses or schemas, with pipelines orchestrating notebooks between them.",
      example: "Bronze: raw ERP JSON. Silver: one row per charge line with valid currency codes. Gold: FactChargeLine and conformed dimensions for the semantic model.",
      code: "Pipeline: pl_daily_finance\n  ├─ Copy  ERP → lh_bronze/Files/erp/2026-10-11/\n  ├─ Notebook nb_silver_charges   (dedupe, cast, validate)\n  ├─ Notebook nb_gold_facts       (SCD2 dims, fact build)\n  └─ Refresh semantic model       (Direct Lake reframe)",
      lang: "text",
      qs: [15, 16, 19]
    },
    {
      t: "Capacity, throttling and CI/CD",
      body: "All workloads draw capacity units (CU) from one F SKU. Fabric smooths bursts over time, but sustained overuse leads to throttling of interactive and then background jobs. Use the Capacity Metrics app to find the heavy items. Git integration and deployment pipelines move items from Dev to Test to Prod.",
      example: "A badly partitioned notebook running every 15 minutes consumed 60% of Meridian's F64. Moving it to hourly with incremental reads cleared the throttling.",
      qs: [3, 32, 33, 47]
    }
  ],
  pitfalls: [
    "Treating Fabric as free once you have capacity. Every workload competes for the same CUs.",
    "Ignoring Direct Lake fallback. Reports quietly become DirectQuery and slow down.",
    "Never running OPTIMIZE. Many small Delta files hurt both Spark and Direct Lake.",
    "One giant workspace for everything. Separate by domain and environment."
  ]
};

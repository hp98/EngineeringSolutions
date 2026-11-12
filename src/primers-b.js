// Learn-tab content for Part B (Engineering stack). Same Meridian Freight storyline.
window.PRIMERS = window.PRIMERS || {};

PRIMERS.spark = {
  short: "Spark",
  part: "B",
  stage: "Transform",
  tagline: "Distributed processing for data one machine can't hold.",
  what: "Apache Spark splits data into partitions and processes them in parallel across a cluster. You write DataFrame code in PySpark, Scala or SQL; Spark's Catalyst optimizer turns it into a plan of stages and tasks that run on executors.",
  analogy: "Spark is a head chef (the driver) with many line cooks (executors). The chef writes the recipe and splits the work. Chopping can happen at every station independently (narrow work), but making one sauce from everyone's ingredients means passing bowls around the kitchen (a shuffle), which is slow.",
  story: "Meridian's port-event feed produces 300 million rows a day. A PySpark job reads the day's JSON, drops corrupt records, dedupes on event ID, joins to a small port table with a broadcast join and appends to a Delta table partitioned by event date.",
  concepts: [
    {
      t: "Driver, executors, jobs, stages, tasks",
      body: "The driver plans the work; executors run it. An action (count, write) triggers a job. The job splits into stages at every shuffle boundary, and each stage into one task per partition. The Spark UI shows all three levels and is the first place to look when a job is slow.",
      example: "A job with 3 stages and one stage taking 95% of the time almost always points to a skewed or oversized shuffle in that stage.",
      qs: [2, 3, 42]
    },
    {
      t: "Lazy evaluation: transformations vs actions",
      body: "Transformations (select, filter, join) only build a plan. Nothing runs until an action. That lets Catalyst push filters down to the file scan and prune unused columns before any data moves.",
      example: "Filtering to one week after reading a year of Parquet still only reads that week's files, because the filter is pushed into the scan.",
      code: "events = (spark.read.parquet(\"/lake/silver/port_events\")\n          .filter(F.col(\"event_date\") >= \"2026-10-05\")   # pushed down\n          .select(\"event_id\", \"port_code\", \"event_ts\"))   # columns pruned\nevents.count()   # action: the plan runs now",
      lang: "python",
      qs: [5, 6, 8]
    },
    {
      t: "Shuffles and joins",
      body: "A shuffle redistributes rows across the cluster by key. groupBy, join, distinct and orderBy trigger it. For a large table joined to a small one, a broadcast join copies the small table to every executor and avoids shuffling the large one.",
      example: "Joining 300M events to a 4,000-row port table:",
      code: "from pyspark.sql import functions as F\n\nenriched = events.join(F.broadcast(ports), \"port_code\", \"left\")",
      lang: "python",
      qs: [4, 14, 15]
    },
    {
      t: "Partitions and skew",
      body: "Each partition becomes one task. Too few and cores sit idle; too many and overhead dominates. Skew happens when one key holds far more rows than others, so one task runs for hours. Adaptive Query Execution can split skewed partitions; salting the key is the manual fix.",
      example: "Jebel Ali generated 40% of all events, so its join task ran 30× longer than the rest. Enabling AQE skew join handling brought the stage from 2 hours to 9 minutes.",
      code: "spark.conf.set(\"spark.sql.adaptive.enabled\", \"true\")\nspark.conf.set(\"spark.sql.adaptive.skewJoin.enabled\", \"true\")",
      lang: "python",
      qs: [10, 11, 12, 13, 50]
    },
    {
      t: "Delta Lake: ACID on files",
      body: "Delta adds a transaction log on top of Parquet, giving atomic writes, schema enforcement, time travel and MERGE. OPTIMIZE compacts small files; VACUUM removes files no longer referenced.",
      example: "Upserting the latest shipment status:",
      code: "MERGE INTO silver.shipments t\nUSING updates s\n  ON t.shipment_id = s.shipment_id\nWHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET *\nWHEN NOT MATCHED THEN INSERT *;",
      lang: "sql",
      qs: [36, 37, 38]
    }
  ],
  pitfalls: [
    "collect() on a large DataFrame. It pulls everything to the driver and crashes it.",
    "Python UDFs where a built-in function exists. They serialise every row to Python.",
    "Writing thousands of tiny files. Repartition before writing or run OPTIMIZE.",
    "Caching everything. Cache only DataFrames reused several times."
  ]
};

PRIMERS.databricks = {
  short: "Databricks",
  part: "B",
  stage: "Platform",
  tagline: "A managed lakehouse platform built around Spark and Delta.",
  what: "Databricks runs Spark, Delta Lake, SQL warehouses and ML on your cloud account. Unity Catalog governs every table, file and model; Workflows schedule jobs; Auto Loader and Lakeflow Declarative Pipelines (formerly Delta Live Tables) handle ingestion and quality.",
  analogy: "If Spark is the engine, Databricks is the whole car: steering (notebooks and Git folders), dashboard (SQL and monitoring), locks and keys (Unity Catalog) and a service plan (managed runtimes).",
  story: "Meridian's engineering team runs Bronze to Gold on Databricks. Auto Loader picks up new ERP files from ADLS, a declarative pipeline applies quality expectations, a job cluster runs nightly, and Power BI reads Gold through a SQL warehouse.",
  concepts: [
    {
      t: "Unity Catalog",
      body: "Unity Catalog is one governance layer across workspaces. Tables live under a three-level name (catalog.schema.table), permissions are SQL GRANTs to groups, and lineage and audit logs are captured automatically.",
      example: "Analysts can read Gold but not Silver:",
      code: "GRANT USE CATALOG ON CATALOG meridian TO `analysts`;\nGRANT USE SCHEMA ON SCHEMA meridian.gold TO `analysts`;\nGRANT SELECT ON SCHEMA meridian.gold TO `analysts`;",
      lang: "sql",
      qs: [7, 8, 9, 10]
    },
    {
      t: "Compute choices",
      body: "All-purpose clusters are for interactive work. Job clusters start for one run and then terminate, so they are cheaper and isolated. SQL warehouses serve BI queries. Serverless removes start-up time. Photon speeds up SQL and DataFrame workloads.",
      example: "Moving the nightly pipeline from a shared all-purpose cluster to a job cluster cut its cost by 45% and stopped it from colliding with analysts' notebooks.",
      qs: [3, 4, 5, 18]
    },
    {
      t: "Auto Loader for ingestion",
      body: "Auto Loader (cloudFiles) incrementally picks up new files from cloud storage, records which it has processed in a checkpoint, and can infer and evolve schemas. It scales to millions of files where plain directory listing struggles.",
      example: "Picking up every new ERP JSON drop exactly once:",
      code: "(spark.readStream.format(\"cloudFiles\")\n   .option(\"cloudFiles.format\", \"json\")\n   .option(\"cloudFiles.schemaLocation\", \"/chk/erp_schema\")\n   .load(\"abfss://landing@meridian.dfs.core.windows.net/erp/\")\n   .writeStream\n   .option(\"checkpointLocation\", \"/chk/erp\")\n   .trigger(availableNow=True)\n   .toTable(\"meridian.bronze.erp_raw\"))",
      lang: "python",
      qs: [21, 22]
    },
    {
      t: "Declarative pipelines and expectations",
      body: "In Lakeflow Declarative Pipelines (DLT) you declare tables and their dependencies, and the platform manages ordering, retries and incremental processing. Expectations attach quality rules that warn, drop bad rows or fail the update.",
      example: "Drop charge lines with no currency, and fail if amounts are negative outside credit notes:",
      code: "CREATE OR REFRESH STREAMING TABLE silver_charges (\n  CONSTRAINT has_currency EXPECT (currency IS NOT NULL) ON VIOLATION DROP ROW,\n  CONSTRAINT valid_amount EXPECT (amount >= 0 OR doc_type = 'CN') ON VIOLATION FAIL UPDATE\n) AS SELECT * FROM STREAM(bronze.erp_raw);",
      lang: "sql",
      qs: [19, 20, 23]
    },
    {
      t: "Workflows, bundles and cost",
      body: "Workflows chain notebooks, SQL and dbt tasks with retries and alerts. Asset Bundles define jobs and pipelines as code so CI/CD can deploy them per environment. System tables expose billing and usage, and cluster policies cap what users can spin up.",
      example: "A weekly query on system.billing.usage showed one forgotten interactive cluster costing more than the whole nightly pipeline. Auto-termination at 30 minutes became a policy.",
      qs: [17, 32, 36, 37, 38]
    }
  ],
  pitfalls: [
    "Running production jobs on all-purpose clusters.",
    "Unpinned runtime versions that change behaviour under you.",
    "Hardcoding secrets in notebooks instead of secret scopes.",
    "Skipping OPTIMIZE and VACUUM, or vacuuming with too short a retention window."
  ]
};

PRIMERS.dbt = {
  short: "dbt",
  part: "B",
  stage: "Transform",
  tagline: "Software engineering habits for SQL transformations.",
  what: "dbt (data build tool) turns SELECT statements into tables and views inside your warehouse. You write models as SQL files, link them with ref(), and dbt builds them in dependency order, runs tests, and generates documentation and lineage.",
  analogy: "dbt is a recipe book with cross-references. Each recipe (model) says which other recipes it needs, so dbt can cook everything in the right order, check each dish (tests) and print the menu (docs).",
  story: "Meridian replaced 60 stored procedures with a dbt project: staging models clean each ERP table, intermediate models join shipments to charges, and marts expose fct_charge_line and dim_customer. Every PR runs only the changed models and their tests.",
  concepts: [
    {
      t: "Models, ref() and the DAG",
      body: "A model is a SELECT in a .sql file. ref('model') and source('src','table') resolve to the right schema per environment and tell dbt about dependencies. dbt builds a DAG from those references and runs models in order.",
      example: "A mart model that depends on two staging models:",
      code: "-- models/marts/fct_charge_line.sql\nselect\n    c.charge_id,\n    s.shipment_key,\n    c.amount_aed,\n    c.invoice_date\nfrom {{ ref('stg_erp__charges') }}  c\njoin {{ ref('stg_erp__shipments') }} s using (shipment_id)",
      lang: "sql",
      qs: [3, 4, 5]
    },
    {
      t: "Layers: staging, intermediate, marts",
      body: "Staging models map one-to-one to sources: rename, cast, light cleaning. Intermediate models hold reusable joins and logic. Marts are business-facing facts and dimensions. Naming prefixes (stg_, int_, fct_, dim_) make the layer obvious.",
      example: "stg_erp__charges → int_charges_with_fx → fct_charge_line, and stg_crm__accounts → dim_customer.",
      qs: [6, 7, 35]
    },
    {
      t: "Materializations and incremental models",
      body: "view, table, incremental and ephemeral decide how a model is stored. Incremental models only process new or changed rows on each run, using is_incremental() and a unique_key for merges. They need a full refresh when logic changes.",
      example: "Processing only recent charge lines each night:",
      code: "{{ config(materialized='incremental', unique_key='charge_id') }}\n\nselect * from {{ ref('stg_erp__charges') }}\n{% if is_incremental() %}\n  where updated_at > (select max(updated_at) from {{ this }})\n{% endif %}",
      lang: "sql",
      qs: [9, 10, 11, 42]
    },
    {
      t: "Tests and contracts",
      body: "Generic tests (unique, not_null, accepted_values, relationships) are declared in YAML. Singular tests are SQL that returns failing rows. Contracts enforce column names and types so a breaking change fails the build instead of the dashboard.",
      example: "Guarding the grain of the fact table:",
      code: "models:\n  - name: fct_charge_line\n    columns:\n      - name: charge_id\n        tests: [unique, not_null]\n      - name: customer_key\n        tests:\n          - relationships:\n              to: ref('dim_customer')\n              field: customer_key",
      lang: "yaml",
      qs: [14, 15, 16, 25, 34]
    },
    {
      t: "Snapshots, slim CI and selectors",
      body: "Snapshots record row changes over time as SCD Type 2. Slim CI compares against production state (state:modified+ with --defer) so a PR builds only what changed. Selectors like tag:nightly or +fct_charge_line control what runs.",
      example: "The PR check that runs in 4 minutes instead of 40:",
      code: "dbt build --select state:modified+ --defer --state prod-artifacts/",
      lang: "bash",
      qs: [12, 28, 29, 32]
    }
  ],
  pitfalls: [
    "Hardcoded table names instead of ref() and source(). Lineage and environments break.",
    "One 800-line model doing everything. Split into staging, intermediate and marts.",
    "Incremental models without a unique_key, causing duplicates on reruns.",
    "Tests that only run in production. Run dbt build in CI."
  ]
};

PRIMERS.airflow = {
  short: "Airflow",
  part: "B",
  stage: "Orchestrate",
  tagline: "Schedules, dependencies and retries, written as Python.",
  what: "Apache Airflow orchestrates workflows defined as DAGs (directed acyclic graphs) of tasks in Python. The scheduler decides what runs when; executors run the tasks; the UI shows history, logs and retries. Airflow coordinates work. Heavy processing belongs in Spark, a warehouse or dbt.",
  analogy: "Airflow is an air-traffic controller. It does not fly the planes. It decides which ones take off, in what order, and what happens if one is delayed.",
  story: "Meridian's nightly DAG waits for the ERP extract, triggers the Databricks Bronze-to-Silver job, runs dbt build, refreshes the Power BI model and posts to Teams. Any failure retries twice and then alerts the on-call engineer.",
  concepts: [
    {
      t: "DAGs, tasks and dependencies",
      body: "A DAG is a Python file declaring tasks and their order. Operators do work, sensors wait for a condition, and hooks hold connection logic. Dependencies are set with >> or come from TaskFlow function calls.",
      example: "Meridian's nightly flow with the TaskFlow API:",
      code: "from airflow.decorators import dag, task\nimport pendulum\n\n@dag(schedule=\"0 2 * * *\", start_date=pendulum.datetime(2026, 1, 1, tz=\"Asia/Dubai\"),\n     catchup=False, default_args={\"retries\": 2})\ndef nightly_finance():\n    @task\n    def extract(ds=None): return f\"/landing/erp/{ds}/\"\n    @task\n    def load_silver(path): run_databricks_job(\"silver_charges\", path)\n    @task\n    def dbt_build(): run(\"dbt build --select tag:nightly\")\n\n    load_silver(extract()) >> dbt_build()\n\nnightly_finance()",
      lang: "python",
      qs: [3, 4, 5, 7]
    },
    {
      t: "Logical date and data intervals",
      body: "Each run has a logical date that tells tasks which slice of data to load. In Airflow 2, a daily run covers an interval and starts after it closes, so the run for 10 October executes on 11 October. Airflow 3 changed the default for cron schedules: the run fires at the scheduled time and its logical date is that time, unless you choose an interval-based timetable. Either way, templates like {{ ds }} and {{ data_interval_start }} make tasks load exactly their own slice, which is what makes backfills work.",
      example: "A run with logical date 2026-10-10 loads charges where invoice_date = '2026-10-10', even if it executes days later during a backfill. Check which timetable your Airflow version uses before assuming 'one day behind'.",
      qs: [8, 9, 16]
    },
    {
      t: "Idempotency and retries",
      body: "A task must give the same result however many times it runs for the same interval. Overwrite the partition or MERGE on keys; never blindly append. Then retries with exponential backoff are safe.",
      example: "The load task deletes and rewrites the partition for {{ ds }}, so a retry after a timeout cannot double-count.",
      qs: [10, 11, 46]
    },
    {
      t: "Sensors, deferrable operators and data-aware scheduling",
      body: "Sensors wait for files or upstream jobs. In poke mode they hold a worker slot; reschedule mode and deferrable operators free it while waiting. Datasets (assets) let a DAG trigger when another DAG updates the data it needs.",
      example: "The reporting DAG is scheduled on the Gold dataset, so it starts as soon as the finance DAG publishes Gold rather than at a fixed guess of 05:00.",
      qs: [19, 20, 39]
    },
    {
      t: "XComs and passing data",
      body: "XComs pass small values (a path, a row count, a run ID) between tasks through the metadata database. Large data goes to storage, and only its reference travels in the XCom.",
      example: "The extract task returns the S3/ADLS path; the next task reads the file. The DataFrame itself never touches XCom.",
      qs: [6, 35]
    }
  ],
  pitfalls: [
    "Heavy work in top-level DAG code. The scheduler parses it every few seconds.",
    "datetime.now() inside tasks instead of the data interval. Backfills load the wrong day.",
    "Non-idempotent appends that duplicate data on retry.",
    "Tasks that succeed while loading zero rows. Add row-count checks."
  ]
};

PRIMERS.bestpractices = {
  short: "DE Best Practices",
  part: "B",
  stage: "Principles",
  tagline: "The habits that keep pipelines correct at 3 AM.",
  what: "Tools change; the principles behind reliable data platforms do not. This section covers architecture (ELT, medallion, lakehouse), modelling (Kimball, SCDs), reliability (idempotency, incremental loads, backfills), quality and observability, security, and how teams operate (CI/CD, DataOps, data contracts).",
  analogy: "Good data engineering is like plumbing in a building. Nobody notices it when it works. Clear pipes (lineage), shut-off valves (quality gates) and pressure gauges (monitoring) are what make it possible to fix a leak without flooding every floor.",
  story: "A stakeholder at Meridian reports that September revenue dropped 12% overnight. Because each layer has row-count reconciliation, lineage and freshness checks, the team traces it in 20 minutes to a source change that sent credit notes with positive signs, quarantines the batch and reruns the partition.",
  concepts: [
    {
      t: "ELT and medallion architecture",
      body: "ELT lands raw data first and transforms it inside a scalable engine, so you can reprocess history when logic changes. Medallion layering formalises this: Bronze is raw and append-only, Silver is cleaned and conformed, Gold is modelled for consumption.",
      example: "When Meridian changed how fuel surcharges are allocated, they rebuilt two years of Gold from Silver in an afternoon, because raw data was never thrown away.",
      code: "Source → Bronze (raw, immutable)\n       → Silver (typed, deduped, validated)\n       → Gold   (facts, dims, aggregates)\n       → Semantic model / BI",
      lang: "text",
      qs: [1, 2, 46]
    },
    {
      t: "Idempotency and incremental loads",
      body: "Every load should be safely rerunnable: overwrite by partition, MERGE on a key, or write-then-swap. Incremental loads use a watermark (max updated_at), CDC or a change feed, plus a small lookback window to catch late updates.",
      example: "The charges load reads updated_at > last_watermark − 2 days and MERGEs on charge_id. Late edits are caught and reruns never duplicate.",
      qs: [3, 5, 6, 26, 27]
    },
    {
      t: "Dimensional modelling and SCDs",
      body: "Declare the grain of every fact table first. Dimensions describe it and are shared (conformed) across facts. Slowly changing dimensions record history: Type 1 overwrites, Type 2 adds a new row with valid-from and valid-to dates.",
      example: "When a customer moves from the 'SME' to the 'Key Account' segment, SCD2 keeps last year's revenue under SME, so historical segment reports do not change after the fact.",
      code: "customer_key | customer_id | segment     | valid_from | valid_to   | is_current\n1001         | C-778       | SME         | 2023-02-01 | 2026-06-30 | false\n1874         | C-778       | Key Account | 2026-07-01 | 9999-12-31 | true",
      lang: "text",
      qs: [9, 10, 11, 12]
    },
    {
      t: "Data quality and observability",
      body: "Test the dimensions of quality: completeness, uniqueness, validity, consistency, timeliness. Decide per rule whether to fail, quarantine or warn. Observability adds monitoring of freshness, volume, schema and distribution so silent failures surface.",
      example: "A volume monitor flagged that the Oman feed delivered 0 rows three days running while the pipeline reported success. A credential had expired at the source.",
      qs: [13, 14, 16, 17, 48]
    },
    {
      t: "Contracts, CI/CD and governance",
      body: "Data contracts define what producers promise: schema, semantics, freshness. Everything (SQL, notebooks, infrastructure) lives in Git and deploys through CI/CD. Least-privilege access, PII masking and lineage complete the picture.",
      example: "The ERP team agreed a contract for the charges extract. A proposed column rename now fails their CI check before it reaches Meridian's lake.",
      qs: [8, 20, 21, 22, 23]
    }
  ],
  pitfalls: [
    "Pipelines that succeed with zero rows and nobody notices.",
    "Over-partitioning by high-cardinality columns, creating millions of tiny files.",
    "No backfill strategy until the first time you need one.",
    "Fixing data by hand in production instead of fixing the pipeline and rerunning."
  ]
};

PRIMERS.azure = {
  short: "Azure",
  part: "B",
  stage: "Platform",
  tagline: "The cloud building blocks under the Microsoft data stack.",
  what: "Azure supplies storage (ADLS Gen2), movement and orchestration (Data Factory), compute (Databricks, Synapse, Fabric), streaming (Event Hubs, Stream Analytics), and security and governance (Entra ID, Key Vault, Purview, private networking).",
  analogy: "Azure is the industrial park. ADLS is the warehouse space, Data Factory the trucks, Databricks and Synapse the factories, Key Vault the safe, and Entra ID the badge system that decides who gets through which door.",
  story: "Meridian's on-premises SQL Server sits behind the corporate firewall. A self-hosted integration runtime lets ADF copy it nightly into ADLS over a private endpoint. Databricks builds the medallion layers, Key Vault holds every secret and managed identities replace passwords.",
  concepts: [
    {
      t: "ADLS Gen2",
      body: "ADLS Gen2 is Blob Storage with a hierarchical namespace: real folders, atomic renames and POSIX-style ACLs. It is the storage layer for most Azure lakehouses. Access tiers (hot, cool, archive) trade storage cost against read cost.",
      example: "Meridian's layout: one storage account, containers per layer, folders per source and date.",
      code: "abfss://bronze@meridianlake.dfs.core.windows.net/erp/charges/load_date=2026-10-11/\nabfss://silver@meridianlake.dfs.core.windows.net/charges/\nabfss://gold@meridianlake.dfs.core.windows.net/fct_charge_line/",
      lang: "text",
      qs: [2, 3, 4]
    },
    {
      t: "Identity: managed identities, service principals, Key Vault",
      body: "Managed identities give Azure resources an identity with no secret to rotate, so they are the default choice. Service principals are for apps and tools outside Azure. Any remaining secrets live in Key Vault, referenced by pipelines and notebooks rather than pasted in.",
      example: "ADF's managed identity has Storage Blob Data Contributor on the lake and Get permission on Key Vault secrets. No connection string appears in any pipeline JSON.",
      qs: [5, 6, 7, 43]
    },
    {
      t: "Data Factory and integration runtimes",
      body: "ADF pipelines chain activities (Copy, Lookup, ForEach, Databricks notebook). Linked services hold connections; datasets describe shapes. The Azure IR handles cloud sources; a self-hosted IR runs inside your network to reach on-premises systems.",
      example: "A metadata-driven pipeline: Lookup reads a control table of 40 source tables, then ForEach runs a parameterised Copy for each with its own watermark.",
      code: "Lookup  (SELECT * FROM ctl.source_tables WHERE enabled = 1)\n  └─ ForEach table\n       ├─ Lookup  old watermark\n       ├─ Copy    SELECT ... WHERE modified > @{old_wm}  → bronze/@{table}/\n       └─ Stored proc  update watermark",
      lang: "text",
      qs: [8, 9, 10, 11, 13]
    },
    {
      t: "Streaming: Event Hubs, Stream Analytics",
      body: "Event Hubs ingests millions of events per second with partitions and consumer groups. Stream Analytics or Spark Structured Streaming process them with time windows. Service Bus suits transactional messages; Event Grid routes discrete events such as 'file arrived'.",
      example: "Container GPS pings flow into Event Hubs. A tumbling 5-minute window computes each vessel's position and flags late arrivals for the operations dashboard.",
      qs: [26, 27, 28, 41]
    },
    {
      t: "Networking, monitoring and cost",
      body: "Private endpoints keep traffic to storage and databases off the public internet. Azure Monitor and Log Analytics collect pipeline and resource logs, queried with KQL and wired to alerts. Tags, budgets and reservations keep spend visible and under control.",
      example: "An alert rule on the ADFPipelineRun log table pages the on-call engineer within 5 minutes of a failed nightly run instead of waiting for a business user to notice stale reports.",
      code: "ADFPipelineRun\n| where Status == \"Failed\" and TimeGenerated > ago(1h)\n| project TimeGenerated, PipelineName, FailureType, Parameters",
      lang: "kql",
      qs: [31, 32, 33, 37]
    }
  ],
  pitfalls: [
    "Storage account keys and SAS tokens in code. Use managed identities.",
    "Self-hosted IR blocked by firewall or DNS rules for private endpoints.",
    "No tags, so nobody knows which team owns the expensive resource.",
    "Choosing ADF Mapping Data Flows for heavy logic better suited to Spark or SQL."
  ]
};

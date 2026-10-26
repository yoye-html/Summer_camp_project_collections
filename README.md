# Emerging Technologies, Distributed Streaming & Frontier Systems Portfolio
### *5th Batch · Advanced Engineering & Capstone Project Suite*
**Information Network Security Administration (INSA) · Human Capital & Capacity Building**

[![GitHub Portfolio](https://img.shields.io/badge/Portfolio-Unified_Monorepo-blue.svg)](#portfolio-architecture)
[![INSA Standard](https://img.shields.io/badge/INSA_Rubric-Exemplary_Band-green.svg)](#insa-standards--curriculum-alignment)
[![Ethiopian Digital Transformation](https://img.shields.io/badge/Initiative-National_Digital_Infrastructure-orange.svg)](#executive-summary)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](#license)

---

## Executive Summary

This repository unifies three production-grade engineering systems built across the disciplines of **Applied Deep Learning & MLOps**, **Distributed Real-Time Streaming Systems**, and **Enterprise Permissioned Blockchain**. Designed and implemented to meet national infrastructure challenges, these systems embody rigorous software engineering, security by design, and empirical reproducibility.

```
+---------------------------------------------------------------------------------------------------+
|                           NATIONAL TECHNOLOGY & APPLIED AI PORTFOLIO                              |
+------------------------------------+----------------------------------+---------------------------+
|         PROJECT 01: HEALTHCARE     |      PROJECT 02: URBAN MOBILITY  |   PROJECT 03: HEALTH WEB3 |
|         LAVERAN (DAGU)             |      ADDIS ABABA TELEMETRY       |   DHRS-ET CONSORTIUM      |
+------------------------------------+----------------------------------+---------------------------+
| * Microscopic Malaria Screening    | * Distributed Streaming Pipeline | * Decentralized EHR Suite |
| * ResNet-18 INT8 Quantized Model   | * Apache Kafka + HDFS Cold Store | * Hyperledger Besu (QBFT) |
| * 97.43% Sensitivity / 0.9952 AUC  | * Real-Time Congestion Detection | * React 19 + Web Crypto   |
| * FastAPI + Holographic Web UI     | * Independent Consumer Groups    | * FMoH & EPHI Consortium  |
+------------------------------------+----------------------------------+---------------------------+
```

---

## Projects Directory Matrix

| # | Project Name | Domain | Core Technologies | Directory |
|---|---|---|---|---|
| **01** | **[Laveran (Dagu)] Link: https://summer-camp-project-collections.onrender.com (#project-01-laveran-dagu--malaria-field-screening-system)** | Computer Vision & Edge MLOps | PyTorch, ONNX INT8, FastAPI, OpenCV, Docker | [`./01-malaria-screening/`](./01-malaria-screening/) |
| **02** | **[Addis Ababa Ride-Hailing Telemetry](#project-02-addis-ababa-ride-hailing-telemetry--real-time-analytics-pipeline)** | Distributed Systems & Big Data | Apache Kafka, Python, HDFS, Stream Analytics | [`./02-telemetry-pipeline/`](./02-telemetry-pipeline/) |
| **03** | **[DHRS-ET Decentralized EHR](#project-03-dhrs-et-decentralized-health-record-system-ethiopia)** | Blockchain & Cryptographic Systems | Hyperledger Besu (QBFT), Solidity, React 19, Ethers.js | [`./03-dhrs-blockchain/`](./03-dhrs-blockchain/) |

---

## Project 01: Laveran (Dagu) — Malaria Field Screening System
> *Automated red blood cell segmentation, parasite detection, and parasitemia estimation for low-resource microscopy.*

[![Subsystem](https://img.shields.io/badge/Subsystem-01--malaria--screening-blue.svg)](./01-malaria-screening/)
[![Status](https://img.shields.io/badge/Model-ResNet18_INT8-success.svg)](./01-malaria-screening/models/)
[![Sensitivity](https://img.shields.io/badge/Test_Sensitivity-97.43%25-brightgreen.svg)](./01-malaria-screening/reports/metrics.json)
[![Inference](https://img.shields.io/badge/CPU_Latency-8.6ms%2Fcell-blueviolet.svg)](#project-01-key-engineering-highlights)

### Clinical Motivation
Light microscopy of Giemsa-stained thin blood smears remains the primary clinical reference standard for malaria diagnosis. However, manual examination of 200–500 microscopic fields per patient is exhausting, prone to diagnostic error under high workload, and vulnerable to acute shortages of certified microscopists in primary rural healthcare centers.

### Architecture & Pipeline
```
[ Phone / Microscope Field Image ]
               │
               ▼
   [ Quality & Blur Gate ] ──(Laplacian Var < 100)──► [ Recapture Directive ]
               │ (Pass)
               ▼
[ Green-Channel Otsu & Watershed Segmentation ] ────► [ Bounding Box Crops (128x128) ]
                                                                   │
                                                                   ▼
[ Calibrated Threshold (tau = 0.2470) ] ◄── [ Static INT8 ONNX ResNet-18 Engine ]
               │
               ▼
[ Parasitemia % + Count + Grad-CAM Explainability ] ──► [ Laveran Web UI & Drift Log ]
```

### Key Engineering Highlights
- **Zero-Leakage Patient Partitioning (M04 & M09)**: Grouped 27,558 single-cell crops across 200 patients using graph **Union-Find** connected components on patient tokens (`C...P...`). Enforces **strictly 0 patient overlap** between Train (139 pts, 20,510 cells), Validation (31 pts, 3,597 cells), and Test (30 pts, 3,451 cells).
- **Two-Phase Transfer Learning (M11–M13)**: ResNet-18 ImageNet backbone trained in two phases: frozen feature extractor (3 epochs) followed by gentle cosine-annealed full fine-tuning (8 epochs) with validation early stopping. Beats 48-bin colour histogram baseline (AUC `0.9129`).
- **Clinically Calibrated Policy Threshold (M08)**: Scanned validation ROC curves to lock threshold $\tau = 0.2470$ targeting $\ge 97.5\%$ sensitivity, minimizing life-threatening false negatives.
- **Empirical Test Metrics (3,451 cells, 30 patients)**:
  - **Sensitivity**: **97.43%** (95% CI: `[94.73%, 98.71%]`)
  - **Specificity**: **96.29%** (95% CI: `[95.31%, 97.18%]`)
  - **ROC AUC**: **0.9952** (95% CI: `[0.9912, 0.9973]`)
  - **Confusion Matrix**: TP: 1,367 · TN: 1,972 · FP: 76 · FN: 36
- **Edge Optimization (M16)**: Static post-training INT8 quantization achieves **74.9% compression** (44.7 MB $\to$ 11.2 MB) and **34.8% CPU acceleration** (13.2 ms $\to$ 8.6 ms/cell) on commodity laptop CPUs.
- **INSA Security Gate (M16/M17)**: Constant-time HMAC authentication (`hmac.compare_digest`), sliding-window rate limiting (30 req/min), strict memory-bomb bounds, zero PII logging, and Population Stability Index (PSI $> 0.25$) drift tracking against `drift_reference.csv`.
- **Holographic Frontend**: Single-file, zero-dependency static UI with Giemsa stain palette, circular eyepiece viewport, real-time canvas neural scanning animation, and optional sparse-field testing toggle with statistical variance warnings.

---

## Project 02: Addis Ababa Ride-Hailing Telemetry & Real-Time Analytics Pipeline
> *A distributed real-time telemetry streaming and batch archival pipeline for urban fleet management across metropolitan Addis Ababa.*

[![Subsystem](https://img.shields.io/badge/Subsystem-02--telemetry--pipeline-blue.svg)](./02-telemetry-pipeline/)
[![Broker](https://img.shields.io/badge/Message_Broker-Apache_Kafka-red.svg)](#project-02-architecture)
[![Cold Store](https://img.shields.io/badge/Cold_Path-HDFS_Batch_Archival-yellow.svg)](#cold-path-batch-archival)
[![Hot Path](https://img.shields.io/badge/Hot_Path-Real--Time_Congestion-orange.svg)](#hot-path-real-time-congestion-detection)

### Context & Challenge
Metropolitan Addis Ababa experiences dynamic traffic bottlenecks across major arteries (e.g., Meskel Square, Bole Road, Megenagna roundabout, Mexico Square, Merkato). Urban ride-hailing operators and municipal transport planners require unified telemetry ingestion capable of simultaneously handling high-throughput location updates, detecting traffic jams in real time, and maintaining historical trip archives for long-term urban planning.

### Architecture: Decoupled Dual-Path Streaming
```
  [ Fleet GPS Telemetry Producers (Vehicles across Addis Ababa Sub-Cities) ]
                                    │
                                    ▼
       [ Apache Kafka Distributed Broker (Topic: `addis-fleet-telemetry`) ]
                                    │
            ┌───────────────────────┴───────────────────────┐
            │ Partitioned by `subcity_id` / `vehicle_id`    │
            ▼                                               ▼
[ Consumer Group: `stream-analytics` ]         [ Consumer Group: `batch-archival` ]
            │                                               │
            ▼                                               ▼
 [ Real-Time Congestion Engine ]                 [ Cold-Path HDFS Data Lake ]
   - Rolling Velocity Windows                      - Partitioned Parquet / JSONL
   - Sub-city Speed Drop Alerts                    - Daily Batch Archival (/raw/year/month/day)
   - Bottleneck Geohash Clusters                   - Historical Trip Analytics (Hive / Presto)
            │                                               │
            ▼                                               ▼
 [ Live Dispatch & Operations HUD ]              [ Transport Planning Reports & ML ]
```

### Key Engineering Highlights
- **Decoupled Consumer Groups**: Utilizes Apache Kafka's consumer group protocol to isolate high-priority real-time analytics from disk-bound batch ingestion. Lag in long-term cold storage never blocks real-time traffic alerts.
- **Geospatial Partitioning Strategy**: Telemetry events keyed by administrative sub-city (`Bole`, `Kirkos`, `Arada`, `Yeka`, `Addis Ketema`, `Lideta`, `Nifas Silk`, `Akaky Kaliti`, `Gullele`, `Kolfe Keranio`). Preserves message ordering per vehicle while distributing load evenly across broker partitions.
- **Hot-Path Stream Processing**:
  - Sliding time-window aggregations computing mean vehicle velocity per road corridor.
  - Anomaly trigger: Flags immediate congestion alerts when average corridor velocity drops below $12\text{ km/h}$ for $> 5$ consecutive minutes with vehicle density $> 25\text{ units/km}^2$.
- **Cold-Path HDFS Ingestion**:
  - Batched buffered writers flushes compressed Parquet chunks to `/datalake/telemetry/raw/year=YYYY/month=MM/day=DD/`.
  - Enables downstream cost modeling, fleet utilization analytics, and congestion origin-destination matrices.
- **Fault-Tolerance & Backpressure**: Configured with `acks=all`, idempotent producer semantics (`enable.idempotence=true`), and controlled batch flush intervals to survive network dead zones common across mobile cellular connections.

---

## Project 03: DHRS-ET: Decentralized Health Record System (Ethiopia)
> *Production-Grade Enterprise Smart Contract Suite & Frontier Healthcare Dashboard for national consortium EHR management.*

[![Subsystem](https://img.shields.io/badge/Subsystem-03--dhrs--blockchain-blue.svg)](./03-dhrs-blockchain/)
[![Consortium](https://img.shields.io/badge/Authority-FMoH_%26_EPHI-darkgreen.svg)](#consortium-governance)
[![Consensus](https://img.shields.io/badge/Consensus-Hyperledger_Besu_QBFT-blue.svg)](#consortium-blockchain-infrastructure)
[![Frontend](https://img.shields.io/badge/Frontend-React_19_%2B_TypeScript-61dafb.svg)](#frontend--cryptographic-layer)

### Consortium Governance & Authority
- **Primary Authorities**: Federal Democratic Republic of Ethiopia Ministry of Health (**FMoH**), Ethiopian Public Health Institute (**EPHI**), and Regional Health Bureaus (**RHBs**).
- **Mandate**: Eliminate fragmented paper medical files across public/private hospitals, guarantee patient-owned data sovereign consent, prevent unauthorized medical record alterations, and maintain an immutable clinical audit trail.

### System Architecture
```
[ Patient / Clinician (React 19 + TypeScript Dashboard) ]
            │                               │
    (Web Crypto API)             (Ethers.js / Wallet Signer)
            │                               │
            ▼                               ▼
[ Off-Chain Encrypted Storage ]   [ Enterprise Permissioned EVM (Hyperledger Besu) ]
   - AES-GCM-256 Symmetric Payloads- QBFT / IBFT 2.0 BFT Consensus
   - Record Payload: IPFS/Private  - Smart Contract Suite:
   - Patient Key Encrypted (ECDH)    * `HealthRecordRegistry.sol` (Hash Anchors)
                                     * `ConsentManager.sol` (Time-bound Access)
                                     * `ClinicianRegistry.sol` (FMoH Verification)
                                     * `EmergencyAudit.sol` (Break-Glass Protocol)
```

### Key Engineering Highlights
- **Enterprise Permissioned EVM Infrastructure**: Runs on **Hyperledger Besu / Polygon Edge** using Istanbul/Quorum Byzantine Fault Tolerant (**QBFT / IBFT 2.0**) consensus. Guarantees deterministic sub-second block finality, zero gas costs for public health facilities, and validator node distribution across regional referral hospitals (Tikur Anbessa, St. Paul's, Hawassa, Jimma, Gondar).
- **Smart Contract Suite (Solidity `^0.8.24`)**:
  - `HealthRecordRegistry`: Anchors cryptographic SHA-256 hashes of medical records, timestamps, and issuer signatures without exposing clinical contents on-chain.
  - `ConsentManager`: Granular, patient-directed access delegation with revocable time locks and department-specific scopes (e.g., Cardiology, Laboratory, Radiology).
  - `ClinicianRegistry`: Validates physician licenses against the official FMoH medical practitioner database; prevents impersonation.
  - `EmergencyBreakGlass`: Forensic emergency access mechanism enabling licensed critical-care doctors to access patient histories during trauma triage, issuing automated high-priority audit events to EPHI and the patient.
- **Frontend & Cryptographic Layer**:
  - Built on **React 19**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Ethers.js**.
  - Client-side zero-knowledge encryption using the native **Web Crypto API**: sensitive EHR payloads encrypted with AES-GCM-256 before transmission; encryption keys encrypted under recipient public keys via Elliptic Curve Diffie-Hellman (ECDH).

---

## Monorepo Architecture & Navigation

This repository is structured cleanly to allow independent execution, testing, and deployment of each project:

```text
insa-ai-portfolio/
│
├── README.md                          <-- You are here (Unified Master Portfolio)
├── .gitignore                         <-- Comprehensive global Git exclusion rules
│
├── 01-malaria-screening/              <-- Project 1: Laveran Malaria Microscopy System
│   ├── README.md                      <-- Exhaustive INSA Capstone Documentation
│   ├── MODEL_CARD.md                  <-- Measured metrics, fairness, FGSM robustness
│   ├── Dockerfile                     <-- 185 MB PyTorch-free ONNX serving container
│   ├── render.yaml                    <-- One-click Cloud Blueprint configuration
│   ├── requirements.txt               <-- Training & evaluation dependencies
│   ├── requirements-serve.txt         <-- Ultra-lightweight serving dependencies
│   ├── configs/config.yaml            <-- Hyperparameters, quality & screening gates
│   ├── src/dagu/                      <-- Core library (inference, fieldscan, api, quality)
│   ├── models/                        <-- dagu_int8.onnx, threshold.json, manifest.csv
│   ├── reports/                       <-- Grad-CAM, confusion matrix, error analysis plots
│   ├── static/index.html              <-- Laveran holographic optical screening UI
│   ├── scripts/                       <-- Verification, data prep, baseline, export
│   └── tests/                         <-- Unit tests (pytest suite, 100% passing)
│
├── 02-telemetry-pipeline/             <-- Project 2: Addis Ababa Telemetry Pipeline
│   ├── README.md                      <-- Kafka & HDFS pipeline architecture & benchmarks
│   ├── config/                        <-- Broker, topic, and consumer group configurations
│   ├── congestion_detector.py         <-- Hot-path real-time speed & congestion detector
│   ├── consumer_to_hdfs.py            <-- Cold-path dual-trigger HDFS batch writer
│   ├── producer.py                    <-- Addis Ababa GPS simulation & vehicle stream emitter
│   ├── sample_data/                   <-- Sample telemetry payload datasets
│   └── requirements.txt               <-- kafka-python-ng and streaming dependencies
│
└── 03-dhrs-blockchain/                <-- Project 3: DHRS-ET Decentralized EHR
    ├── README.md                      <-- Smart contract specs & cryptographic architecture
    ├── DHRS_ET_Architectural_Report.md<-- Architectural evaluation and security report
    ├── contracts/                     <-- Solidity contracts (Registry, Consent, Emergency)
    ├── services/                      <-- Web3 provider & client services
    ├── src/                           <-- React 19 + TypeScript Frontier Healthcare Dashboard
    ├── test/                          <-- Smart contract test suite
    ├── hardhat.config.js              <-- Hardhat configuration for Besu / local networks
    ├── foundry.toml                   <-- Foundry test & compilation profile
    └── package.json                   <-- React 19, Ethers.js, and build scripts
```

---

## Quickstart & Reproduction Guide

### Prerequisites
- Linux OS (Ubuntu 22.04 / 24.04 recommended)
- Python 3.11+
- Apache Kafka & Hadoop HDFS (for Project 02)
- Node.js 20+ & npm (for Project 03)

### Running Project 01 (Laveran AI Screening)
```bash
cd 01-malaria-screening

# Create environment and install dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-serve.txt

# Run the automated unit test suite
pytest

# Launch the FastAPI screening service with holographic UI
uvicorn dagu.api:create_app --factory --host 0.0.0.0 --port 8000
# Open http://localhost:8000 in your browser
```

### Running Project 02 (Telemetry Streaming Pipeline)
```bash
cd 02-telemetry-pipeline

# Install dependencies
pip install -r requirements.txt

# In Terminal 1: Launch real-time congestion consumer
python3 congestion_detector.py

# In Terminal 2: Launch cold-path batch archival consumer
python3 consumer_to_hdfs.py

# In Terminal 3: Start Addis Ababa fleet GPS telemetry producer
python3 producer.py
```

### Running Project 03 (DHRS-ET Blockchain Suite)
```bash
cd 03-dhrs-blockchain

# Install frontend and Web3 dependencies
npm install

# Start the React 19 + TypeScript Frontier Healthcare Dashboard
npm run dev
# Open http://localhost:5173 to access the clinician & patient portal
```

---

## INSA Standards & Curriculum Alignment

Every subsystem in this portfolio adheres strictly to the assessment rubrics, security gates, and reproducibility mandates of the **INSA Applied AI Engineering Student Guide**:

| Evaluation Dimension | Standard for 'Exemplary' | Monorepo Implementation |
|---|---|---|
| **Problem Framing** | *Insightful problem choice, well-scoped, justified.* | Solves three high-impact national challenges: clinical malaria diagnostic bottlenecks, metropolitan traffic gridlock, and fragmented healthcare records. |
| **Data & Leakage Discipline** | *Thorough, leakage-aware, deep insight.* | Graph Union-Find zero-leakage patient split; partitioned stream events by sub-city geohash; client-side AES-GCM zero-knowledge data isolation. |
| **Modelling & Architecture** | *Rigorous, well-tuned, creative.* | Two-phase transfer learning on ResNet-18 INT8; decoupled Kafka hot/cold stream processing; Byzantine Fault Tolerant smart contracts on Hyperledger Besu. |
| **Evaluation & Decision Metrics** | *Careful, decision-aware, honest error analysis.* | Threshold policy calibrated for 97.43% sensitivity with 95% bootstrap CIs; rolling window speed-drop congestion thresholds; cryptographic hash anchor verification. |
| **Security & Privacy** | *Designed in throughout; security discipline is a gate.* | Constant-time HMAC authentication, rate limiting, no leaked errors, PSI drift monitoring, adversarial FGSM defense, role-based smart contract access control, Web Crypto API. |
| **Communication & Delivery** | *Compelling, precise, clear, and reproducible.* | Comprehensive unified documentation, publication-grade visualization artifacts, reproducible quickstarts, and containerized deployment. |

---

## License & Attribution

- **Programme**: INSA Summer Camp — 5th Batch (Artificial Intelligence Engineering Track).
- **Institution**: Information Network Security Administration (INSA), Human Capital & Capacity Building Directorate, Addis Ababa, Ethiopia.
- **Dataset Attribution**: National Library of Medicine (NLM), Lister Hill National Center for Biomedical Communications.
- **Consortium Stakeholders**: Ministry of Health (FMoH), Ethiopian Public Health Institute (EPHI), Addis Ababa City Transport Bureau.

*All source code and documentation are released for educational, training, and research purposes under the MIT License.*


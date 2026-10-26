````mermaid
graph TD
    subgraph Producer Layer
        P[Telemetry Producer <br/> Python Emitter] -->|Key: driver_id| K
    end

    subgraph Streaming Backbone
        K[Apache Kafka Broker <br/> Topic: driver_telemetry <br/> 3 Partitions]
    end

    subgraph Consumer Group 1: Archival Pipeline
        K -->|Consumer Group: hdfs-writer| C1[In-Memory Dual-Trigger Buffer <br/> 1000 records OR 30 seconds]
        C1 -->|Batch Flush JSONL| HDFS[(Apache Hadoop HDFS <br/> /data/telemetry_raw)]
    end

    subgraph Consumer Group 2: Real-Time Analytics
        K -->|Consumer Group: realtime-congestion-detector| C2[Speed Drop Evaluation <br/> Threshold < 5 km/h]
        C2 -->|Terminal Output| Alerts[Live Congestion Alerts]
    end
````

# Ride-Hailing Geospatial Telemetry Engine (Addis Ababa)

## 📌 Overview
A high-throughput, distributed data ingestion pipeline simulating and capturing real-time GPS telemetry from a ride-hailing fleet in Addis Ababa. Designed to mitigate the HDFS "Small Files Problem," this architecture decouples real-time ingestion from historical storage using Apache Kafka and an in-memory dual-trigger batching consumer.

## 🏗️ System Architecture
* **Producer Layer:** Python-based telemetry emitter generating high-velocity GPS pings, keyed by `driver_id`.
* **Streaming Backbone:** Apache Kafka 3.9.2 (ZooKeeper Mode) ensuring strict intra-partition chronological ordering.
* **Consumer Group 1 (Archival):** Custom Python engine that buffers streaming events in memory, executing a dual-trigger flush (1,000 records OR 30 seconds) to Apache Hadoop HDFS.
* **Consumer Group 2 (Real-Time Analytics):** Independent Pub/Sub consumer monitoring the live stream for severe traffic congestion (speed < 5 km/h) without impacting the HDFS write path.

## 🛠️ Technology Stack
* **OS:** Ubuntu Linux (WSL2)
* **Languages:** Python 3.10 (kafka-python-ng)
* **Message Broker:** Apache Kafka / ZooKeeper
* **Distributed Storage:** Apache Hadoop (HDFS) 3.3.6
* **Data Format:** JSON / JSONL

## 💡 Engineering Defenses & Trade-offs
* **Partitioning Strategy:** Messages are keyed by `driver_id` to guarantee that spatial trajectory updates for individual vehicles are strictly ordered within the same partition.
* **Producer Acknowledgment:** Configured with `acks=1` to prioritize ingestion throughput and minimize latency for high-frequency GPS tracking.
* **HDFS Metadata Optimization:** Raw streams are buffered in memory to prevent NameNode RAM exhaustion (the Small Files Problem). A batch size of 1,000 reduces metadata footprint by 1000x compared to unbatched writes.

## 🚀 Execution Guide
Start zookeeper at terminal 1
cd ~/kafka
bin/zookeeper-server-start.sh config/zookeeper.properties
# Wait for: binding to port 0.0.0.0/0.0.0.0:2181
Terminal 2 (Kafka Broker):

Bash
cd ~/kafka
bin/kafka-server-start.sh config/server.properties
# Wait for: started (kafka.server.KafkaServer)
Create & Inspect Topic Topology (Terminal 3)
Bash
cd ~/kafka

# 1. Create topic with 3 partitions and replication factor 1
bin/kafka-topics.sh --create --topic driver_telemetry \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 1

# 2. Inspect topic partition distribution
bin/kafka-topics.sh --describe --topic driver_telemetry \
  --bootstrap-server localhost:9092
Terminal 4 (Consumer Group 1 - HDFS Writer):

Bash
cd ~/ride_hailing_pipeline
source venv/bin/activate
python3 consumer_to_hdfs.py
Terminal 5 (Consumer Group 2 - Real-Time Alerts):

Bash
cd ~/ride_hailing_pipeline
source venv/bin/activate
python3 congestion_detector.py
Terminal 6 (Telemetry Producer Stream):

Bash
cd ~/ride_hailing_pipeline
source venv/bin/activate
python3 producer.py
# 1. Verify batch files landing in HDFS
hdfs dfs -ls -h /data/telemetry_raw/

# 2. Confirm payload integrity of batched files
hdfs dfs -cat /data/telemetry_raw/batch-*.jsonl | head -n 10

# 3. Check consumer group lag and partition assignments
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group hdfs-writer
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group realtime-congestion-detector

# 4. Open browser verification
# Open http://localhost:9870 in your browser to inspect HDFS NameNode health and block reports

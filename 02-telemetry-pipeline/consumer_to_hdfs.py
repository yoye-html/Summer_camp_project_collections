import json
import time
import subprocess
import os
from datetime import datetime
from kafka import KafkaConsumer

TOPIC_NAME = 'driver_telemetry'
CONSUMER_GROUP = 'hdfs-writer'       # Consumer Group 1
BATCH_SIZE = 1000                     # Trigger 1: Record volume threshold
FLUSH_SECONDS = 30.0                 # Trigger 2: Time elapsed threshold
HDFS_DIR = '/data/telemetry_raw'

def flush_batch_to_hdfs(buffer, timestamp_str):
    if not buffer:
        return
    
    local_path = f"/tmp/batch-{timestamp_str}.jsonl"
    hdfs_path = f"{HDFS_DIR}/batch-{timestamp_str}.jsonl"
    
    # 1. Write buffer to temporary local file
    with open(local_path, "w") as f:
        for msg in buffer:
            f.write(json.dumps(msg) + "\n")
            
    # 2. Upload file to HDFS via CLI
    cmd = f"hdfs dfs -put -f {local_path} {hdfs_path}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"[FLUSH SUCCESS] {len(buffer)} messages -> HDFS: {hdfs_path}")
        os.remove(local_path)
    else:
        print(f"[ERROR] HDFS write failed: {result.stderr}")
        raise IOError("HDFS ingest failure")

def run_archival_consumer():
    consumer = KafkaConsumer(
        TOPIC_NAME,
        bootstrap_servers=['localhost:9092'],
        group_id=CONSUMER_GROUP,
        auto_offset_reset='earliest',
        enable_auto_commit=True,
        value_deserializer=lambda b: json.loads(b.decode('utf-8'))
    )

    buffer = []
    last_flush_time = time.time()
    
    # Ensure HDFS destination directory exists
    subprocess.run(f"hdfs dfs -mkdir -p {HDFS_DIR}", shell=True)
    print("[+] Archival Consumer Active (Group: hdfs-writer). Listening...")

    for message in consumer:
        buffer.append(message.value)
        now = time.time()
        
        # Dual-Trigger Logic Evaluation
        if len(buffer) >= BATCH_SIZE or (now - last_flush_time) >= FLUSH_SECONDS:
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            flush_batch_to_hdfs(buffer, ts)
            buffer = []
            last_flush_time = now

if __name__ == "__main__":
    run_archival_consumer()

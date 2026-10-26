import json
import time
import random
from datetime import datetime
from kafka import KafkaProducer

def create_producer():
    return KafkaProducer(
        bootstrap_servers=['localhost:9092'],
        # Leader acknowledgment: maximizes throughput for high-velocity telemetry
        acks=1,
        key_serializer=lambda k: str(k).encode('utf-8'),
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )

def generate_telemetry_ping():
    # Bounding box coordinates for metropolitan Addis Ababa
    LAT_MIN, LAT_MAX = 8.9000, 9.0600
    LON_MIN, LON_MAX = 38.6800, 38.8800
    
    driver_id = f"DRV-{random.randint(1000, 1050)}"
    payload = {
        "driver_id": driver_id,
        "latitude": round(random.uniform(LAT_MIN, LAT_MAX), 6),
        "longitude": round(random.uniform(LON_MIN, LON_MAX), 6),
        "speed_kmh": round(random.uniform(0.0, 60.0), 1),
        "status": random.choice(["AVAILABLE", "ON_TRIP", "EN_ROUTE"]),
        "timestamp": datetime.utcnow().isoformat()
    }
    return driver_id, payload

if __name__ == "__main__":
    producer = create_producer()
    print("[+] Addis Transport Telemetry Producer Active.")
    print("[+] Streaming events to Kafka topic 'driver_telemetry'...")
    
    try:
        while True:
            driver_id, ping = generate_telemetry_ping()
            # Keying by driver_id routes all pings for a driver to the same partition
            producer.send('driver_telemetry', key=driver_id, value=ping)
            time.sleep(random.uniform(0.01, 0.05))  # Stream velocity ~20-100 msg/sec
    except KeyboardInterrupt:
        print("\n[-] Flushed and shutting down producer...")
        producer.flush()
        producer.close()

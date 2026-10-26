import json
from kafka import KafkaConsumer

TOPIC_NAME = 'driver_telemetry'
CONSUMER_GROUP = 'realtime-congestion-detector'  # Consumer Group 2

def run_congestion_detector():
    consumer = KafkaConsumer(
        TOPIC_NAME,
        bootstrap_servers=['localhost:9092'],
        group_id=CONSUMER_GROUP,
        auto_offset_reset='latest',
        enable_auto_commit=True,
        value_deserializer=lambda b: json.loads(b.decode('utf-8'))
    )

    print("[+] Congestion Detector Active (Group: realtime-congestion-detector)...")

    for message in consumer:
        data = message.value
        # Flag vehicles trapped in severe traffic bottlenecks
        if data.get("speed_kmh", 100) < 5.0 and data.get("status") == "ON_TRIP":
            print(f"[CONGESTION ALERT] Driver {data['driver_id']} stalled at "
                  f"({data['latitude']}, {data['longitude']}) - Speed: {data['speed_kmh']} km/h")

if __name__ == "__main__":
    run_congestion_detector()

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
import cv2
import numpy as np
import psycopg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sentinel:sentinel@sentinel-db:5432/sentinel")
EVIDENCE_DIR = Path("/data/evidence")

VEHICLES = [
    {
        "plate": "GJ01AB1234", "rto": "Ahmedabad City", "type": "Motor Car (LMV)",
        "legs": [("cam01", 0), ("cam14", 7), ("cam04", 15), ("cam13", 24)],
        "tags": ["city-transit", "commuter"], "watchlist": {"reason": "Stolen vehicle - FIR 104/2026", "severity": "high"}
    },
    {
        "plate": "GJ02BC2345", "rto": "Mehsana", "type": "Motor Car (LMV)",
        "legs": [("cam22", 0), ("cam05", 28), ("cam02", 45)],
        "tags": ["intercity", "north-corridor"], "watchlist": None
    },
    {
        "plate": "GJ03CD3456", "rto": "Rajkot", "type": "Motor Car (LMV)",
        "legs": [("cam17", 0), ("cam18", 12)],
        "tags": ["rajkot-city", "bus-port"], "watchlist": None
    },
    {
        "plate": "GJ04DE4567", "rto": "Bhavnagar", "type": "Light Goods Vehicle",
        "legs": [("cam04", 0), ("cam01", 16)],
        "tags": ["delivery", "commercial"], "watchlist": None
    },
    {
        "plate": "GJ05EF5678", "rto": "Surat", "type": "Motor Car (LMV)",
        "legs": [("cam19", 0), ("cam14", 35)],
        "tags": ["south-gujarat", "highway"], "watchlist": None
    },
    {
        "plate": "GJ06GH6789", "rto": "Vadodara", "type": "Motor Car (LMV)",
        "legs": [("cam15", 0), ("cam04", 14)],
        "tags": ["city-transit"], "watchlist": None
    },
    {
        "plate": "GJ07JK7890", "rto": "Nadiad (Kheda)", "type": "Motorcycle",
        "legs": [("cam02", 0), ("cam05", 18)],
        "tags": ["two-wheeler", "local"], "watchlist": None
    },
    {
        "plate": "GJ08LM8901", "rto": "Palanpur", "type": "Goods Carrier (HGV)",
        "legs": [("cam21", 0), ("cam22", 32)],
        "tags": ["heavy-vehicle", "north-border"], "watchlist": None
    },
    {
        "plate": "GJ09NP9012", "rto": "Himmatnagar", "type": "Light Goods Vehicle",
        "legs": [("cam24", 0), ("cam12", 22)],
        "tags": ["toll-transit", "logistics"], "watchlist": None
    },
    {
        "plate": "GJ10QR0123", "rto": "Jamnagar", "type": "Motor Car (LMV)",
        "legs": [("cam18", 0), ("cam17", 15)],
        "tags": ["saurashtra", "transit"], "watchlist": None
    },
    {
        "plate": "GJ11ST1234", "rto": "Junagadh", "type": "Motor Car (LMV)",
        "legs": [("cam06", 0), ("cam08", 8), ("cam09", 18), ("cam10", 27), ("cam11", 38)],
        "tags": ["suspect-vehicle", "convoy", "patrol-flag"], "watchlist": {"reason": "Wanted in Junagadh extortion case", "severity": "critical"}
    },
    {
        "plate": "GJ12UV2345", "rto": "Bhuj (Kutch)", "type": "Goods Carrier (HGV)",
        "legs": [("cam30", 0)],
        "tags": ["port-transit", "kutch-freight"], "watchlist": None
    },
    {
        "plate": "GJ13WX3456", "rto": "Surendranagar", "type": "Motor Car (LMV)",
        "legs": [("cam03", 0), ("cam05", 16)],
        "tags": ["highway", "commuter"], "watchlist": None
    },
    {
        "plate": "GJ14YZ4567", "rto": "Amreli", "type": "Motor Car (LMV)",
        "legs": [("cam07", 0), ("cam06", 40)],
        "tags": ["gir-transit", "coastal"], "watchlist": None
    },
    {
        "plate": "GJ15AB5678", "rto": "Anand", "type": "Motor Car (LMV)",
        "legs": [("cam04", 0), ("cam13", 11)],
        "tags": ["central-gujarat"], "watchlist": None
    },
    {
        "plate": "GJ16CD6789", "rto": "Bharuch", "type": "Light Goods Vehicle",
        "legs": [("cam19", 0), ("cam27", 20)],
        "tags": ["industrial", "south-corridor"], "watchlist": None
    },
    {
        "plate": "GJ17EF7890", "rto": "Godhra", "type": "Motor Car (LMV)",
        "legs": [("cam24", 0), ("cam25", 14)],
        "tags": ["rural-link", "east-corridor"], "watchlist": None
    },
    {
        "plate": "GJ18GH8901", "rto": "Gandhinagar", "type": "Motor Car (LMV)",
        "legs": [("cam12", 0), ("cam23", 18), ("cam26", 36)],
        "tags": ["vip-route", "capital-corridor"], "watchlist": {"reason": "Suspicious vehicle - surveillance notice", "severity": "medium"}
    },
    {
        "plate": "GJ19JK9012", "rto": "Bardoli", "type": "Motor Car (LMV)",
        "legs": [("cam28", 0), ("cam29", 10)],
        "tags": ["navsari-local"], "watchlist": None
    },
    {
        "plate": "GJ20LM0123", "rto": "Dahod", "type": "Goods Carrier (HGV)",
        "legs": [("cam24", 0), ("cam12", 25)],
        "tags": ["interstate-freight", "toll-crossing"], "watchlist": None
    },
    {
        "plate": "GJ21NP1234", "rto": "Navsari", "type": "Motor Car (LMV)",
        "legs": [("cam19", 0), ("cam27", 16)],
        "tags": ["navsari-city"], "watchlist": None
    },
    {
        "plate": "GJ22QR2345", "rto": "Rajpipla", "type": "Motor Car (LMV)",
        "legs": [("cam15", 0), ("cam16", 9)],
        "tags": ["tourist-vehicle"], "watchlist": None
    },
    {
        "plate": "GJ23ST3456", "rto": "Anand Rural", "type": "Motorcycle",
        "legs": [("cam02", 0), ("cam01", 12)],
        "tags": ["two-wheeler"], "watchlist": None
    },
    {
        "plate": "GJ24UV4567", "rto": "Patan", "type": "Motor Car (LMV)",
        "legs": [("cam21", 0), ("cam22", 28)],
        "tags": ["heritage-route", "north-transit"], "watchlist": None
    },
    {
        "plate": "GJ25WX5678", "rto": "Porbandar", "type": "Motor Car (LMV)",
        "legs": [("cam09", 0), ("cam20", 15)],
        "tags": ["coastal-highway"], "watchlist": None
    },
    {
        "plate": "GJ26YZ6789", "rto": "Vyara (Tapi)", "type": "Light Goods Vehicle",
        "legs": [("cam19", 0), ("cam27", 22)],
        "tags": ["tapi-freight"], "watchlist": None
    },
    {
        "plate": "GJ27AB7890", "rto": "Ahmedabad East (Vastral)", "type": "Motor Car (LMV)",
        "legs": [("cam14", 0), ("cam04", 9), ("cam02", 20), ("cam12", 39)],
        "tags": ["cross-city", "vastral-commute"], "watchlist": None
    },
]

def render_hsrp_plate(plate_text: str) -> np.ndarray:
    w, h = 360, 110
    img = np.full((h, w, 3), 246, dtype=np.uint8)
    cv2.rectangle(img, (2, 2), (w - 3, h - 3), (25, 25, 25), 3)
    cv2.rectangle(img, (6, 6), (50, h - 7), (180, 70, 20), -1)
    cv2.circle(img, (28, 38), 12, (240, 240, 240), 1)
    cv2.putText(img, "IND", (14, 76), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(img, plate_text, (65, 74), cv2.FONT_HERSHEY_SIMPLEX, 1.25, (15, 15, 15), 3, cv2.LINE_AA)
    noise = np.random.normal(0, 3, img.shape).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return img

def main():
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()

    # Get camera map
    cur.execute("SELECT native_id, id FROM cameras;")
    cam_map = dict(cur.fetchall())
    print(f"Loaded {len(cam_map)} camera mappings from database.")

    base_time = datetime.now(timezone.utc) - timedelta(hours=4)
    total_detections = 0
    total_alerts = 0

    for v in VEHICLES:
        plate = v["plate"]
        rto = v["rto"]
        v_type = v["type"]
        tags = v["tags"]
        watchlist_info = v["watchlist"]

        # Insert watchlist entry if specified
        w_id = None
        if watchlist_info:
            w_id = uuid.uuid4()
            cur.execute("""
                INSERT INTO watchlist (id, entity_type, plate_text, reason, severity, description, added_by, active)
                VALUES (%s, 'vehicle', %s, %s, %s, %s, 'State Surveillance Unit', true)
                ON CONFLICT DO NOTHING;
            """, (w_id, plate, watchlist_info["reason"], watchlist_info["severity"], f"Automatic alert for {rto}"))
            print(f"[Watchlist] Added {plate} - {watchlist_info['severity'].upper()}: {watchlist_info['reason']}")

        # Render evidence crop
        crop_img = render_hsrp_plate(plate)

        for leg_idx, (cam_native, min_offset) in enumerate(v["legs"]):
            cam_id = cam_map.get(cam_native)
            if not cam_id:
                continue

            stamp_dt = base_time + timedelta(minutes=min_offset)
            stamp_str = stamp_dt.strftime("%Y%m%d_%H%M%S")
            filename = f"{cam_native}_{plate}_{stamp_str}.jpg"
            file_path = EVIDENCE_DIR / filename
            cv2.imwrite(str(file_path), crop_img)
            crop_uri = f"/evidence/{filename}"

            confidence = round(0.88 + (hash(f"{plate}{leg_idx}") % 10) * 0.01, 2)
            pts_ms = min_offset * 60 * 1000
            track_id = f"{cam_native}-{leg_idx + 101}"

            raw_reads = [
                {"plate": plate, "conf": confidence},
                {"plate": plate, "conf": round(confidence - 0.02, 2)},
                {"plate": plate, "conf": round(confidence + 0.01, 2)},
            ]
            bbox = {"x1": 320, "y1": 510, "x2": 610, "y2": 620}

            det_id = uuid.uuid4()
            cur.execute("""
                INSERT INTO detections (
                    id, camera_id, plate_text, confidence, pts_ms, detected_at,
                    track_id, crop_uri, vehicle_type, raw_reads, bbox, tags, notes
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                );
            """, (
                det_id, cam_id, plate, confidence, pts_ms, stamp_dt,
                track_id, crop_uri, v_type, psycopg.types.json.Jsonb(raw_reads),
                psycopg.types.json.Jsonb(bbox), psycopg.types.json.Jsonb(tags),
                f"Sighting leg {leg_idx + 1} at {cam_native} ({rto})"
            ))
            total_detections += 1

            if w_id:
                alert_id = uuid.uuid4()
                cur.execute("""
                    INSERT INTO alerts (
                        id, watchlist_id, detection_id, matched_at, match_type,
                        score, status, notes
                    ) VALUES (
                        %s, %s, %s, %s, 'exact', 1.0, 'new', %s
                    );
                """, (alert_id, w_id, det_id, stamp_dt, f"Watchlist hit for {plate} at {cam_native}"))
                total_alerts += 1

    conn.commit()
    cur.close()
    conn.close()

    print("\n" + "=" * 68)
    print(f" SUCCESS: Seeded {total_detections} detections across all 27 Gujarat RTOs (GJ01-GJ27)")
    print(f" Generated {total_detections} evidence crops in {EVIDENCE_DIR}")
    print(f" Generated {total_alerts} active alerts for watchlist matches")
    print("=" * 68)

if __name__ == "__main__":
    main()

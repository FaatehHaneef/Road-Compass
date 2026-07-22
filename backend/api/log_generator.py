"""
Log Sheet Generator

Converts the flat list of events from the HOS engine into per-day
grid segments suitable for Canvas rendering on the frontend.

Each segment has:
  status, start_hour (0–24), end_hour (0–24)

Events that cross midnight are split cleanly into two segments.
"""

from collections import defaultdict
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

STATUS_LABELS = {
    "OFF_DUTY": "Off Duty",
    "SLEEPER_BERTH": "Sleeper Berth",
    "DRIVING": "Driving",
    "ON_DUTY_NOT_DRIVING": "On Duty (Not Driving)",
}


def generate_log_sheets(events: list[dict]) -> list[dict]:
    """
    Group events into per-calendar-day log sheets.

    Returns a list sorted by date, each entry:
    {
        "date": "YYYY-MM-DD",
        "grid_segments": [{"status", "start_hour", "end_hour", "remarks"}],
        "totals": {"OFF_DUTY": hrs, "SLEEPER_BERTH": hrs, "DRIVING": hrs, "ON_DUTY_NOT_DRIVING": hrs},
        "remarks": ["human-readable string", ...]
    }
    """
    if not events:
        return []

    days: dict[str, list[dict]] = defaultdict(list)

    for event in events:
        try:
            start = event["start_time"]
            end = event["end_time"]
            status = event.get("status", "OFF_DUTY")
            remarks = event.get("remarks", "")

            if status not in STATUS_LABELS:
                logger.warning("Unknown status %r, defaulting to OFF_DUTY", status)
                status = "OFF_DUTY"

            if start >= end:
                continue  # Zero-duration or inverted events: skip

            # Split across midnight boundaries
            current = start
            while current < end:
                next_midnight = (current + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                chunk_end = min(end, next_midnight)

                date_str = current.strftime("%Y-%m-%d")
                start_hour = current.hour + current.minute / 60.0 + current.second / 3600.0
                end_hour_val = chunk_end.hour + chunk_end.minute / 60.0 + chunk_end.second / 3600.0

                # When the chunk ends exactly at midnight, end_hour = 24.0
                if chunk_end == next_midnight:
                    end_hour_val = 24.0

                if end_hour_val > start_hour:
                    days[date_str].append({
                        "status": status,
                        "start_hour": round(start_hour, 4),
                        "end_hour": round(end_hour_val, 4),
                        "remarks": remarks,
                    })

                current = chunk_end

        except (KeyError, TypeError, AttributeError) as e:
            logger.warning("Skipping malformed event: %s — %s", event, e)
            continue

    # Build output list
    log_sheets = []
    for date_str in sorted(days.keys()):
        segments = days[date_str]

        # Compute totals per status
        totals = {
            "OFF_DUTY": 0.0,
            "SLEEPER_BERTH": 0.0,
            "DRIVING": 0.0,
            "ON_DUTY_NOT_DRIVING": 0.0,
        }
        for seg in segments:
            dur = seg["end_hour"] - seg["start_hour"]
            if dur > 0:
                totals[seg["status"]] = round(totals[seg["status"]] + dur, 4)

        # Build readable remarks list (de-duplicate consecutive identical remarks)
        seen_remarks = set()
        remarks_list = []
        for seg in segments:
            r = seg["remarks"]
            if r and r != "Driving" and r not in seen_remarks:
                time_label = f"{int(seg['start_hour']):02d}:{int((seg['start_hour'] % 1) * 60):02d}"
                remarks_list.append(f"{r} @ {time_label}")
                seen_remarks.add(r)

        log_sheets.append({
            "date": date_str,
            "grid_segments": segments,
            "totals": totals,
            "remarks": remarks_list,
        })

    return log_sheets

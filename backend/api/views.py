"""
Trip Planner API View

Single POST endpoint: /api/trip/

All inputs are validated and sanitised before any computation.
All external API failures are caught and return clear error messages.
All internal errors are caught and return a 500 with a safe message.
"""

import logging
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .route_service import geocode_location, get_route
from .hos_engine import plan_trip
from .log_generator import generate_log_sheets

logger = logging.getLogger(__name__)

# ── Input Constraints ─────────────────────────────────────────────────────────
MAX_LOCATION_LENGTH = 200
MAX_CYCLE_USED = 70.0
MIN_CYCLE_USED = 0.0


def _sanitize_location(raw: str) -> str | None:
    """Strip, truncate, and basic-validate a location string."""
    if not raw or not isinstance(raw, str):
        return None
    cleaned = raw.strip()[:MAX_LOCATION_LENGTH]
    if len(cleaned) < 2:
        return None
    # Block obviously malicious patterns (script tags, SQL injection attempts)
    forbidden = ["<script", "javascript:", "--", "DROP ", "SELECT "]
    for pattern in forbidden:
        if pattern.lower() in cleaned.lower():
            return None
    return cleaned


def _parse_cycle_used(raw) -> float | None:
    """Parse and validate cycle_used hours."""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not (MIN_CYCLE_USED <= value <= MAX_CYCLE_USED):
        return None
    return value


class TripPlannerView(APIView):

    def post(self, request):
        # ── 1. Input validation ───────────────────────────────────────────────
        data = request.data

        current_loc = _sanitize_location(data.get("current_location", ""))
        pickup_loc = _sanitize_location(data.get("pickup_location", ""))
        dropoff_loc = _sanitize_location(data.get("dropoff_location", ""))
        cycle_used = _parse_cycle_used(data.get("current_cycle_used", 0))

        errors = []
        if not current_loc:
            errors.append("current_location is required and must be a valid location name.")
        if not pickup_loc:
            errors.append("pickup_location is required and must be a valid location name.")
        if not dropoff_loc:
            errors.append("dropoff_location is required and must be a valid location name.")
        if cycle_used is None:
            errors.append(f"current_cycle_used must be a number between {MIN_CYCLE_USED} and {MAX_CYCLE_USED}.")

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Block identical origin/pickup or pickup/dropoff (would produce 0-mile legs)
        if current_loc.lower() == pickup_loc.lower():
            return Response(
                {"errors": ["current_location and pickup_location cannot be the same."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pickup_loc.lower() == dropoff_loc.lower():
            return Response(
                {"errors": ["pickup_location and dropoff_location cannot be the same."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 2. Geocoding ──────────────────────────────────────────────────────
        logger.info("Geocoding: %r, %r, %r", current_loc, pickup_loc, dropoff_loc)

        current_coords = geocode_location(current_loc)
        if not current_coords:
            return Response(
                {"errors": [f"Could not find location: '{current_loc}'. Try a more specific address (e.g., 'Chicago, IL, USA')."]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        pickup_coords = geocode_location(pickup_loc)
        if not pickup_coords:
            return Response(
                {"errors": [f"Could not find location: '{pickup_loc}'."]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        dropoff_coords = geocode_location(dropoff_loc)
        if not dropoff_coords:
            return Response(
                {"errors": [f"Could not find location: '{dropoff_loc}'."]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # ── 3. Routing ────────────────────────────────────────────────────────
        leg1 = get_route(current_coords, pickup_coords)
        if not leg1:
            return Response(
                {"errors": ["Could not calculate route from current location to pickup. Locations may be unreachable by road."]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        leg2 = get_route(pickup_coords, dropoff_coords)
        if not leg2:
            return Response(
                {"errors": ["Could not calculate route from pickup to dropoff. Locations may be unreachable by road."]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # ── 4. HOS Engine ─────────────────────────────────────────────────────
        route_legs = [
            {
                "distance_miles": leg1["distance_miles"],
                "duration_hours": leg1["duration_hours"],
                "origin": current_loc,
                "dest": pickup_loc,
                "geometry": leg1["geometry"],
            },
            {
                "distance_miles": leg2["distance_miles"],
                "duration_hours": leg2["duration_hours"],
                "origin": pickup_loc,
                "dest": dropoff_loc,
                "geometry": leg2["geometry"],
            },
        ]

        # Start trip at the current time, rounded to the nearest hour
        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        start_time_str = now.isoformat()

        try:
            events = plan_trip(route_legs, start_time_str, cycle_used)
        except (ValueError, RuntimeError) as e:
            logger.error("HOS engine error: %s", e)
            return Response(
                {"errors": [f"Trip planning failed: {str(e)}"]},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception as e:
            logger.exception("Unexpected HOS engine error")
            return Response(
                {"errors": ["An unexpected error occurred while planning the trip."]},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not events:
            return Response(
                {"errors": ["Trip produced no schedule events. Check input locations."]},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        # ── 5. Log Sheet Generation ───────────────────────────────────────────
        # Serialise datetime objects before passing to log generator
        serialised_events = []
        for ev in events:
            serialised_events.append({
                **ev,
                "start_time": ev["start_time"].isoformat(),
                "end_time": ev["end_time"].isoformat(),
            })

        log_sheets = generate_log_sheets(serialised_events)

        # ── 6. Build stops list for map markers ───────────────────────────────
        stops = []
        for ev in serialised_events:
            s = ev["status"]
            r = ev.get("remarks", "")
            if s == "ON_DUTY_NOT_DRIVING" or (s == "OFF_DUTY" and "rest" in r.lower()):
                stops.append({
                    "type": _classify_stop(r),
                    "start_time": ev["start_time"],
                    "end_time": ev["end_time"],
                    "duration_hours": ev["duration_hours"],
                    "location": ev["location"],
                    "remarks": r,
                })

        # ── 7. Response ───────────────────────────────────────────────────────
        return Response({
            "route": {
                "total_distance_miles": round(leg1["distance_miles"] + leg2["distance_miles"], 1),
                "total_duration_hours": round(leg1["duration_hours"] + leg2["duration_hours"], 1),
                "waypoints": [
                    {
                        "label": "Origin",
                        "name": current_loc,
                        "display_name": current_coords["name"],
                        "lat": current_coords["lat"],
                        "lon": current_coords["lon"],
                        "type": "origin",
                    },
                    {
                        "label": "Pickup",
                        "name": pickup_loc,
                        "display_name": pickup_coords["name"],
                        "lat": pickup_coords["lat"],
                        "lon": pickup_coords["lon"],
                        "type": "pickup",
                    },
                    {
                        "label": "Dropoff",
                        "name": dropoff_loc,
                        "display_name": dropoff_coords["name"],
                        "lat": dropoff_coords["lat"],
                        "lon": dropoff_coords["lon"],
                        "type": "dropoff",
                    },
                ],
                "geometries": [leg1["geometry"], leg2["geometry"]],
            },
            "schedule": serialised_events,
            "log_sheets": log_sheets,
            "stops": stops,
            "summary": {
                "total_days": len(log_sheets),
                "total_driving_hours": round(
                    sum(e["duration_hours"] for e in serialised_events if e["status"] == "DRIVING"), 1
                ),
                "total_rest_hours": round(
                    sum(e["duration_hours"] for e in serialised_events if e["status"] == "OFF_DUTY"), 1
                ),
                "total_stops": len(stops),
                "cycle_hours_used_after_trip": round(
                    cycle_used + sum(
                        e["duration_hours"]
                        for e in serialised_events
                        if e["status"] in ("DRIVING", "ON_DUTY_NOT_DRIVING")
                    ),
                    1,
                ),
            },
        })


def _classify_stop(remarks: str) -> str:
    r = remarks.lower()
    if "pickup" in r:
        return "PICKUP"
    if "dropoff" in r:
        return "DROPOFF"
    if "fuel" in r:
        return "FUEL"
    if "restart" in r:
        return "RESTART"
    if "rest" in r or "break" in r:
        return "REST"
    return "STOP"

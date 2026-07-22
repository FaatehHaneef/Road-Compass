"""
Route Service - Nominatim Geocoding + OSRM Routing

Handles all external API calls with:
- Proper timeouts on every request (never hangs)
- Retry logic with exponential backoff
- Rate limiting (Nominatim: 1 req/sec policy)
- Graceful error returns (None) instead of exceptions propagating up
"""

import time
import logging
import requests

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"
HEADERS = {"User-Agent": "SpotterELDPlanner/1.0 (portfolio project)"}

REQUEST_TIMEOUT = 15       # seconds before giving up on a request
NOMINATIM_DELAY = 1.1      # seconds between Nominatim calls (policy: 1/sec)
MAX_RETRIES = 2


def _get_with_retry(url: str, params: dict, timeout: int = REQUEST_TIMEOUT) -> dict | None:
    """GET a URL with retry logic. Returns parsed JSON or None on failure."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout:
            logger.warning("Request timed out (attempt %d): %s", attempt + 1, url)
        except requests.exceptions.HTTPError as e:
            logger.warning("HTTP error %s on %s", e.response.status_code, url)
            break  # Don't retry on HTTP errors (4xx/5xx)
        except requests.exceptions.ConnectionError as e:
            logger.warning("Connection error (attempt %d): %s", attempt + 1, str(e))
        except ValueError:
            logger.warning("JSON decode error from %s", url)
            break

        if attempt < MAX_RETRIES:
            time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s

    return None


def geocode_location(location_name: str) -> dict | None:
    """
    Convert a location name to {lat, lon, display_name}.
    Returns None if geocoding fails for any reason.
    Enforces Nominatim's 1-request/second policy.
    """
    if not location_name or not location_name.strip():
        logger.warning("geocode_location called with empty string")
        return None

    location_name = location_name.strip()

    # Rate limit: Nominatim policy is max 1 request/second
    time.sleep(NOMINATIM_DELAY)

    params = {
        "q": location_name,
        "format": "json",
        "limit": 1,
        "addressdetails": 1,
    }

    data = _get_with_retry(NOMINATIM_URL, params)

    if not data or not isinstance(data, list) or len(data) == 0:
        logger.warning("No geocoding result for: %r", location_name)
        return None

    result = data[0]
    try:
        return {
            "lat": float(result["lat"]),
            "lon": float(result["lon"]),
            "name": result.get("display_name", location_name),
        }
    except (KeyError, ValueError, TypeError) as e:
        logger.warning("Unexpected geocoding response shape: %s", e)
        return None


def get_route(origin: dict, dest: dict) -> dict | None:
    """
    Get driving route between two {lat, lon} dicts via OSRM.
    Returns {distance_miles, duration_hours, geometry} or None on failure.
    """
    if not origin or not dest:
        return None

    # OSRM coordinate order: lon,lat
    try:
        coords = (
            f"{float(origin['lon']):.6f},{float(origin['lat']):.6f}"
            f";{float(dest['lon']):.6f},{float(dest['lat']):.6f}"
        )
    except (KeyError, ValueError, TypeError) as e:
        logger.warning("Invalid coordinates for routing: %s", e)
        return None

    url = f"{OSRM_BASE_URL}/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }

    data = _get_with_retry(url, params)

    if not data or data.get("code") != "Ok":
        logger.warning("OSRM routing failed: %s", data)
        return None

    routes = data.get("routes")
    if not routes or not isinstance(routes, list) or len(routes) == 0:
        return None

    route = routes[0]

    try:
        distance_m = float(route["distance"])
        duration_s = float(route["duration"])

        if distance_m <= 0 or duration_s <= 0:
            logger.warning("OSRM returned zero/negative distance or duration")
            return None

        return {
            "distance_miles": distance_m * 0.000621371,
            "duration_hours": duration_s / 3600.0,
            "geometry": route.get("geometry", {}),
        }
    except (KeyError, ValueError, TypeError) as e:
        logger.warning("Unexpected OSRM response shape: %s", e)
        return None

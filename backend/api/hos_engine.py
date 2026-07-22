"""
HOS Engine - FMCSA Hours of Service Scheduler
Property-Carrying Driver, 70hr/8-day cycle.

Safety guarantees:
- Infinite loop is impossible: every iteration of the while loop MUST
  consume time (advance miles_remaining). A hard iteration cap is also
  enforced as a final safety net.
- All driver state counters are clamped to >= 0.
- Unreachable states raise ValueError immediately.
"""

from datetime import datetime, timedelta

# ── FMCSA Constants ──────────────────────────────────────────────────────────
MAX_DRIVE_HOURS = 11.0          # Max driving per shift
MAX_WINDOW_HOURS = 14.0         # Max on-duty window per shift
REQUIRED_REST_HOURS = 10.0      # Off-duty rest required to reset shift
RESTART_HOURS = 34.0            # Off-duty hours to reset full 70-hr cycle
MAX_CYCLE_HOURS = 70.0          # 70-hr / 8-day cycle
BREAK_REQUIRED_AFTER = 8.0      # Driving hours before mandatory 30-min break
BREAK_DURATION = 0.5            # 30-minute break
FUEL_INTERVAL_MILES = 1000.0    # Fuel stop every 1000 miles
FUEL_STOP_DURATION = 0.5        # 30-minute fuel stop
STOP_DURATION = 1.0             # 1 hour for pickup / dropoff

# Minimum meaningful driving chunk (prevents micro-loops)
MIN_DRIVE_CHUNK = 0.01          # ~36 seconds

# Hard cap on loop iterations per leg (safety net against any logic bug)
MAX_ITERATIONS_PER_LEG = 10_000

# ── Status Labels ─────────────────────────────────────────────────────────────
OFF_DUTY = "OFF_DUTY"
SLEEPER = "SLEEPER_BERTH"
DRIVING = "DRIVING"
ON_DUTY = "ON_DUTY_NOT_DRIVING"


class DriverState:
    """Mutable driver state, updated as the trip is simulated."""

    def __init__(self, start_time: datetime, initial_cycle_used: float):
        # Clamp initial_cycle_used to valid range [0, MAX_CYCLE_HOURS]
        initial_cycle_used = max(0.0, min(float(initial_cycle_used), MAX_CYCLE_HOURS))

        self.current_time = start_time
        self.drive_remaining = MAX_DRIVE_HOURS      # hrs of driving left this shift
        self.window_remaining = MAX_WINDOW_HOURS    # hrs left in 14-hr window
        self.cycle_remaining = MAX_CYCLE_HOURS - initial_cycle_used
        self.drive_since_break = 0.0                # hrs driven since last break
        self.miles_since_fuel = 0.0                 # miles since last fuel stop
        self.events: list[dict] = []

    # ── Private helpers ───────────────────────────────────────────────────────

    def _add_event(self, status: str, duration: float, location: str, remarks: str = ""):
        """Record a duty-status event and advance the clock."""
        if duration <= 0:
            return
        start = self.current_time
        self.current_time += timedelta(hours=duration)
        self.events.append({
            "status": status,
            "start_time": start,
            "end_time": self.current_time,
            "duration_hours": round(duration, 4),
            "location": location,
            "remarks": remarks,
        })

    # ── Public actions ────────────────────────────────────────────────────────

    def do_rest(self, hours: float, location: str, remarks: str = ""):
        """Take off-duty / sleeper berth rest. Resets shift counters if ≥ 10hrs."""
        self._add_event(OFF_DUTY, hours, location, remarks)
        if hours >= REQUIRED_REST_HOURS:
            self.drive_remaining = MAX_DRIVE_HOURS
            self.window_remaining = MAX_WINDOW_HOURS
            self.drive_since_break = 0.0
        if hours >= RESTART_HOURS:
            self.cycle_remaining = MAX_CYCLE_HOURS

    def do_on_duty(self, hours: float, location: str, remarks: str = ""):
        """On-duty (not driving): pickup, dropoff, fueling."""
        self._add_event(ON_DUTY, hours, location, remarks)
        self.window_remaining = max(0.0, self.window_remaining - hours)
        self.cycle_remaining = max(0.0, self.cycle_remaining - hours)

    def do_break(self, location: str):
        """30-minute mandatory break (off-duty)."""
        self._add_event(OFF_DUTY, BREAK_DURATION, location, "30-min mandatory break")
        self.drive_since_break = 0.0
        # Break counts against the 14-hr window but NOT against driving limit
        self.window_remaining = max(0.0, self.window_remaining - BREAK_DURATION)

    def do_drive(self, hours: float, location: str):
        """Drive for `hours`. Updates all relevant counters."""
        self._add_event(DRIVING, hours, location, "Driving")
        self.drive_remaining = max(0.0, self.drive_remaining - hours)
        self.window_remaining = max(0.0, self.window_remaining - hours)
        self.cycle_remaining = max(0.0, self.cycle_remaining - hours)
        self.drive_since_break += hours


def _need_restart(state: DriverState) -> bool:
    return state.cycle_remaining < MIN_DRIVE_CHUNK


def _need_rest(state: DriverState) -> bool:
    return (
        state.drive_remaining < MIN_DRIVE_CHUNK
        or state.window_remaining < MIN_DRIVE_CHUNK
    )


def _need_break(state: DriverState) -> bool:
    return state.drive_since_break >= BREAK_REQUIRED_AFTER


def _miles_to_fuel(state: DriverState) -> float:
    return max(0.0, FUEL_INTERVAL_MILES - state.miles_since_fuel)


def _process_leg(state: DriverState, leg: dict):
    """
    Drive one route leg end-to-end, inserting all required stops.
    
    The loop invariant: every iteration either:
      (a) advances miles_remaining (drives some distance), OR
      (b) takes a rest/break/fuel which resets a constraint so the next
          iteration can drive.
    A secondary safeguard (MAX_ITERATIONS_PER_LEG) makes an infinite
    loop logically impossible even under unforeseen edge cases.
    """
    distance_miles = float(leg["distance_miles"])
    duration_hours = float(leg["duration_hours"])
    origin = leg["origin"]
    dest = leg["dest"]

    if distance_miles <= 0 or duration_hours <= 0:
        return  # Zero-length leg — nothing to do

    avg_speed = distance_miles / duration_hours  # mph
    miles_remaining = distance_miles

    iteration = 0

    while miles_remaining > MIN_DRIVE_CHUNK:
        iteration += 1
        if iteration > MAX_ITERATIONS_PER_LEG:
            # Absolute safety net — should never be reached with correct logic
            raise RuntimeError(
                f"HOS engine exceeded {MAX_ITERATIONS_PER_LEG} iterations on leg "
                f"'{origin}→{dest}'. Please check inputs."
            )

        location_label = f"{origin} → {dest}"

        # ── Priority 1: Cycle exhausted → 34-hr restart ──────────────────
        if _need_restart(state):
            state.do_rest(RESTART_HOURS, location_label, "34-hour cycle restart")
            continue  # re-evaluate all constraints

        # ── Priority 2: Shift exhausted → 10-hr rest ─────────────────────
        if _need_rest(state):
            state.do_rest(REQUIRED_REST_HOURS, location_label, "10-hour rest break")
            continue

        # ── Priority 3: 8-hr drive → 30-min mandatory break ──────────────
        if _need_break(state):
            state.do_break(location_label)
            continue

        # ── Priority 4: Fuel needed ───────────────────────────────────────
        miles_to_next_fuel = _miles_to_fuel(state)
        if miles_to_next_fuel < MIN_DRIVE_CHUNK:
            state.do_on_duty(FUEL_STOP_DURATION, location_label, "Fuel stop")
            state.miles_since_fuel = 0.0
            continue

        # ── Drive the maximum safe chunk ──────────────────────────────────
        # How far can we drive before hitting ANY constraint?
        hrs_to_break = max(0.0, BREAK_REQUIRED_AFTER - state.drive_since_break)
        hrs_to_fuel = miles_to_next_fuel / avg_speed

        max_driveable_hrs = min(
            state.drive_remaining,
            state.window_remaining,
            state.cycle_remaining,
            hrs_to_break,
            hrs_to_fuel,
            miles_remaining / avg_speed,
        )

        if max_driveable_hrs < MIN_DRIVE_CHUNK:
            # A constraint is EXACTLY at 0 but wasn't caught above.
            # Force a rest to avoid being stuck (ultimate fallback).
            state.do_rest(REQUIRED_REST_HOURS, location_label, "10-hour rest break (constraint)")
            continue

        # Drive!
        actual_miles = max_driveable_hrs * avg_speed
        state.do_drive(max_driveable_hrs, location_label)
        state.miles_since_fuel += actual_miles
        miles_remaining -= actual_miles


def plan_trip(
    route_legs: list[dict],
    start_time_str: str,
    initial_cycle_used: float,
) -> list[dict]:
    """
    Main entry point. Returns a flat list of duty-status events.

    route_legs: [
        {"distance_miles": float, "duration_hours": float, "origin": str, "dest": str},
        ...
    ]
    """
    if not route_legs:
        raise ValueError("route_legs cannot be empty")

    # Parse start time safely
    try:
        start_time = datetime.fromisoformat(start_time_str)
    except ValueError:
        raise ValueError(f"Invalid start_time format: {start_time_str!r}")

    state = DriverState(start_time, initial_cycle_used)

    for idx, leg in enumerate(route_legs):
        is_first = idx == 0
        is_last = idx == len(route_legs) - 1

        origin = leg.get("origin", "Unknown")
        dest = leg.get("dest", "Unknown")

        # Pickup stop at start of first leg
        if is_first:
            state.do_on_duty(STOP_DURATION, origin, f"Pickup at {origin}")

        _process_leg(state, leg)

        # Dropoff stop at end of last leg
        if is_last:
            state.do_on_duty(STOP_DURATION, dest, f"Dropoff at {dest}")

    return state.events

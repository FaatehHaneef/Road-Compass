import { Stage, Layer, Rect, Line, Text, Group } from 'react-konva'

const ROW_HEIGHT = 40
const COL_WIDTH = 30
const OFFSET_X = 140
const OFFSET_Y = 60
const CANVAS_WIDTH = OFFSET_X + (24 * COL_WIDTH) + 80 // 80px right margin for totals
const CANVAS_HEIGHT = OFFSET_Y + (4 * ROW_HEIGHT) + 40

const STATUS_ROWS = {
  'OFF_DUTY': 0,
  'SLEEPER_BERTH': 1,
  'DRIVING': 2,
  'ON_DUTY_NOT_DRIVING': 3
}

const ROW_LABELS = [
  'Off Duty',
  'Sleeper Berth',
  'Driving',
  'On Duty (Not Drv)'
]

const STATUS_COLORS = {
  'OFF_DUTY': '#64748b',          // slate
  'SLEEPER_BERTH': '#7c3aed',     // purple
  'DRIVING': '#4f8ef7',           // blue
  'ON_DUTY_NOT_DRIVING': '#f59e0b'// amber
}

// Draw the static grid
const Grid = () => {
  const elements = []

  // Row backgrounds
  for (let i = 0; i < 4; i++) {
    elements.push(
      <Rect
        key={`bg-${i}`}
        x={0} y={OFFSET_Y + i * ROW_HEIGHT}
        width={CANVAS_WIDTH} height={ROW_HEIGHT}
        fill={i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)'}
      />
    )
    
    // Row Labels
    elements.push(
      <Text
        key={`label-${i}`}
        x={10} y={OFFSET_Y + i * ROW_HEIGHT + 14}
        text={ROW_LABELS[i]}
        fontSize={12}
        fontFamily="Inter"
        fill="var(--text-primary)"
      />
    )
    
    // Horizontal row lines
    elements.push(
      <Line
        key={`hline-${i}`}
        points={[OFFSET_X, OFFSET_Y + i * ROW_HEIGHT, OFFSET_X + 24 * COL_WIDTH, OFFSET_Y + i * ROW_HEIGHT]}
        stroke="var(--border-light)"
        strokeWidth={1}
      />
    )
  }

  // Bottom horizontal line
  elements.push(
    <Line
      key="hline-bottom"
      points={[OFFSET_X, OFFSET_Y + 4 * ROW_HEIGHT, OFFSET_X + 24 * COL_WIDTH, OFFSET_Y + 4 * ROW_HEIGHT]}
      stroke="var(--border-light)"
      strokeWidth={1}
    />
  )

  // Vertical hour lines
  for (let i = 0; i <= 24; i++) {
    const x = OFFSET_X + i * COL_WIDTH
    
    // Hour labels (Midnight, 1, 2... Noon, 1, 2...)
    let hourLabel = ''
    if (i === 0 || i === 24) hourLabel = 'M'
    else if (i === 12) hourLabel = 'N'
    else hourLabel = (i % 12).toString()

    elements.push(
      <Text
        key={`hr-text-${i}`}
        x={x - 4} y={OFFSET_Y - 20}
        text={hourLabel}
        fontSize={10}
        fontFamily="Inter"
        fill="var(--text-muted)"
      />
    )

    // Main hour line
    elements.push(
      <Line
        key={`vline-${i}`}
        points={[x, OFFSET_Y, x, OFFSET_Y + 4 * ROW_HEIGHT]}
        stroke="var(--border-light)"
        strokeWidth={i === 0 || i === 12 || i === 24 ? 2 : 1}
      />
    )

    // Quarter-hour tick marks (15, 30, 45)
    if (i < 24) {
      for (let q = 1; q <= 3; q++) {
        const qx = x + q * (COL_WIDTH / 4)
        elements.push(
          <Line
            key={`tick-${i}-${q}`}
            points={[qx, OFFSET_Y, qx, OFFSET_Y + 4 * ROW_HEIGHT]}
            stroke="var(--border-light)"
            strokeWidth={0.5}
            opacity={q === 2 ? 0.8 : 0.4} // half-hour tick is slightly more visible
            dash={q === 2 ? [2, 2] : undefined}
          />
        )
      }
    }
  }

  return <Group>{elements}</Group>
}

// Draw the actual driver data lines
const LogLines = ({ segments }) => {
  const elements = []
  
  // Sort segments by start_hour just to be safe
  const sorted = [...segments].sort((a, b) => a.start_hour - b.start_hour)

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i]
    const row = STATUS_ROWS[seg.status]
    if (row === undefined) continue

    const startX = OFFSET_X + seg.start_hour * COL_WIDTH
    const endX = OFFSET_X + seg.end_hour * COL_WIDTH
    const y = OFFSET_Y + row * ROW_HEIGHT + ROW_HEIGHT / 2
    
    // Draw horizontal segment
    elements.push(
      <Line
        key={`seg-${i}`}
        points={[startX, y, endX, y]}
        stroke={STATUS_COLORS[seg.status]}
        strokeWidth={4}
        lineCap="round"
      />
    )

    // Draw vertical connection to NEXT segment if there is one
    if (i < sorted.length - 1) {
      const nextSeg = sorted[i+1]
      const nextRow = STATUS_ROWS[nextSeg.status]
      if (nextRow !== undefined) {
        const nextY = OFFSET_Y + nextRow * ROW_HEIGHT + ROW_HEIGHT / 2
        elements.push(
          <Line
            key={`conn-${i}`}
            points={[endX, y, endX, nextY]}
            stroke="var(--border-light)"
            strokeWidth={2}
          />
        )
      }
    }
  }

  return <Group>{elements}</Group>
}

// Draw Totals on the right
const Totals = ({ totals }) => {
  const elements = []
  
  Object.keys(STATUS_ROWS).forEach(status => {
    const row = STATUS_ROWS[status]
    const val = totals[status] || 0
    
    elements.push(
      <Text
        key={`total-${status}`}
        x={OFFSET_X + 24 * COL_WIDTH + 15}
        y={OFFSET_Y + row * ROW_HEIGHT + 14}
        text={val.toFixed(2)}
        fontSize={12}
        fontFamily="Roboto Mono"
        fill="var(--text-primary)"
      />
    )
  })

  // Column Header
  elements.push(
    <Text
      key="total-header"
      x={OFFSET_X + 24 * COL_WIDTH + 10}
      y={OFFSET_Y - 20}
      text="Hours"
      fontSize={10}
      fontFamily="Inter"
      fill="var(--text-muted)"
    />
  )

  return <Group>{elements}</Group>
}

const LogSheet = ({ sheet, dayNumber }) => {
  // Format Date for Header
  const dateStr = new Date(sheet.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="card log-sheet" style={{ overflowX: 'auto', padding: '1.25rem', background: 'var(--bg-primary)', minWidth: '920px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, color: 'var(--accent)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Day {dayNumber}
          </h4>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{dateStr}</h3>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Carrier: Spotter Logistics</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Driver: ________________</div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            <Grid />
            <LogLines segments={sheet.grid_segments} />
            <Totals totals={sheet.totals} />
          </Layer>
        </Stage>
      </div>

      {sheet.remarks && sheet.remarks.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Remarks / Stops</h5>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {sheet.remarks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export default LogSheet

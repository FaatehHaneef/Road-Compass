import { motion } from 'framer-motion'
import { Clock, Route, Fuel, Coffee, Moon, Flag, MapPin } from 'lucide-react'

const ICONS = {
  PICKUP: <MapPin size={18} className="text-accent" />,
  DROPOFF: <Flag size={18} className="text-green" />,
  FUEL: <Fuel size={18} className="text-amber" />,
  REST: <Moon size={18} className="text-purple" />,
  RESTART: <Coffee size={18} className="text-purple" />,
  STOP: <Clock size={18} className="text-muted" />
}

const formatDate = (isoString) => {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const formatTime = (isoString) => {
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const StopsList = ({ schedule, summary }) => {
  if (!schedule) return null

  // Filter out just the driving segments, we want the stops
  const stops = schedule.filter(ev => 
    ev.status !== 'DRIVING' && 
    !(ev.status === 'OFF_DUTY' && ev.remarks.includes('30-min')) // hide minor 30 min breaks for brevity, or keep them? Let's keep them.
  )

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.875rem' }}>
          <Route size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          <strong>{summary.total_days}</strong> Days Total
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.875rem' }}>
          <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          <strong>{summary.total_driving_hours}h</strong> Driving
        </div>
        <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '100px', fontSize: '0.875rem' }}>
          <Moon size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          <strong>{summary.total_rest_hours}h</strong> Rest
        </div>
      </div>

      {/* Timeline */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        style={{ position: 'relative', paddingLeft: '1rem' }}
      >
        {/* Vertical connecting line */}
        <div style={{ 
          position: 'absolute', 
          top: '1rem', 
          bottom: '1rem', 
          left: '1.55rem', 
          width: '2px', 
          background: 'var(--border)' 
        }} />

        {stops.map((stop, i) => {
          // Classify for icon
          const r = stop.remarks.toLowerCase()
          let type = 'STOP'
          if (r.includes('pickup')) type = 'PICKUP'
          else if (r.includes('dropoff')) type = 'DROPOFF'
          else if (r.includes('fuel')) type = 'FUEL'
          else if (r.includes('restart')) type = 'RESTART'
          else if (r.includes('rest') || r.includes('break')) type = 'REST'

          return (
            <motion.div 
              key={i} 
              variants={item}
              style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}
            >
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: 'var(--bg-card)', 
                border: '2px solid var(--border)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {ICONS[type]}
              </div>
              
              <div style={{ flex: 1, paddingTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>{stop.remarks}</h4>
                  <span className="text-mono text-secondary" style={{ fontSize: '0.875rem' }}>
                    {formatTime(stop.start_time)}
                  </span>
                </div>
                
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {formatDate(stop.start_time)} • {stop.location} • {stop.duration_hours}h
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

export default StopsList

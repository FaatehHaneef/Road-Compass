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

  const steps = schedule.filter((ev) => ev.status !== 'DRIVING')

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
    <div className="timeline-shell">
      
      {/* Summary Chips */}
      <div className="timeline-summary">
        <div className="timeline-chip">
          <Route size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          <strong>{summary.total_days}</strong> Days Total
        </div>
        <div className="timeline-chip">
          <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          <strong>{summary.total_driving_hours}h</strong> Driving
        </div>
        <div className="timeline-chip">
          <Moon size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
          <strong>{summary.total_rest_hours}h</strong> Rest
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="timeline-row"
      >
        <div className="timeline-track" />

        {steps.map((step, i) => {
          // Classify for icon
          const r = step.remarks.toLowerCase()
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
              className="timeline-step"
            >
              <div className="timeline-node">
                {ICONS[type]}
              </div>
              
              <div className="timeline-card-body">
                <div className="timeline-topline">
                  <h4>{step.remarks}</h4>
                  <span className="text-mono text-secondary">
                    {formatTime(step.start_time)}
                  </span>
                </div>
                
                <div className="timeline-meta">
                  {formatDate(step.start_time)} • {step.location} • {step.duration_hours}h
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

import { useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, MapPin, Loader2, AlertCircle } from 'lucide-react'

// Components
import FlowBackground from './components/FlowBackground'
import MapView from './components/MapView'
import StopsList from './components/StopsList'
import LogSheet from './components/LogSheet'

const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL?.trim()

  if (apiUrl) {
    return apiUrl.replace(/\/$/, '')
  }

  return ''
}

function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [showLogs, setShowLogs] = useState(false)
  const [formData, setFormData] = useState({
    current_location: '',
    pickup_location: '',
    dropoff_location: '',
    current_cycle_used: 0
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'current_cycle_used' ? parseFloat(value) || 0 : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // In dev, Vite proxies /api to Django on :8000.
      // In prod, set VITE_API_URL to the deployed backend URL.
      const apiUrl = getApiBaseUrl()

      if (import.meta.env.PROD && !apiUrl) {
        throw new Error('Missing VITE_API_URL. Set it in Vercel to your deployed backend URL.')
      }
      
      const res = await axios.post(`${apiUrl}/api/trip/`, formData)
      setResult(res.data)
      setShowLogs(false)
    } catch (err) {
      if (err?.response && err.response.data && err.response.data.errors) {
        setError(err.response.data.errors.join(' '))
      } else if (err?.message) {
        setError(err.message)
      } else {
        setError('Network error: Could not reach the planner engine.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <FlowBackground />

      <AnimatePresence mode="wait">
        {showIntro ? (
          <motion.section
            key="intro"
            className="intro-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.div
              className="intro-copy"
              initial={{ opacity: 0, y: 18, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -120, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            >
              <h1>Road Compass</h1>
              <p>Plan the route. Prove the hours.</p>
              <div className="intro-actions">
                <button className="btn btn-primary btn-pill" onClick={() => setShowIntro(false)}>
                  <Truck size={18} />
                  <span>Enter Planner</span>
                </button>
              </div>
            </motion.div>
          </motion.section>
        ) : (
          <motion.main
            key="planner"
            className="container planner-shell"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <header className="planner-header">
              <div className="brand-lockup">
                <div className="brand-mark">
                  <Truck size={30} color="white" />
                </div>
                <div>
                  <h1>Road<span className="text-accent"> Compass</span></h1>
                  <p>FMCSA-aware trip planner</p>
                </div>
              </div>
              <div className="header-chip">
                Planner live
              </div>
            </header>

            <div className="planner-grid">
              <section className="card planner-card">
                <div className="section-title">
                  <MapPin size={18} className="text-accent" />
                  <div>
                    <h2>Trip Details</h2>
                    <p>Enter the route and the hours you already used this cycle.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="input-group">
                    <label>Current Location</label>
                    <input
                      type="text"
                      name="current_location"
                      placeholder="e.g. Chicago, IL"
                      value={formData.current_location}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Pickup Location</label>
                    <input
                      type="text"
                      name="pickup_location"
                      placeholder="e.g. St. Louis, MO"
                      value={formData.pickup_location}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Dropoff Location</label>
                    <input
                      type="text"
                      name="dropoff_location"
                      placeholder="e.g. Dallas, TX"
                      value={formData.dropoff_location}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Cycle Hours Used (Last 8 Days)</label>
                    <input
                      type="number"
                      name="current_cycle_used"
                      inputMode="numeric"
                      min="0"
                      max="70"
                      step="0.5"
                      value={formData.current_cycle_used}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="field-help">Max 70 hours per FMCSA cycle.</p>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="spin" />
                        Calculating route...
                      </>
                    ) : (
                      'Generate Trip Plan'
                    )}
                  </button>
                </form>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: 10, height: 0 }}
                      className="alert alert-error"
                    >
                      <AlertCircle size={18} />
                      <p>{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              <section className="card map-card">
                <MapView
                  waypoints={result?.route?.waypoints}
                  geometries={result?.route?.geometries}
                  stops={result?.stops}
                />
              </section>

              <AnimatePresence>
                {result && (
                  <motion.section
                    className="card results-band"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 18 }}
                    transition={{ duration: 0.35 }}
                  >
                    <div className="results-head">
                      <div>
                        <h2>Trip Output</h2>
                        <p>
                          The timeline is horizontal so the sequence reads left to right like the actual drive.
                        </p>
                      </div>
                      <div className="summary-strip">
                        <span>{result.summary.total_days} days</span>
                        <span>{result.summary.total_driving_hours}h driving</span>
                        <span>{result.summary.total_rest_hours}h rest</span>
                        <span>{result.summary.total_stops} stops</span>
                      </div>
                    </div>

                    <StopsList schedule={result.schedule} summary={result.summary} />

                    <div className="logs-panel">
                      <div className="logs-panel-head">
                        <div>
                          <h3>ELD Compliance Logs</h3>
                          <p>
                            Optional compliance view. Hide it when you only need the route story.
                          </p>
                        </div>
                        <button className="btn btn-secondary" type="button" onClick={() => setShowLogs((v) => !v)}>
                          {showLogs ? 'Hide logs' : 'Show logs'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {showLogs && (
                          <motion.div
                            className="logs-strip"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="logs-row">
                              {result.log_sheets.map((sheet, idx) => (
                                <LogSheet key={sheet.date} sheet={sheet} dayNumber={idx + 1} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App

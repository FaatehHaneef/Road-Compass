import { useState } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, MapPin, Loader2, AlertCircle } from 'lucide-react'

// Components
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
    <div className="container" style={{ paddingBottom: '4rem' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ 
          background: 'var(--accent)', 
          padding: '0.75rem', 
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 0 20px rgba(79, 142, 247, 0.3)'
        }}>
          <Truck size={32} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Spotter<span className="text-accent">ELD</span>
          </h1>
          <p className="text-secondary" style={{ marginTop: '-0.25rem' }}>
            FMCSA Compliant Trip Planner
          </p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Column: Form */}
        <section>
          <div className="card">
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={20} className="text-accent" /> Trip Details
            </h2>
            
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
                  min="0"
                  max="70"
                  step="0.5"
                  value={formData.current_cycle_used}
                  onChange={handleInputChange}
                  required
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Max 70 hours limit per FMCSA.
                </p>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> 
                    Calculating Route...
                  </>
                ) : (
                  'Generate Trip Plan'
                )}
              </button>
            </form>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid var(--accent-red)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-red)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Column: Map */}
        <section>
          <div className="card" style={{ height: '100%', minHeight: '500px', padding: 0, overflow: 'hidden', position: 'relative' }}>
            <MapView 
              waypoints={result?.route?.waypoints} 
              geometries={result?.route?.geometries} 
              stops={result?.stops}
            />
          </div>
        </section>
      </div>

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ marginTop: '2rem' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              
              {/* Timeline List */}
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                  Trip Timeline
                </h3>
                <StopsList schedule={result.schedule} summary={result.summary} />
              </div>

              {/* Log Sheets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Driver Daily Logs</h3>
                {result.log_sheets.map((sheet, idx) => (
                  <LogSheet key={sheet.date} sheet={sheet} dayNumber={idx + 1} />
                ))}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default App

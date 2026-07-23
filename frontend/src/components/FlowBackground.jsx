import { useEffect, useRef } from 'react'

export default function FlowBackground({ className = '' }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = container.clientWidth
    let height = container.clientHeight
    let animationFrameId
    let mouse = { x: -1000, y: -1000 }
    let particles = []

    const particleCount = 420
    const trailOpacity = 0.12
    const speed = 1
    const accent = '#6f8dff'

    class Particle {
      constructor() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = 0
        this.vy = 0
        this.age = 0
        this.life = Math.random() * 180 + 80
      }

      update() {
        const angle = (Math.cos(this.x * 0.0045) + Math.sin(this.y * 0.0045)) * Math.PI
        this.vx += Math.cos(angle) * 0.16 * speed
        this.vy += Math.sin(angle) * 0.16 * speed

        const dx = mouse.x - this.x
        const dy = mouse.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const radius = 160

        if (distance < radius) {
          const force = (radius - distance) / radius
          this.vx -= dx * force * 0.04
          this.vy -= dy * force * 0.04
        }

        this.x += this.vx
        this.y += this.vy
        this.vx *= 0.94
        this.vy *= 0.94

        this.age += 1
        if (this.age > this.life) this.reset()

        if (this.x < 0) this.x = width
        if (this.x > width) this.x = 0
        if (this.y < 0) this.y = height
        if (this.y > height) this.y = 0
      }

      reset() {
        this.x = Math.random() * width
        this.y = Math.random() * height
        this.vx = 0
        this.vy = 0
        this.age = 0
        this.life = Math.random() * 180 + 80
      }

      draw(context) {
        const alpha = 1 - Math.abs(this.age / this.life - 0.5) * 2
        context.fillStyle = accent
        context.globalAlpha = alpha * 0.9
        context.fillRect(this.x, this.y, 1.6, 1.6)
      }
    }

    const init = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = []

      for (let i = 0; i < particleCount; i += 1) {
        particles.push(new Particle())
      }
    }

    const animate = () => {
      ctx.fillStyle = `rgba(3, 5, 10, ${trailOpacity})`
      ctx.fillRect(0, 0, width, height)

      particles.forEach((particle) => {
        particle.update()
        particle.draw(ctx)
      })

      animationFrameId = window.requestAnimationFrame(animate)
    }

    const handleResize = () => {
      width = container.clientWidth
      height = container.clientHeight
      init()
    }

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      mouse = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
    }

    const handleMouseLeave = () => {
      mouse = { x: -1000, y: -1000 }
    }

    init()
    animate()

    window.addEventListener('resize', handleResize)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div ref={containerRef} className={`flow-background ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="flow-canvas" />
    </div>
  )
}
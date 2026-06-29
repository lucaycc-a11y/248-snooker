'use client'

import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'

type Snooker404TableProps = {
  hint: string
  completedText: string
  canvasLabel: string
}

type TableSize = {
  width: number
  height: number
}

type BallSpec = {
  label: string
  color: string
  x: number
  y: number
}

const RAIL = 22
const BALL_RADIUS = 11
const POCKET_RADIUS = 18
const SPRING = 'cubic-bezier(0.16,1,0.3,1)'

export function Snooker404Table({ hint, completedText, canvasLabel }: Snooker404TableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ballsRef = useRef<Matter.Body[]>([])
  const engineRef = useRef<Matter.Engine | null>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [size, setSize] = useState<TableSize>({ width: 500, height: 280 })
  const [hintHidden, setHintHidden] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const width = Math.min(500, Math.max(320, container.clientWidth))
      const height = Math.min(300, Math.max(220, width * 0.58))
      setSize({ width: Math.round(width), height: Math.round(height) })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setCelebrating(false)

    const { width: W, height: H } = size
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
    engineRef.current = engine

    const render = Matter.Render.create({
      canvas,
      engine,
      options: {
        width: W,
        height: H,
        background: '#1A4A2A',
        wireframes: false,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
      },
    })

    const walls = [
      Matter.Bodies.rectangle(W / 2, RAIL / 2, W, RAIL, railOptions('rail:top')),
      Matter.Bodies.rectangle(W / 2, H - RAIL / 2, W, RAIL, railOptions('rail:bottom')),
      Matter.Bodies.rectangle(RAIL / 2, H / 2, RAIL, H, railOptions('rail:left')),
      Matter.Bodies.rectangle(W - RAIL / 2, H / 2, RAIL, H, railOptions('rail:right')),
    ]

    const pocketPositions = [
      { x: RAIL, y: RAIL },
      { x: W / 2, y: RAIL * 0.72 },
      { x: W - RAIL, y: RAIL },
      { x: RAIL, y: H - RAIL },
      { x: W / 2, y: H - RAIL * 0.72 },
      { x: W - RAIL, y: H - RAIL },
    ]

    const pockets = pocketPositions.map((position, index) =>
      Matter.Bodies.circle(position.x, position.y, POCKET_RADIUS, {
        isStatic: true,
        isSensor: true,
        label: `pocket:${index}`,
        render: { fillStyle: '#020403' },
      }),
    )

    const ballSpecs: BallSpec[] = createBallSpecs(W, H)
    const balls = ballSpecs.map((spec) => createBall(spec))
    ballsRef.current = balls

    Matter.Composite.add(engine.world, [...walls, ...pockets, ...balls])

    const drawDetails = () => {
      const context = render.context
      drawFeltTexture(context, W, H)
      drawPocketRims(context, pocketPositions)
      drawEightBallLabel(context, ballsRef.current)
    }

    Matter.Events.on(render, 'afterRender', drawDetails)

    const respawnBall = (ball: Matter.Body, delay: number) => {
      const timeout = setTimeout(() => {
        Matter.Body.setPosition(ball, homePositionFor(ball.label, W, H))
        Matter.Body.setVelocity(ball, { x: 0, y: 0 })
        Matter.Body.setAngularVelocity(ball, 0)
        Matter.Composite.add(engine.world, ball)
      }, delay)
      timeoutsRef.current.push(timeout)
    }

    const respawnAllBalls = (delay: number) => {
      const timeout = setTimeout(() => {
        setCelebrating(false)
        ballsRef.current.forEach((ball) => {
          if (!Matter.Composite.allBodies(engine.world).includes(ball)) {
            Matter.Composite.add(engine.world, ball)
          }
          Matter.Body.setPosition(ball, homePositionFor(ball.label, W, H))
          Matter.Body.setVelocity(ball, { x: 0, y: 0 })
          Matter.Body.setAngularVelocity(ball, 0)
        })
      }, delay)
      timeoutsRef.current.push(timeout)
    }

    const handlePocketCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      event.pairs.forEach(({ bodyA, bodyB }) => {
        const pocket = [bodyA, bodyB].find((body) => body.label.startsWith('pocket:'))
        const ball = [bodyA, bodyB].find((body) => body.label.startsWith('ball:'))

        if (!pocket || !ball) return

        Matter.Composite.remove(engine.world, ball)
        Matter.Body.setVelocity(ball, { x: 0, y: 0 })
        setHintHidden(true)

        const remainingBalls = ballsRef.current.filter((candidate) =>
          Matter.Composite.allBodies(engine.world).includes(candidate),
        )

        if (remainingBalls.length === 0) {
          setCelebrating(true)
          import('canvas-confetti').then(({ default: confetti }) => {
            confetti({
              particleCount: 80,
              spread: 62,
              origin: { y: 0.62 },
              colors: ['#22C55E', '#FFFFFF', '#C9A46A'],
            })
          })
          respawnAllBalls(2000)
          return
        }

        respawnBall(ball, 1500)
      })
    }

    Matter.Events.on(engine, 'collisionStart', handlePocketCollision)

    const breakShotTimeout = setTimeout(() => {
      const cueBall = ballsRef.current.find((ball) => ball.label === 'ball:cue')
      if (cueBall) {
        const angle = (Math.sin(W + H) * 0.22) + 0.04
        Matter.Body.setVelocity(cueBall, { x: 10.2, y: angle * 10.2 })
        Matter.Body.setAngularVelocity(cueBall, 0.18)
      }
    }, 420)
    timeoutsRef.current.push(breakShotTimeout)

    const dragState: {
      ball: Matter.Body | null
      start: Matter.Vector | null
      current: Matter.Vector | null
    } = { ball: null, start: null, current: null }

    const canvasPoint = (event: PointerEvent): Matter.Vector => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) / rect.width) * W,
        y: ((event.clientY - rect.top) / rect.height) * H,
      }
    }

    const findNearestBall = (point: Matter.Vector) => {
      const liveBalls = ballsRef.current.filter((ball) =>
        Matter.Composite.allBodies(engine.world).includes(ball),
      )
      return liveBalls.find((ball) => Matter.Vector.magnitude(Matter.Vector.sub(ball.position, point)) <= BALL_RADIUS * 2.4) ?? null
    }

    const handlePointerDown = (event: PointerEvent) => {
      const point = canvasPoint(event)
      const ball = findNearestBall(point)
      if (!ball) return

      setHintHidden(true)
      dragState.ball = ball
      dragState.start = point
      dragState.current = point
      canvas.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const point = canvasPoint(event)
      const hoverBall = dragState.ball ?? findNearestBall(point)
      canvas.style.cursor = hoverBall ? 'grab' : 'default'

      if (!dragState.ball) return
      dragState.current = point
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragState.ball || !dragState.start) return

      const end = canvasPoint(event)
      const vector = Matter.Vector.sub(dragState.start, end)
      const power = Math.min(Matter.Vector.magnitude(vector), 110) * 0.115
      const velocity = Matter.Vector.mult(Matter.Vector.normalise(vector), power)

      if (Number.isFinite(velocity.x) && Number.isFinite(velocity.y)) {
        Matter.Body.setVelocity(dragState.ball, velocity)
      }

      dragState.ball = null
      dragState.start = null
      dragState.current = null
      canvas.releasePointerCapture(event.pointerId)
    }

    const drawAimLine = () => {
      if (!dragState.ball || !dragState.start || !dragState.current) return
      const context = render.context
      context.save()
      context.beginPath()
      context.moveTo(dragState.ball.position.x, dragState.ball.position.y)
      context.lineTo(dragState.current.x, dragState.current.y)
      context.strokeStyle = 'rgba(255,255,255,0.42)'
      context.lineWidth = 2
      context.setLineDash([6, 6])
      context.stroke()
      context.restore()
    }

    Matter.Events.on(render, 'afterRender', drawAimLine)

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)

    const runner = Matter.Runner.create()
    Matter.Render.run(render)
    Matter.Runner.run(runner, engine)

    return () => {
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      Matter.Events.off(render, 'afterRender', drawDetails)
      Matter.Events.off(render, 'afterRender', drawAimLine)
      Matter.Events.off(engine, 'collisionStart', handlePocketCollision)
      Matter.Render.stop(render)
      Matter.Runner.stop(runner)
      Matter.Composite.clear(engine.world, false)
      Matter.Engine.clear(engine)
      render.canvas.removeAttribute('style')
      engineRef.current = null
      ballsRef.current = []
    }
  }, [size])

  return (
    <div ref={containerRef} className="w-full max-w-[500px]">
      <div className="relative overflow-hidden rounded-[22px] border border-[#8B5A2B] bg-[#1A5C2A]">
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          aria-label={canvasLabel}
          className="block w-full touch-none"
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[22px] border border-white/10" />
        <p
          data-cms-key="404.hint"
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[12px] font-medium text-white/50 backdrop-blur-md transition-opacity duration-500"
          style={{ opacity: hintHidden || celebrating ? 0 : 1, transitionTimingFunction: SPRING }}
        >
          {hint}
        </p>
        <p
          data-cms-key="404.completed"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#22C55E]/45 bg-black/55 px-5 py-2 text-[14px] font-bold text-white backdrop-blur-md transition-all duration-500"
          style={{
            opacity: celebrating ? 1 : 0,
            transform: celebrating ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.94)',
            transitionTimingFunction: SPRING,
          }}
        >
          {completedText}
        </p>
      </div>
    </div>
  )
}

function railOptions(label: string): Matter.IChamferableBodyDefinition {
  return {
    isStatic: true,
    label,
    render: { fillStyle: '#8B5A2B' },
  }
}

function createBallSpecs(width: number, height: number): BallSpec[] {
  const rackX = width * 0.65
  const rackY = height / 2
  const gap = BALL_RADIUS * 2.18

  return [
    { label: 'ball:cue', color: '#F7F7F2', x: width * 0.25, y: rackY },
    { label: 'ball:8', color: '#111111', x: rackX, y: rackY },
    { label: 'ball:red', color: '#D92D20', x: rackX + gap, y: rackY - BALL_RADIUS },
    { label: 'ball:yellow', color: '#FACC15', x: rackX + gap, y: rackY + BALL_RADIUS },
    { label: 'ball:green', color: '#16A34A', x: rackX + gap * 2, y: rackY - BALL_RADIUS * 2 },
    { label: 'ball:brown', color: '#7C4A23', x: rackX + gap * 2, y: rackY },
  ]
}

function createBall({ label, color, x, y }: BallSpec) {
  return Matter.Bodies.circle(x, y, BALL_RADIUS, {
    label,
    restitution: 0.85,
    friction: 0.05,
    frictionAir: 0.005,
    render: { fillStyle: color, strokeStyle: 'rgba(255,255,255,0.2)', lineWidth: 1 },
  })
}

function homePositionFor(label: string, width: number, height: number): Matter.Vector {
  const spec = createBallSpecs(width, height).find((ball) => ball.label === label)
  return { x: spec?.x ?? width * 0.25, y: spec?.y ?? height / 2 }
}

function drawFeltTexture(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save()
  context.globalAlpha = 0.12
  context.strokeStyle = '#FFFFFF'
  context.lineWidth = 1

  for (let y = RAIL + 10; y < height - RAIL; y += 18) {
    context.beginPath()
    context.moveTo(RAIL, y)
    context.lineTo(width - RAIL, y + Math.sin(y) * 1.4)
    context.stroke()
  }

  context.globalAlpha = 0.08
  context.strokeStyle = '#062F16'
  for (let x = RAIL + 12; x < width - RAIL; x += 22) {
    context.beginPath()
    context.moveTo(x, RAIL)
    context.lineTo(x + Math.cos(x) * 1.2, height - RAIL)
    context.stroke()
  }

  context.restore()
}

function drawPocketRims(context: CanvasRenderingContext2D, positions: Matter.Vector[]) {
  context.save()
  positions.forEach(({ x, y }) => {
    context.beginPath()
    context.arc(x, y, POCKET_RADIUS + 4, 0, Math.PI * 2)
    context.strokeStyle = 'rgba(0,0,0,0.52)'
    context.lineWidth = 4
    context.stroke()
  })
  context.restore()
}

function drawEightBallLabel(context: CanvasRenderingContext2D, balls: Matter.Body[]) {
  const eightBall = balls.find((ball) => ball.label === 'ball:8')
  if (!eightBall) return

  context.save()
  context.beginPath()
  context.arc(eightBall.position.x, eightBall.position.y, BALL_RADIUS * 0.52, 0, Math.PI * 2)
  context.fillStyle = '#FFFFFF'
  context.fill()
  context.fillStyle = '#111111'
  context.font = '700 8px -apple-system, BlinkMacSystemFont, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('8', eightBall.position.x, eightBall.position.y + 0.2)
  context.restore()
}

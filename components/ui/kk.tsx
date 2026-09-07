"use client"

import { useEffect, useRef } from "react"

const VERTEX = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`
const FRAGMENT = `precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;float n(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 p=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);p+=m*.12;float v=0.;for(int i=0;i<5;i++){v+=sin(length(p)*3.-t*.35+float(i)*1.7)*.2;p=mat2(.8,-.6,.6,.8)*p*1.35;}vec3 c=mix(vec3(.082,.09,.106),vec3(.102,.616,.361),clamp(v+.5,0.,1.));c=mix(c,vec3(.133,.722,.42),smoothstep(.25,.9,fract(v+t*.02)));c=mix(c,vec3(.627,.961,.753),smoothstep(.72,.98,fract(v+t*.02)));c+=n(gl_FragCoord.xy+t)*.025;gl_FragColor=vec4(clamp(c,0.,1.),1.);}`

export function ShaderBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", { antialias: false })
    if (!canvas || !gl) return
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null }
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program)
    gl.deleteShader(vertex); gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return }
    gl.useProgram(program)
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, "p"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const resolution = gl.getUniformLocation(program, "r"), time = gl.getUniformLocation(program, "t"), mouse = gl.getUniformLocation(program, "m")
    let raf = 0, x = 0, y = 0
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr)); canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr)); gl.viewport(0, 0, canvas.width, canvas.height) }
    const pointer = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); x = ((event.clientX - rect.left) / rect.width) * 2 - 1; y = -(((event.clientY - rect.top) / rect.height) * 2 - 1) }
    const render = (now: number) => { resize(); gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, reduced ? 0 : now / 1000); gl.uniform2f(mouse, x, y); gl.drawArrays(gl.TRIANGLES, 0, 3); if (!reduced) raf = requestAnimationFrame(render) }
    window.addEventListener("resize", resize); window.addEventListener("pointermove", pointer, { passive: true }); raf = requestAnimationFrame(render)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", pointer); gl.deleteBuffer(buffer); gl.deleteProgram(program) }
  }, [])
  return <canvas ref={canvasRef} className={className} style={{ display: "block", width: "100%", height: "100%" }} aria-hidden="true" />
}

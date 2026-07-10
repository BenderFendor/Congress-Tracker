"use client"

import { useEffect, useRef } from "react"

export function CivicObservatory() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !window.WebGLRenderingContext) return

    let disposed = false
    let frame = 0
    let cleanup = () => {}

    void import("three").then((THREE) => {
      if (disposed || !mount) return

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
      renderer.setClearColor(0x000000, 0)
      mount.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
      camera.position.set(0, 0.7, 7.5)
      const civic = new THREE.Group()
      scene.add(civic)

      const coral = new THREE.MeshBasicMaterial({ color: 0xf36b61, wireframe: true, transparent: true, opacity: 0.62 })
      const blue = new THREE.LineBasicMaterial({ color: 0x5b82e5, transparent: true, opacity: 0.28 })
      const pale = new THREE.MeshBasicMaterial({ color: 0xf7f0e6, wireframe: true, transparent: true, opacity: 0.2 })

      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), coral)
      dome.scale.y = 0.72
      dome.position.y = 0.15
      civic.add(dome)

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.55, 0.42, 32, 3, true), pale)
      drum.position.y = -0.62
      civic.add(drum)

      const columnGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8)
      for (let index = 0; index < 9; index += 1) {
        const column = new THREE.Mesh(columnGeometry, pale)
        column.position.set((index - 4) * 0.29, -1.42, 0)
        civic.add(column)
      }

      const base = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 0.8), coral)
      base.position.y = -2.07
      civic.add(base)

      const rings = [2.15, 2.7, 3.25].map((radius, index) => {
        const points = Array.from({ length: 97 }, (_, point) => {
          const angle = (point / 96) * Math.PI * 2
          return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.45, 0)
        })
        const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), blue)
        ring.rotation.x = index * 0.28
        ring.rotation.y = index * 0.48
        scene.add(ring)
        return ring
      })

      const particlePositions = new Float32Array(240 * 3)
      for (let index = 0; index < particlePositions.length; index += 3) {
        const radius = 2.2 + Math.random() * 2.4
        const angle = Math.random() * Math.PI * 2
        particlePositions[index] = Math.cos(angle) * radius
        particlePositions[index + 1] = (Math.random() - 0.5) * 4.2
        particlePositions[index + 2] = Math.sin(angle) * radius * 0.45
      }
      const particleGeometry = new THREE.BufferGeometry()
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3))
      const particleMaterial = new THREE.PointsMaterial({ color: 0xf36b61, size: 0.025, transparent: true, opacity: 0.55 })
      const particles = new THREE.Points(particleGeometry, particleMaterial)
      scene.add(particles)

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const pointer = { x: 0, y: 0 }
      const onPointerMove = (event: PointerEvent) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.42
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.24
      }
      let scrollDepth = 0
      const onScroll = () => { scrollDepth = Math.min(window.scrollY / 900, 1) }
      const resize = () => {
        const width = Math.max(mount.clientWidth, 1)
        const height = Math.max(mount.clientHeight, 1)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      const observer = new ResizeObserver(resize)
      observer.observe(mount)
      window.addEventListener("pointermove", onPointerMove, { passive: true })
      window.addEventListener("scroll", onScroll, { passive: true })
      resize()

      const render = (time = 0) => {
        if (!reducedMotion) {
          civic.rotation.y += (pointer.x - civic.rotation.y) * 0.035
          civic.rotation.x += (-pointer.y - civic.rotation.x) * 0.035
          civic.position.y = Math.sin(time * 0.00055) * 0.08
          civic.rotation.z = scrollDepth * -0.08
          camera.position.z = 7.5 + scrollDepth * 1.5
          rings.forEach((ring, index) => { ring.rotation.z = time * 0.00006 * (index % 2 ? -1 : 1) })
          particles.rotation.y = time * 0.000025
        }
        renderer.render(scene, camera)
        if (!reducedMotion) frame = requestAnimationFrame(render)
      }
      render()

      cleanup = () => {
        cancelAnimationFrame(frame)
        observer.disconnect()
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("scroll", onScroll)
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) object.geometry.dispose()
        })
        coral.dispose()
        blue.dispose()
        pale.dispose()
        particleGeometry.dispose()
        particleMaterial.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    }).catch(() => {
      mount.dataset.webgl = "unavailable"
    })

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return (
    <div className="civic-observatory" aria-hidden="true">
      <div ref={mountRef} className="civic-observatory-canvas" />
      <svg className="civic-observatory-fallback" viewBox="0 0 420 360" fill="none">
        <path d="M123 179a87 87 0 0 1 174 0M112 195h196M135 219h150M150 219v77m30-77v77m30-77v77m30-77v77m30-77v77M122 298h176" />
        <ellipse cx="210" cy="185" rx="168" ry="72" />
      </svg>
      <div className="civic-observatory-label">Live civic record map</div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

// Immersive 3D gallery. The page scrolls normally (no scroll hijack): a tall section holds a
// sticky canvas, and scroll progress flies the camera through a corridor of framed artworks.
export default function Gallery3D({ projects, t }) {
  const wrap = useRef(null), mount = useRef(null)
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState(false)
  const N = projects.length
  const STEP = 8
  const D = typeof window !== 'undefined' && window.innerWidth < 768 ? 6.5 : 8

  useEffect(() => {
    const el = mount.current
    let disposed = false, raf = 0, cleanup = () => {}
    ;(async () => {
      const THREE = await import('three')
      if (disposed) return
      const small = window.innerWidth < 768
      let renderer
      try { renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' }) } catch { return }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.25 : 1.75))
      renderer.setClearColor(0x0d0f14)
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.touchAction = 'pan-y'
      el.appendChild(renderer.domElement)
      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x0d0f14, 0.045)
      const camera = new THREE.PerspectiveCamera(small ? 62 : 50, 1, 0.1, 120)

      // floor grid + floating dust for depth
      const grid = new THREE.GridHelper(120, 60, 0x2a3040, 0x1a1f2b); grid.position.y = -2.4; scene.add(grid)
      const count = small ? 250 : 700
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - .5) * 16; pos[i * 3 + 1] = Math.random() * 7 - 2.4; pos[i * 3 + 2] = 6 - Math.random() * (N * STEP + 20) }
      const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
        new THREE.PointsMaterial({ color: 0xf5b400, size: small ? 0.05 : 0.035, transparent: true, opacity: 0.55 }))
      scene.add(dust)

      const loader = new THREE.TextureLoader()
      const frames = projects.map((p, i) => {
        const g = new THREE.Group()
        const tex = loader.load('./img/' + p.img); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
        const w = 4.2, h = w * 632 / 808
        const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + .24, h + .24), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.accent), transparent: true }))
        edge.position.z = -.02
        g.add(edge, art)
        const side = i % 2 ? 1 : -1
        g.position.set(0, 0, -i * STEP - 6)
        g.rotation.y = -side * (small ? .08 : .3)
        g.userData = { i, art, edge, base: 0, side }
        art.userData.i = i
        scene.add(g)
        return g
      })

      const CAM_Y = 0.6
      const layout = () => {
        // keep every work fully inside the screen at its resting position, clear of the header and caption
        const hh = D * Math.tan((camera.fov * Math.PI) / 360), hw = hh * camera.aspect
        const fw = small ? Math.min(0.72 * 2 * hw, 3.4) : Math.min(2.8, 0.34 * 2 * hw)
        const sc = fw / 4.2
        const ndcY = small ? 0.12 : 0.04
        const off = small ? 0 : Math.max(0, Math.min(3.4, hw * 0.84 - fw / 2 - 0.3))
        frames.forEach((f) => { f.scale.setScalar(sc); f.position.x = f.userData.side * off; f.userData.base = CAM_Y + ndcY * hh })
      }
      const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); layout() }
      resize()
      const ro = new ResizeObserver(resize); ro.observe(el)

      const pointer = { x: 0, y: 0 }
      const onMove = (e) => { pointer.x = e.clientX / window.innerWidth - .5; pointer.y = e.clientY / window.innerHeight - .5 }
      window.addEventListener('pointermove', onMove)

      const ray = new THREE.Raycaster(), v2 = new THREE.Vector2()
      const scrollToIndex = (i) => {
        const r = wrap.current.getBoundingClientRect(); const top = window.scrollY + r.top
        const range = wrap.current.offsetHeight - window.innerHeight
        window.scrollTo({ top: top + range * ((i + .5) / N), behavior: 'smooth' })
      }
      const onClick = (e) => {
        const b = renderer.domElement.getBoundingClientRect()
        v2.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1)
        ray.setFromCamera(v2, camera)
        const hit = ray.intersectObjects(frames.map((f) => f.userData.art))[0]
        if (hit) scrollToIndex(hit.object.userData.i)
      }
      renderer.domElement.addEventListener('click', onClick)
      window.__gallerySeek = scrollToIndex
      window.__galleryProbe = (i) => { // NDC corners of work i from a camera resting on it
        const f = frames[i], c = camera.clone(); c.position.set(0, CAM_Y, f.position.z + D); c.lookAt(0, CAM_Y, f.position.z); c.updateMatrixWorld(); c.updateProjectionMatrix()
        const w2 = 2.1 + .12, h2 = (4.2 * 632 / 808) / 2 + .12
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const v = new THREE.Vector3(a * w2, b * h2, 0).applyMatrix4(new THREE.Matrix4().compose(f.position, f.quaternion, f.scale)); v.project(c); return [+v.x.toFixed(2), +v.y.toFixed(2)] })
      }

      let visible = true
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }); io.observe(wrap.current)
      let prog = 0, last = performance.now(), lastActive = -1, t = 0
      const loop = (now) => {
        raf = requestAnimationFrame(loop)
        const dt = Math.min((now - last) / 1000, .1); last = now
        if (!visible || document.hidden) return
        t += dt
        const r = wrap.current.getBoundingClientRect()
        const range = wrap.current.offsetHeight - window.innerHeight
        const target = Math.min(Math.max(-r.top / range, 0), 1)
        prog += (target - prog) * (1 - Math.exp(-dt * 5))
        // dwell on each work, fly between them: ease within the middle half of each segment
        const u = prog * (N - 1), seg = Math.min(Math.floor(u), N - 2), fr = Math.min(1, Math.max(0, (u - seg - .25) / .5))
        const pos = seg + fr * fr * (3 - 2 * fr)
        const z = (D - 6) - pos * STEP
        camera.position.set(Math.sin(pos * 3) * (small ? .1 : .5) + pointer.x * (small ? .2 : 1.0), 0.6 - pointer.y * .6 + Math.sin(t * .7) * .05, z)
        camera.lookAt(camera.position.x, CAM_Y - (small ? 0 : pointer.y * .35), z - 8)
        dust.rotation.y = t * .01
        frames.forEach((f, i) => {
          f.position.y = f.userData.base + Math.sin(t * .8 + i) * .12
          // fade a frame out as the camera flies past it, so nothing clips or fills the screen
          const dz = z - f.position.z
          const o = Math.min(1, Math.max(0, (dz - (D - 2.6)) / 1.4))
          f.userData.art.material.opacity = o; f.userData.edge.material.opacity = o; f.visible = o > 0.01
        })
        const idx = Math.min(N - 1, Math.max(0, Math.round(prog * (N - 1))))
        if (idx !== lastActive) { lastActive = idx; setActive(idx) }
        renderer.render(scene, camera)
      }
      raf = requestAnimationFrame(loop)
      setReady(true)
      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
        window.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('click', onClick)
        scene.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose() } })
        renderer.dispose(); renderer.domElement.remove()
      }
    })()
    return () => { disposed = true; cleanup() }
  }, [projects, N])

  const p = projects[active]
  return (
    <section ref={wrap} id="work" aria-label={t.galleryLabel} style={{ height: `${(N + 1) * 100}vh` }} className="relative">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div ref={mount} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-24 md:px-12">
          <p className="text-xs uppercase tracking-[.25em] text-zinc-400">{t.role}</p>
          <h1 className="mt-2 text-[clamp(1.6rem,4vw,3rem)] font-extrabold leading-none">{t.name}</h1>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-6 md:flex-row md:items-end md:justify-between md:p-12">
          <div key={p.id} className="gallery-caption">
            <span dir="ltr" className="inline-block font-extrabold" style={{ color: p.accent }}>0{active + 1} / 0{N}</span>
            <h2 className="text-3xl font-bold md:text-5xl">{t.projects[p.id][0]}</h2>
            <p className="text-zinc-300">{t.projects[p.id][1]}</p>
            <a className="pointer-events-auto font-bold" style={{ color: p.accent }} href={'https://www.behance.net/gallery/' + p.id}>{t.behance}</a>
          </div>
          <div className="pointer-events-auto flex gap-2" role="group" aria-label={t.jump}>
            {projects.map((q, i) => (
              <button key={q.id} aria-label={t.goTo + ' ' + t.projects[q.id][0]} aria-current={i === active} onClick={() => window.__gallerySeek?.(i)}
                className="h-2.5 rounded-full transition-all" style={{ width: i === active ? 34 : 10, background: i === active ? p.accent : '#475066' }} />
            ))}
          </div>
        </div>
        {!ready && <p className="absolute inset-0 z-10 grid place-items-center text-zinc-400">{t.loading}</p>}
        <p className="pointer-events-none absolute end-6 top-24 z-10 hidden text-xs text-zinc-500 md:block">{t.hint}</p>
      </div>
    </section>
  )
}

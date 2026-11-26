import { useEffect, useRef, useState } from 'react'
import { SOCIALS } from './Socials.jsx'

// Drivable 3D portfolio. A small car, driven with keyboard or on-screen buttons, visits one station per work.
// The page keeps scrolling normally: keys are only captured while the game area has focus (click it, or press the
// Drive button). Every station is also reachable without driving through the numbered buttons.
const R = 14, NEAR = 5, EDGE = 120
// Stations are scattered across a big open world, no route. Beams are visible from far away; sparks hide small facts.
const STATIONS = [[26, 22], [-38, 26], [58, -18], [-52, -40], [10, -72], [-8, 84]]
const SPARKS = [[-14, 38], [40, -40], [-70, 6], [70, 30], [-30, -70], [22, 60]]
const SOCIALS_URLS = SOCIALS.map((l) => l.url)
const SOC_COL = { behance: '#1769ff', tiktok: '#25f4ee', instagram: '#e1306c', facebook: '#1877f2' }
const SOC_SPOTS = { behance: [[34, -32], [30, -26], [38, -34]], tiktok: [[-30, -6], [-28, -12], [-34, -2]], instagram: [[44, 10], [48, 6], [40, 12]], facebook: [[-20, 20], [-24, 16], [-16, 24]] }
const stationPos = (i) => STATIONS[i % STATIONS.length]

export default function Drive3D({ projects, t, game = false, onExit, preview = false }) {
  const wrap = useRef(null), mount = useRef(null)
  const keys = useRef({ l: false, r: false, up: false, dn: false, run: false, jump: false })
  const footRef = useRef(false)
  const [foot, setFootState] = useState(false)
  const api = useRef({})
  const [near, setNear] = useState(-1)
  const [open, setOpen] = useState(-1)
  const [engaged, setEngaged] = useState(false)
  const [ready, setReady] = useState(false)
  const [visited, setVisited] = useState([])
  const [found, setFound] = useState([])
  const [toast, setToast] = useState('')
  const [onb, setOnb] = useState(() => { try { return !localStorage.getItem('drive-seen') } catch { return true } })
  const [panel, setPanel] = useState(false)
  const [mode, setModeState] = useState(() => { try { const m = localStorage.getItem('drive-mode'); if (m === 'day' || m === 'night') return m; return 'day' } catch { return 'day' } })
  const modeRef = useRef(mode); modeRef.current = mode
  const [knocked, setKnocked] = useState(false)
  const [snd, setSnd] = useState(() => { try { return localStorage.getItem('drive-sound') !== 'off' } catch { return true } })
  const [immersive, setImmersive] = useState(false)
  const [socNear, setSocNear] = useState(-1)
  const socNearRef = useRef(-1)
  const onbRef = useRef(onb); onbRef.current = onb
  const foundRef = useRef([]); foundRef.current = found
  const N = projects.length
  const openRef = useRef(-1); openRef.current = open
  const nearRef = useRef(-1)

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
      el.appendChild(renderer.domElement)
      const scene = new THREE.Scene()
      const toonGrad = (() => { const d = new Uint8Array([70, 120, 175, 220, 255]); const t = new THREE.DataTexture(d, 5, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t })()
      const Toon = (o) => { const { roughness, metalness, clearcoat, clearcoatRoughness, flatShading, ...r } = o; return new THREE.MeshToonMaterial({ ...r, gradientMap: toonGrad }) }
      const INK = 0x3a2318
      const outline = (mesh, sx, sy, sz) => { const m = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); m.scale.set(sx, sy || sx, sz || sx); mesh.add(m); return m }
      const MODES = {
        night: { top: 0x070f26, mid: 0x14264d, low: 0x4a2a52, fog: 0x1b1a36, fn: 45, ff: 150, hemiS: 0x8fa0ff, hemiG: 0x1a1a2a, hemiI: .9, sunC: 0x9fb4ff, sunI: 1.0, ground: 0x1f2233, tree: 0x1f5a4a, lamp: 0xffe4a8, beam: .2, disc: 0xcfd8ff, road: 0x2c303f, cloud: 0, stars: 1, win: 1, glow: .16, cone: .09, water: 0x2b4a7a, wo: .85, wsplash: 0xbfd8ff, dust: 0x6c6c88, gridO: 1 },
        day: { top: 0x8fd0e6, mid: 0xcdeaf0, low: 0xf1f2ec, fog: 0xeaeee9, fn: 70, ff: 210, hemiS: 0xf4f6f4, hemiG: 0x9a9484, hemiI: 1.9, sunC: 0xfff7ea, sunI: 2.4, ground: 0xe6d7bb, tree: 0x3f9a6a, lamp: 0x8c93a3, beam: .36, disc: 0xfff3c4, road: 0xb98255, cloud: .9, stars: 0, win: 0, glow: 0, cone: 0, water: 0x6cc5d6, wo: .78, wsplash: 0xffffff, dust: 0xcdb89a, gridO: .06 },
      }
      scene.fog = new THREE.Fog(0x1b1a36, 45, 150)
      const camera = new THREE.PerspectiveCamera(small ? 66 : 55, 1, 0.1, 320)
      const hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a2030, 1.0); scene.add(hemi)
      const sun = new THREE.DirectionalLight(0xffc89a, 1.5); const SUNDIR = new THREE.Vector3(.3, .3, .9).normalize(); sun.position.copy(SUNDIR).multiplyScalar(40); scene.add(sun)
      const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() }, sunDir: { value: SUNDIR }, discC: { value: new THREE.Color() } }
      const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 24, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
        vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform vec3 discC; varying vec3 p; void main(){ vec3 n = normalize(p); float h = clamp(n.y, 0.0, 1.0); vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.12, 0.7, h)); float d = max(dot(n, sunDir), 0.0); c += discC * (pow(d, 60.0) * 0.28 + smoothstep(0.9988, 0.9996, d)); gl_FragColor = vec4(c, 1.0); }',
      }))
      scene.add(sky)
      const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 240 }, () => { const a = Math.random() * 6.28, e = .25 + Math.random() * 1.1; return [Math.cos(a) * Math.cos(e) * 240, Math.sin(e) * 240, Math.sin(a) * Math.cos(e) * 240] }).flat()), 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false, sizeAttenuation: false, transparent: true }))
      scene.add(stars)
      // soft clouds (day only)
      const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t })()
      const clouds = new THREE.Group(); const cloudMats = []
      for (let i = 0; i < (small ? 9 : 16); i++) {
        const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0 }); cloudMats.push(m)
        const sp = new THREE.Sprite(m); const a = (i / 16) * 6.28 + Math.random() * .5, e = .18 + Math.random() * .4
        sp.position.set(Math.sin(a) * Math.cos(e) * 220, Math.sin(e) * 220, Math.cos(a) * Math.cos(e) * 220); sp.scale.set(70 + Math.random() * 60, 22 + Math.random() * 14, 1); clouds.add(sp)
      }
      scene.add(clouds)

      const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64).rotateX(-Math.PI / 2), Toon({ color: 0x1f2233, roughness: 1 }))
      scene.add(ground)
      const grid = new THREE.GridHelper(280, 140, 0x343a52, 0x282c40); grid.position.y = 0.01; scene.add(grid)
      const road = new THREE.Mesh(new THREE.RingGeometry(R - 3.2, R + 3.2, 96).rotateX(-Math.PI / 2), Toon({ color: 0x2c303f, roughness: .9 }))
      road.position.y = 0.02; scene.add(road)
      ;[R - 3.2, R + 3.2].forEach((r, k) => { const e = new THREE.Mesh(new THREE.RingGeometry(r - .1, r + .1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: k ? 0xff4d6d : 0x39d0ff })); e.position.y = .04; scene.add(e) })
      const dashGeo = new THREE.PlaneGeometry(.18, 1.1).rotateX(-Math.PI / 2), dashMat = new THREE.MeshBasicMaterial({ color: 0xf5b400 })
      for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; const d = new THREE.Mesh(dashGeo, dashMat); d.position.set(Math.sin(a) * R, .035, Math.cos(a) * R); d.rotation.y = a + Math.PI / 2; scene.add(d) }

      // plaza lamps, then a city and forest scattered around the whole world; nothing is placed on a station or the plaza
      const lampGlows = [], lampList = []
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe4a8 }), poleMat = Toon({ color: 0x4a5068 })
      for (let i = 0; i < 12; i++) {
        const a = ((i + .5) / 12) * Math.PI * 2, r = R + 4.6
        const g = new THREE.Group(); g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 3.2, 6), poleMat); pole.position.y = 1.6; g.add(pole)
        const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), lampMat); head.position.y = 3.3; g.add(head)
        const lg = new THREE.Mesh(new THREE.CircleGeometry(3, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending })); lg.position.y = .06; g.add(lg); lampGlows.push(lg.material)
        scene.add(g); lampList.push({ g, x: g.position.x, z: g.position.z })
      }
      let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
      const clear = (x, z, m) => Math.hypot(x, z) > R + 9 && STATIONS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > m) && SPARKS.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > Math.min(m, 9))
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a })
      const colliders = []
      lampList.forEach((l) => { l.col = [l.x, l.z, .3, l]; colliders.push(l.col) })
      const bMats = []
      const facade = (() => {
        const c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = c.height = e.width = e.height = 128
        const x = c.getContext('2d'), y = e.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); y.fillStyle = '#000'; y.fillRect(0, 0, 128, 128)
        for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
          const px = q * 32 + 8, py = r * 32 + 8, lit = Math.random() < .55
          x.fillStyle = lit ? '#9db4d8' : '#5a6a88'; x.fillRect(px, py, 16, 18)
          if (lit) { y.fillStyle = Math.random() < .75 ? '#ffd98a' : '#9fd0ff'; y.fillRect(px, py, 16, 18) }
        }
        const a = new THREE.CanvasTexture(c), b = new THREE.CanvasTexture(e)
        ;[a, b].forEach((t0) => { t0.wrapS = t0.wrapT = THREE.RepeatWrapping; t0.colorSpace = THREE.SRGBColorSpace; t0.anisotropy = 4 })
        return { a, b }
      })()
      const nB = small ? 60 : 110
      for (let i = 0, n = 0; n < nB && i < 2000; i++) {
        const a = rnd() * Math.PI * 2, r = 24 + rnd() * 100, x = Math.sin(a) * r, z = Math.cos(a) * r
        if (!clear(x, z, 34)) continue; n++
        const w = 2.5 + rnd() * 4, h = 4 + rnd() * 18
        colliders.push([x, z, w * .78 + .4])
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rnd() * 3
        const hue = .6 + rnd() * .15, l0 = .13 + rnd() * .07
        for (let k = 0; k < (small ? 2 : 4); k++) { rnd(); rnd() }
        const bg = new THREE.BoxGeometry(w, h, w), uv = bg.attributes.uv
        for (let q = 0; q < uv.count; q++) { if (q >= 8 && q < 16) uv.setXY(q, .02, .02); else uv.setXY(q, uv.getX(q) * w / 4, uv.getY(q) * h / 4) }
        const bm = Toon({ color: new THREE.Color().setHSL(hue, .3, l0), roughness: .85, map: facade.a, emissive: 0xffffff, emissiveMap: facade.b, emissiveIntensity: 1 })
        bMats.push({ m: bm, hue, l0, col: new THREE.Color([0xd9533f, 0x1e8a90, 0xf1d9a5, 0xe9a043, 0xb9774a][n % 5]) })
        const bld = new THREE.Mesh(bg, bm); bld.position.y = h / 2; g.add(bld); outline(bld, 1 + .22 / w, 1 + .22 / h, 1 + .22 / w)
        if (h > 14) { const an = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 3, 5), poleMat); an.position.y = h + 1.5; g.add(an); const tip = new THREE.Mesh(new THREE.SphereGeometry(.13, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); tip.position.y = h + 3; g.add(tip) }
        scene.add(g)
      }
      const nT = small ? 90 : 190
      const treeMat = Toon({ color: 0x1f5a4a, roughness: 1, flatShading: true })
      const treeMat2 = Toon({ color: 0x2a7a5c, roughness: 1, flatShading: true })
      const trunkMat = Toon({ color: 0x5a3f2a, roughness: 1 })
      const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.05, 2.0, 7), treeMat, nT)
      const trees2 = new THREE.InstancedMesh(new THREE.ConeGeometry(.72, 1.7, 7), treeMat2, nT)
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.13, .18, 1.0, 6), trunkMat, nT)
      const dum = new THREE.Object3D()
      const setT = (mesh, n, x, y, z, sc) => { dum.position.set(x, y, z); dum.scale.setScalar(sc); dum.updateMatrix(); mesh.setMatrixAt(n, dum.matrix) }
      for (let i = 0, n = 0; n < nT && i < 4000; i++) {
        const a = rnd() * Math.PI * 2, r = 12 + rnd() * 108, x = Math.sin(a) * r, z = Math.cos(a) * r
        if (!clear(x, z, 28)) continue
        const sc = .7 + rnd() * 1.1; colliders.push([x, z, .5 * sc + .3])
        setT(trees, n, x, 1.7 * sc, z, sc); setT(trees2, n, x, 2.75 * sc, z, sc); setT(trunks, n, x, .5 * sc, z, sc); n++
      }
      scene.add(trees, trees2, trunks)
      // ---- reactive effects: stylized (not full physics) water splash, dust, bump shake, knock-over crates ----
      const fx = { splash: 0, dust: 0, bumps: 0, knocks: 0, ripples: 0 }
      window.__driveFx = fx
      const pools = []
      const mkPool = (n, size) => {
        const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), al = new Float32Array(n), sz = new Float32Array(n).fill(1)
        for (let i = 0; i < n; i++) pos[i * 3 + 1] = -100
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('a', new THREE.BufferAttribute(al, 1)); geo.setAttribute('s', new THREE.BufferAttribute(sz, 1))
        const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uSize: { value: size }, uH: { value: 600 }, uColor: { value: new THREE.Color() } },
          vertexShader: 'attribute float a; attribute float s; varying float vA; uniform float uSize; uniform float uH; void main(){ vA = a; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * s * projectionMatrix[1][1] * uH * 0.5 / max(-mv.z, 0.1); }',
          fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float al = smoothstep(1.0, 0.25, d) * vA; if (al < 0.01) discard; gl_FragColor = vec4(uColor, al); }' })
        const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
        const vel = new Float32Array(n * 3), life = new Float32Array(n), maxL = new Float32Array(n).fill(1), s0 = new Float32Array(n).fill(1)
        let head = 0
        const pool = { mat, emit(x, y, z, vx, vy, vz, l, sc = 1) { const i = head; head = (head + 1) % n; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = l; maxL[i] = l; s0[i] = sc },
          step(dt, g, grow, maxA) {
            for (let i = 0; i < n; i++) {
              if (life[i] <= 0) continue
              life[i] -= dt
              if (life[i] <= 0) { pos[i * 3 + 1] = -100; al[i] = 0; continue }
              pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; vel[i * 3 + 1] -= g * dt
              if (pos[i * 3 + 1] < .05 && vel[i * 3 + 1] < 0) { pos[i * 3 + 1] = .05; vel[i * 3 + 1] = 0; vel[i * 3] *= .4; vel[i * 3 + 2] *= .4 }
              const f = life[i] / maxL[i]; al[i] = Math.min(1, f * 1.6) * maxA; sz[i] = s0[i] * (1 + (1 - f) * grow)
            }
            geo.attributes.position.needsUpdate = true; geo.attributes.a.needsUpdate = true; geo.attributes.s.needsUpdate = true
          } }
        pools.push(pool); return pool
      }
      const waterP = mkPool(small ? 110 : 190, .16), dustP = mkPool(small ? 70 : 120, .55)
      // puddles
      const puddles = []
      const pudMat = new THREE.MeshBasicMaterial({ color: 0x2b4a7a, transparent: true, opacity: .85, depthWrite: false })
      const sheenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18, depthWrite: false })
      const freeSpot = (x, z, rr) => colliders.every((c) => Math.hypot(x - c[0], z - c[1]) > c[2] + rr + 1.5)
      const pudSpots = [[-4, 26, 3.6], [22, 6, 3.2], [38, 38, 4.2], [-24, -10, 3.4], [4, -40, 4], [-52, 10, 4.4], [60, -2, 3.6], [-20, 60, 3.8], [34, -56, 4], [-8, 50, 3]]
      pudSpots.slice(0, small ? 7 : 10).forEach(([x, z, r]) => {
        if (!freeSpot(x, z, r)) return
        const e = .7 + rnd() * .3
        const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), pudMat); m.scale.set(r, 1, r * e); m.position.set(x, .03, z); scene.add(m)
        const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), sheenMat); sh.scale.set(r * .55, 1, r * e * .4); sh.position.set(x - r * .15, .035, z - r * e * .1); scene.add(sh)
        puddles.push({ x, z, r, e })
      })
      const ripples = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.position.y = .045; m.visible = false; scene.add(m); return { m, age: 9 } })
      let ripHead = 0
      const ripple = (x, z) => { const r = ripples[ripHead]; ripHead = (ripHead + 1) % ripples.length; r.age = 0; r.m.position.x = x; r.m.position.z = z; r.m.visible = true; fx.ripples++ }
      // knock-over crates: stylized impulse, tipping and hop (not a rigid-body engine)
      const crateTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#c4915a'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#a9773f'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 29, 128, 4); x.strokeStyle = '#7a5128'; x.lineWidth = 10; x.strokeRect(5, 5, 118, 118); x.beginPath(); x.moveTo(8, 8); x.lineTo(120, 120); x.moveTo(120, 8); x.lineTo(8, 120); x.lineWidth = 6; x.stroke(); const t0 = new THREE.CanvasTexture(c); t0.colorSpace = THREE.SRGBColorSpace; return t0 })()
      const tints = [0xffffff, 0xffe0bd, 0xcfe6ff, 0xffcad6, 0xdcf5c8]
      const crateGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3).translate(0, .65, 0)
      const crateSpots = [[12, 24], [10.2, 24], [13.8, 24], [11.1, 25.6], [12.9, 25.6], [12, 27.2], [-24, -12], [34, -8], [-14, -34], [30, 52], [-48, 52], [52, -52], [-22, 70], [-60, -10]]
      const crates = []
      crateSpots.slice(0, small ? 10 : 14).forEach(([x, z], i) => {
        if (i >= 6 && !freeSpot(x, z, 1.5)) return
        const g = new THREE.Group(), inner = new THREE.Mesh(crateGeo, Toon({ map: crateTex, color: tints[i % 5], roughness: .9 })); g.add(inner); g.position.set(x, 0, z); scene.add(g)
        crates.push({ g, inner, hx: x, hz: z, x, z, vx: 0, vz: 0, y: 0, vy: 0, tilt: 0, tv: 0, rot: 0, spin: 0, gy: 0 })
      })
      // ---- shatter pieces (stylized, not rigid-body) + synthesized engine / impact sounds (no music) ----
      const shardGeo = new THREE.BoxGeometry(.2, .2, .07)
      const shards = Array.from({ length: small ? 24 : 40 }, () => { const m = new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); m.visible = false; scene.add(m); return { m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, life: 0 } })
      let shardHead = 0
      const burst = (x, y, z, color, n, power) => {
        fx.shatters = (fx.shatters || 0) + 1
        for (let q = 0; q < n; q++) {
          const s = shards[shardHead]; shardHead = (shardHead + 1) % shards.length
          s.m.material.color.set(color); s.m.position.set(x + (Math.random() - .5) * .6, y + Math.random() * .6, z + (Math.random() - .5) * .6)
          s.m.scale.setScalar(.6 + Math.random() * 1.1)
          const a = Math.random() * 6.283, sp = (1.5 + Math.random() * 3.5) * power
          s.vx = Math.cos(a) * sp + Math.sin(st.h) * st.v * .35; s.vz = Math.sin(a) * sp + Math.cos(st.h) * st.v * .35; s.vy = 2.5 + Math.random() * 4 * power
          s.rx = (Math.random() - .5) * 14; s.ry = (Math.random() - .5) * 14; s.rz = (Math.random() - .5) * 14; s.life = 1.6 + Math.random() * .6; s.m.visible = true
        }
      }
      const stepShards = (dt) => shards.forEach((s) => {
        if (!s.m.visible) return
        s.life -= dt; if (s.life <= 0) { s.m.visible = false; return }
        s.vy -= 16 * dt; s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt
        if (s.m.position.y < .08) { s.m.position.y = .08; s.vy = Math.abs(s.vy) * .3; s.vx *= .7; s.vz *= .7; s.rx *= .6; s.ry *= .6; s.rz *= .6 }
        s.m.rotation.x += s.rx * dt; s.m.rotation.y += s.ry * dt; s.m.rotation.z += s.rz * dt
        if (s.life < .4) s.m.scale.multiplyScalar(1 - dt * 2.2)
      })
      const audio = (() => {
        let ctx = null, osc, osc2, gain, filt, master, nbuf, muted = false
        try { muted = localStorage.getItem('drive-sound') === 'off' } catch {}
        const init = () => {
          if (ctx) return
          const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
          ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .5; master.connect(ctx.destination)
          filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = .4; gain = ctx.createGain(); gain.gain.value = 0
          osc = ctx.createOscillator(); osc.type = 'triangle'; osc2 = ctx.createOscillator(); osc2.type = 'sine'
          const g2 = ctx.createGain(); g2.gain.value = .5; osc.connect(filt); osc2.connect(g2); g2.connect(filt); filt.connect(gain); gain.connect(master); osc.start(); osc2.start()
          nbuf = ctx.createBuffer(1, ctx.sampleRate * .6, ctx.sampleRate); const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
        }
        const noise = (type, freq, vol, dur) => {
          if (!ctx || muted) return
          const src = ctx.createBufferSource(); src.buffer = nbuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ctx.createGain(); const t = ctx.currentTime
          g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + .05)
        }
        return {
          wake() { init(); if (ctx && ctx.state === 'suspended') ctx.resume() },
          setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : .55, ctx.currentTime, .05) },
          update(v, thr, hush) {
            if (!ctx || muted) return
            if (hush) { gain.gain.setTargetAtTime(0, ctx.currentTime, .2); return }
            // calm steady hum: speed is smoothed heavily, no throttle jumps, soft filter
            this.sm = (this.sm || 0) + (Math.min(1, Math.abs(v) / 14) - (this.sm || 0)) * .06
            const s = this.sm, t = ctx.currentTime, f = 52 + s * 38
            osc.frequency.setTargetAtTime(f, t, .35); osc2.frequency.setTargetAtTime(f * .5, t, .35)
            filt.frequency.setTargetAtTime(190 + s * 260, t, .4); gain.gain.setTargetAtTime(.035 + s * .05, t, .4)
          },
          thud(v) { noise('lowpass', 260, Math.min(.9, .25 + v / 16), .28) },
          crash() { noise('highpass', 2200, .7, .45); noise('bandpass', 900, .5, .3) },
        }
      })()
      const breakLamp = (l) => { l.g.visible = false; l.col[2] = -9; burst(l.x, 1.2, l.z, 0x4a5068, 12, 1); burst(l.x, 3.2, l.z, 0xffe4a8, 6, 1); audio.crash() }
      const breakCrate = (c) => { c.broken = true; c.g.visible = false; burst(c.x, .6, c.z, 0xc4915a, 14, 1.1); burst(c.x, .8, c.z, 0xa9773f, 8, .9); audio.crash() }
      const resetCrates = () => { lampList.forEach((l) => { l.g.visible = true; l.col[2] = .3 }); shards.forEach((s) => { s.m.visible = false })
        crates.forEach((c) => { c.broken = false; c.g.visible = true })
         crates.forEach((c) => { Object.assign(c, { x: c.hx, z: c.hz, vx: 0, vz: 0, y: 0, vy: 0, tilt: 0, tv: 0, rot: 0, spin: 0, gy: 0 }); c.g.position.set(c.hx, 0, c.hz); c.g.rotation.y = 0; c.inner.position.y = 0; c.inner.rotation.set(0, 0, 0) }); setKnocked(false) }
      let knockedFlag = false, shake = 0, bumpCd = 0, splashAcc = 0, dustAcc = 0, ripT = 0

      // social landmarks: big icon boards in the world; approaching one shows an Open button (never opens by itself)
      const socialObjs = SOCIALS.map((l) => {
        const cand = SOC_SPOTS[l.id] || [[0, -30]]; const ext = []; for (const [bx, bz] of cand) for (let r = 0; r <= 16; r += 2) for (let k = 0; k < (r ? 8 : 1); k++) ext.push([bx + Math.cos(k * .785) * r, bz + Math.sin(k * .785) * r])
        const [x, z] = ext.find(([cx, cz]) => Math.hypot(cx, cz) > 14 && freeSpot(cx, cz, 9)) || cand[0]
        const col = new THREE.Color(SOC_COL[l.id] || '#ffffff')
        const c = document.createElement('canvas'); c.width = c.height = 256; const cx2 = c.getContext('2d')
        cx2.fillStyle = '#10131c'; cx2.beginPath(); cx2.arc(128, 128, 124, 0, 7); cx2.fill(); cx2.lineWidth = 10; cx2.strokeStyle = SOC_COL[l.id] || '#fff'; cx2.stroke()
        cx2.translate(128 - 24 * 4.2, 128 - 24 * 4.2); cx2.scale(4.2, 4.2); cx2.fillStyle = '#fff'; cx2.fill(new Path2D(l.d))
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
        const g = new THREE.Group(); g.position.set(x, 0, z)
        const pad = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .8 })); pad.position.y = .05; g.add(pad)
        const post = new THREE.Mesh(new THREE.BoxGeometry(.35, 3, .35), Toon({ color: 0x2b3040 })); post.position.y = 1.5; g.add(post)
        const bd = new THREE.Group(); bd.position.y = 4.6; g.add(bd)
        const face = new THREE.Mesh(new THREE.CircleGeometry(1.9, 40), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); bd.add(face)
        const halo = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.15, 40), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); bd.add(halo)
        const bm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 16, 18, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); bm.position.y = 8; g.add(bm)
        scene.add(g); colliders.push([x, z, .5]); return { bd, x, z, l }
      })

      // sparks: small glowing orbs that reveal a fact about the owner
      const sparkObjs = SPARKS.map(([x, z], k) => {
        const g = new THREE.Group(); g.position.set(x, 0, z)
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 1), new THREE.MeshBasicMaterial({ color: 0xffd23f })); orb.position.y = 1.4; g.add(orb)
        const col = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 14, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
        col.position.y = 7; g.add(col); scene.add(g); return { g, orb, k, on: true }
      })

      // station label sprite
      const label = (text, color) => {
        const c = document.createElement('canvas'); c.width = 768; c.height = 160; const x = c.getContext('2d')
        x.fillStyle = 'rgba(10,12,18,.88)'; x.beginPath(); x.roundRect(4, 4, 760, 152, 28); x.fill(); x.lineWidth = 6; x.strokeStyle = color; x.stroke()
        x.fillStyle = '#fff'; x.font = '700 50px system-ui, "Segoe UI", Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = document.documentElement.dir || 'ltr'
        let tx = text; while (x.measureText(tx).width > 700 && tx.length > 4) tx = tx.slice(0, -2)
        x.fillText(tx === text ? text : tx + '…', 384, 84)
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(4.6, .96, 1); return sp
      }
      const loader = new THREE.TextureLoader()
      const pads = [], boards = [], beamMats = []
      projects.forEach((p, i) => {
        const [x, z] = stationPos(i)
        const g = new THREE.Group(); g.position.set(x, 0, z)
        const col = new THREE.Color(p.accent)
        const pad = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9 }))
        pad.position.y = 0.05; g.add(pad); pads.push(pad)
        const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .16 }))
        disc.position.y = 0.04; g.add(disc)
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 46, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
        beam.position.y = 23; g.add(beam); beamMats.push(beam.material)
        const b = new THREE.Group(); const out = new THREE.Vector3(x, 0, z).normalize()
        b.position.set(out.x * 6, 0, out.z * 6); g.add(b); boards.push({ b, wx: x + out.x * 6, wz: z + out.z * 6 })
        const post = new THREE.Mesh(new THREE.BoxGeometry(.25, 1.9, .25), Toon({ color: 0x3a4152 }))
        post.position.y = .95; b.add(post)
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }))
        edge.position.y = 3.1; b.add(edge)
        const art = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }))
        art.position.set(0, 3.1, .02); b.add(art)
        loader.load('./img/' + p.img, (tx) => {
          tx.colorSpace = THREE.SRGBColorSpace
          const ar = tx.image.width / tx.image.height, mw = 4.2, mh = 3.2
          const sz = ar > mw / mh ? [mw, mw / ar] : [mh * ar, mh]
          art.scale.set(sz[0] / mw, sz[1] / mh, 1); edge.scale.set((sz[0] + .2) / 4.4, (sz[1] + .2) / 3.4, 1)
          art.material.map = tx; art.material.color.set(0xffffff); art.material.needsUpdate = true
        })
        const lb = label(String(i + 1) + '  ' + t.projects[p.id][0], p.accent); lb.position.set(0, 5.4, .05); b.add(lb)
        scene.add(g)
      })

      // optional pass-through gates: one per project, standing in open ground before its board. They carry the project title and react when the car drives through (no route, no lock)
      const gates = []
      projects.forEach((p, i) => {
        const [sx, sz] = stationPos(i); const len = Math.hypot(sx, sz) || 1, ox = sx / len, oz = sz / len, px = -oz, pz = ox
        const gx = sx - ox * 10, gz = sz - oz * 10
        const col = new THREE.Color(p.accent)
        const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = Math.atan2(px, pz)
        const postG = new THREE.BoxGeometry(.5, 4, .5), pm = Toon({ color: col })
        ;[-2.4, 2.4].forEach((o) => { const po = new THREE.Mesh(postG, pm); po.position.set(0, 2, o); g.add(po); outline(po, 1.1, 1.015, 1.1) })
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c2 = cv.getContext('2d')
        c2.fillStyle = '#fff1d6'; c2.beginPath(); c2.roundRect(4, 4, 504, 120, 30); c2.fill(); c2.lineWidth = 8; c2.strokeStyle = '#3a2318'; c2.stroke()
        c2.fillStyle = '#3a2318'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.font = 'bold 44px sans-serif'
        const title = (t.projects[p.id] && t.projects[p.id][0]) || ''; c2.fillText(title.length > 24 ? title.slice(0, 23) + '…' : title, 256, 66, 470)
        const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshBasicMaterial({ map: tx, transparent: true })); ban.position.y = 4.4; ban.rotation.y = Math.PI / 2; g.add(ban)
        const ban2 = new THREE.Mesh(ban.geometry, ban.material); ban2.position.y = 4.4; ban2.rotation.y = -Math.PI / 2; g.add(ban2)
        const ring = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.y = Math.PI / 2; ring.position.y = 2; g.add(ring)
        scene.add(g)
        const axx = Math.cos(g.rotation.y), axz = -Math.sin(g.rotation.y) // direction through the gate
        const latx = Math.sin(g.rotation.y), latz = Math.cos(g.rotation.y) // along the posts (local z)
        colliders.push([gx + latx * 2.4, gz + latz * 2.4, .6], [gx - latx * 2.4, gz - latz * 2.4, .6])
        gates.push({ gx, gz, axx, axz, latx, latz, ring, ban, prev: 0, pulse: 0, i })
      })
      // car: extruded side profile body, glass, rims, spoiler, underglow. Neutral matte material (final look pending the user's answer)
      const car = new THREE.Group()
      const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xb4bbc7, roughness: .4, metalness: .05, clearcoat: .6, clearcoatRoughness: .25 })
      const dark = Toon({ color: 0x0e1016, roughness: .7 })
      const glass = new THREE.MeshStandardMaterial({ color: 0x1f3a66, roughness: .05, metalness: .85 })
      const prof = new THREE.Shape(); // side view: x = length (front +), y = height
      prof.moveTo(-2, .3); prof.lineTo(2, .3); prof.quadraticCurveTo(2.22, .38, 2.16, .62); prof.quadraticCurveTo(2.1, .8, 1.8, .86); prof.lineTo(.8, .98); prof.lineTo(-1.5, .98); prof.quadraticCurveTo(-2.06, .96, -2.1, .78); prof.lineTo(-2.1, .5); prof.quadraticCurveTo(-2.1, .3, -2, .3)
      const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: 1.74, bevelEnabled: true, bevelSize: .13, bevelThickness: .13, bevelSegments: 4 })
      bodyGeo.translate(0, 0, -.87); bodyGeo.rotateY(-Math.PI / 2)
      const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = .12; car.add(body); outline(body, 1.018, 1.025, 1.008)
      const cabS = new THREE.Shape(); cabS.moveTo(.8, .96); cabS.quadraticCurveTo(.55, 1.4, .1, 1.46); cabS.lineTo(-.7, 1.46); cabS.quadraticCurveTo(-1.3, 1.4, -1.6, .96); cabS.lineTo(.8, .96)
      const cabG = new THREE.ExtrudeGeometry(cabS, { depth: 1.5, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }); cabG.translate(0, 0, -.75); cabG.rotateY(-Math.PI / 2)
      const win = new THREE.Mesh(cabG, glass); win.position.y = .12; car.add(win); outline(win, 1.02, 1.02, 1.015)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, .07, .95), bodyMat); roof.position.set(0, 1.6, -.3); car.add(roof)
      const bPil = new THREE.Mesh(new THREE.BoxGeometry(1.6, .52, .1), bodyMat); bPil.position.set(0, 1.36, -.42); car.add(bPil)
      const stripeG = Toon({ color: 0xf2b21c, roughness: .35, metalness: .5 })
      ;[-1, 1].forEach((sx) => { const st1 = new THREE.Mesh(new THREE.BoxGeometry(.03, .05, 3.6), stripeG); st1.position.set(sx * 1.03, .78, 0); car.add(st1) })
      const spoil = new THREE.Mesh(new THREE.BoxGeometry(1.7, .08, .4), dark); spoil.position.set(0, 1.18, -2.02); car.add(spoil)
      ;[-.7, .7].forEach((sx) => { const sp = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .1), dark); sp.position.set(sx, 1.03, -1.97); car.add(sp) })
      const rimMat = Toon({ color: 0xcfd6e6, metalness: .8, roughness: .3 })
      const spokeMat = Toon({ color: 0x20232d, roughness: .5 })
      const wheels = []
      ;[[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].forEach(([sx, sz]) => {
        const w = new THREE.Group(); w.position.set(sx * .96, .45, sz)
        const spin = new THREE.Group(); w.add(spin)
                const lip = new THREE.Mesh(new THREE.TorusGeometry(.3, .03, 6, 20).rotateY(Math.PI / 2), Toon({ color: 0xf2b21c, metalness: .7, roughness: .3 })); lip.position.x = sx * .17; spin.add(lip)
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .34, 20).rotateZ(Math.PI / 2), dark); spin.add(tyre)
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .36, 16).rotateZ(Math.PI / 2), rimMat); spin.add(rim)
        for (let q = 0; q < 5; q++) { const spk = new THREE.Mesh(new THREE.BoxGeometry(.04, .5, .07), spokeMat); spk.position.x = sx * .19; spk.rotation.x = q * Math.PI / 5; spin.add(spk) }
        car.add(w); wheels.push(w)
      })
      const tails = []
      ;[-1, 1].forEach((sx) => { const mir = new THREE.Mesh(new THREE.BoxGeometry(.22, .14, .12), bodyMat); mir.position.set(sx * 1.05, 1.0, .55); car.add(mir); const skirt = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, 2.6), dark); skirt.position.set(sx * .98, .42, 0); car.add(skirt) })
      const bump1 = new THREE.Mesh(new THREE.BoxGeometry(1.7, .14, .1), dark); bump1.position.set(0, .4, 2.3); car.add(bump1)
      const bump2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, .14, .1), dark); bump2.position.set(0, .4, -2.28); car.add(bump2)
      // rear licence plate: Z only (the user's choice)
      const plateTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d')
        x.fillStyle = '#10131c'; x.beginPath(); x.roundRect(0, 0, 512, 256, 34); x.fill()
        const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#f2b400'); x.fillStyle = g; x.beginPath(); x.roundRect(12, 12, 488, 232, 26); x.fill()
        x.fillStyle = '#10131c'; x.beginPath(); x.roundRect(28, 28, 456, 200, 18); x.fill()
        x.save(); x.translate(256, 128); x.scale(3.9, 3.9); x.translate(-32, -32); const zg = x.createLinearGradient(12, 14, 52, 50); zg.addColorStop(0, '#ffe27a'); zg.addColorStop(1, '#f0a500')
        x.fillStyle = zg; x.fill(new Path2D('M12 14H52L46 25H12Z')); x.fill(new Path2D('M18 39H52V50H12Z')); x.fillStyle = '#c98200'; x.fill(new Path2D('M52 14V25L24 50H12V39L40 14Z')); x.fillStyle = '#8a5600'; x.fill(new Path2D('M52 14L46 25H34L40 14Z')); x.fill(new Path2D('M12 50L24 39H18Z')); x.restore()
                const t0 = new THREE.CanvasTexture(c); t0.colorSpace = THREE.SRGBColorSpace; t0.anisotropy = 4; return t0 })()
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(.8, .4), new THREE.MeshBasicMaterial({ map: plateTex })); plate.position.set(0, .66, -2.3); plate.rotation.y = Math.PI; car.add(plate)
      ;[-.62, .62].forEach((sx) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .06), new THREE.MeshBasicMaterial({ color: 0xfff1b0 })); hl.position.set(sx * 1.05, .76, 2.3); car.add(hl)
        const tl = new THREE.Mesh(new THREE.BoxGeometry(.3, .09, .06), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); tl.position.set(sx * 1.1, .8, -2.28); car.add(tl); tails.push(tl.material)
      })
      { const drl = new THREE.Mesh(new THREE.BoxGeometry(.9, .03, .05), new THREE.MeshBasicMaterial({ color: 0xfff1b0 })); drl.position.set(0, .86, 2.3); car.add(drl); const tb = new THREE.Mesh(new THREE.BoxGeometry(1.2, .04, .05), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); tb.position.set(0, .9, -2.28); car.add(tb); tails.push(tb.material) }
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 4.6), new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))
      cone.position.set(0, .8, 2.1); car.add(cone)
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x39d0ff, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }))
      glow.position.y = .06; car.add(glow)
      scene.add(car)
      const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c) })()
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); blob.position.y = .045; car.add(blob)
      // day / night: every value blends between MODES.night (0) and MODES.day (1)
      let modeK = modeRef.current === 'day' ? 1 : 0, modeTo = modeK
      const cA = new THREE.Color(), cB = new THREE.Color()
      const paint = (k) => {
        const M = MODES, N = M.night, D = M.day
        const mc = (key, target, raw) => { const sp = raw ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace; cA.setHex(N[key], sp); cB.setHex(D[key], sp); target.copy(cA).lerp(cB, k) }
        const mn = (key) => N[key] + (D[key] - N[key]) * k
        mc('top', skyU.top.value, true); mc('mid', skyU.mid.value, true); mc('low', skyU.low.value, true); mc('disc', skyU.discC.value, true)
        mc('fog', scene.fog.color); scene.fog.near = mn('fn'); scene.fog.far = mn('ff')
        mc('hemiS', hemi.color); mc('hemiG', hemi.groundColor); hemi.intensity = mn('hemiI'); mc('sunC', sun.color); sun.intensity = mn('sunI')
        mc('ground', ground.material.color); mc('road', road.material.color); grid.material.transparent = true; grid.material.opacity = mn('gridO')
        mc('tree', treeMat.color); treeMat2.color.copy(treeMat.color).multiplyScalar(1.22)
        mc('lamp', lampMat.color); lampGlows.forEach((m) => { m.opacity = mn('glow') }); lampMat.needsUpdate = false
        stars.material.opacity = 1 - k; stars.visible = k < .98; cloudMats.forEach((m) => { m.opacity = mn('cloud') }); clouds.visible = k > .02
        beamMats.forEach((m) => { m.opacity = mn('beam') })
        bMats.forEach((b) => { cA.setHSL(b.hue, .3, b.l0); b.m.color.copy(cA).lerp(b.col, k); b.m.emissiveIntensity = 1 - k })
        mc('water', pudMat.color); pudMat.opacity = mn('wo'); sheenMat.opacity = .14 + .12 * k
        mc('wsplash', waterP.mat.uniforms.uColor.value, true); mc('dust', dustP.mat.uniforms.uColor.value, true)
        cone.material.opacity = mn('cone'); glow.material.opacity = .35 - .2 * k
        blob.material.opacity = .55 + .3 * k
      }
      paint(modeK)
      // ---- on-foot cartoon character (stylized, procedural animation) ----
      const man = new THREE.Group(); man.visible = false; scene.add(man)
      {
        const sk = new THREE.MeshStandardMaterial({ color: 0xe0ac84, roughness: .8 }), sh = new THREE.MeshStandardMaterial({ color: 0x2f86c0, roughness: .8 }), pa = new THREE.MeshStandardMaterial({ color: 0x24364d, roughness: .8 }), ht = new THREE.MeshStandardMaterial({ color: 0xf2d27a, roughness: .8 }), bt = new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: .8 })
        const pt = (g, m, x, y, z, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o }
        pt(new THREE.BoxGeometry(.5, .6, .3), sh, 0, 1.05, 0, man); pt(new THREE.SphereGeometry(.26, 14, 12), sk, 0, 1.58, 0, man)
        pt(new THREE.CylinderGeometry(.4, .4, .05, 16), ht, 0, 1.72, 0, man); pt(new THREE.CylinderGeometry(.22, .26, .16, 14), ht, 0, 1.8, 0, man)
        pt(new THREE.SphereGeometry(.04, 6, 6), pa, -.09, 1.6, .24, man); pt(new THREE.SphereGeometry(.04, 6, 6), pa, .09, 1.6, .24, man)
        const lb = (m, x, y, len, w) => { const g = new THREE.Group(); g.position.set(x, y, 0); const o = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), m); o.position.y = -len / 2; g.add(o); man.add(g); return g }
        man.userData = { aL: lb(sk, -.34, 1.3, .55, .14), aR: lb(sk, .34, 1.3, .55, .14), lL: lb(pa, -.13, .8, .8, .18), lR: lb(pa, .13, .8, .8, .18) }
        pt(new THREE.BoxGeometry(.2, .12, .3), bt, 0, -.74, .04, man.userData.lL); pt(new THREE.BoxGeometry(.2, .12, .3), bt, 0, -.74, .04, man.userData.lR)
        man.scale.setScalar(1.05)
      }
      const carSt = { x: 0, z: 0, h: 0 }; const parkCol = [0, 0, 1.7]
      let jy = 0, jv = 0, gph = 0, manSp = 0
      const st = { x: 0, z: 0, h: 0, v: 0 }
      let thr = 0, steerS = 0, camH = 0, axS = 0
      const camPos = new THREE.Vector3(0, 5, -9); let occK = 1
      const place = (x, z, h) => { st.x = x; st.z = z; st.h = h; st.v = 0; thr = 0; steerS = 0; camH = h; axS = 0; camPos.set(x - Math.sin(h) * 9, 4.4, z - Math.cos(h) * 9); occK = 1 }
      // jump next to a station on the road, facing it
      const gotoStation = (i) => {
        const [sx, sz] = stationPos(i), d = Math.hypot(sx, sz), px = sx * (1 - 7 / d), pz = sz * (1 - 7 / d)
        place(px, pz, Math.atan2(sx - px, sz - pz))
      }
      const home = () => { if (footRef.current) { const i = colliders.indexOf(parkCol); if (i >= 0) colliders.splice(i, 1); footRef.current = false; setFootState(false); man.visible = false }; place(0, 0, 0.5); resetCrates() }
      const toFoot = () => {
        if (footRef.current) return
        carSt.x = st.x; carSt.z = st.z; carSt.h = st.h; parkCol[0] = st.x; parkCol[1] = st.z; colliders.push(parkCol)
        const px = st.x + Math.cos(st.h) * 2.6, pz = st.z - Math.sin(st.h) * 2.6
        footRef.current = true; setFootState(true); man.visible = true; place(px, pz, st.h); jy = 0; jv = 0
      }
      const toCar = () => {
        if (!footRef.current) return
        const i = colliders.indexOf(parkCol); if (i >= 0) colliders.splice(i, 1)
        const h = st.h, cx = st.x - Math.cos(h) * 2.8, cz = st.z + Math.sin(h) * 2.8
        footRef.current = false; setFootState(false); man.visible = false; place(cx, cz, h)
      }
      api.current = { toggleFoot: () => (footRef.current ? toCar() : toFoot()), wake: () => audio.wake(), setSound: (m) => audio.setMuted(!m), gotoStation, home, state: () => ({ ...st }), place, resetCrates, setMode: (m) => { modeTo = m === 'day' ? 1 : 0 } }
      window.__crates = () => crates.map((c) => [+c.x.toFixed(1), +c.y.toFixed(2), +c.tilt.toFixed(2), +c.vy.toFixed(2)]); window.__driveState = () => ({ ...st }); window.__gatePulse = () => gates.map((q) => q.pulse); window.__driveWorld = { gates: gates.map((q) => ({ x: q.gx, z: q.gz, ax: q.axx, az: q.axz })), stations: STATIONS, sparks: SPARKS, puddles, crates, socials: socialObjs.map((o) => ({ x: o.x, z: o.z, id: o.l.id })) }; window.__driveMode = (m, instant) => { modeTo = m === 'day' ? 1 : 0; if (instant) { modeK = modeTo; paint(modeK) } }; window.__drivePlace = (x, z, h) => { place(x, z, h); camPos.set(x - Math.sin(h) * 9, 5, z - Math.cos(h) * 9) }
      // opening view: car faces station 0 from the middle
      place(0, 0, 0.5); camPos.set(-Math.sin(.5) * 9, 5, -Math.cos(.5) * 9)

      const resize = () => {
        const w = el.clientWidth, h = el.clientHeight
        renderer.setSize(w, h, false); pools.forEach((q) => { q.mat.uniforms.uH.value = renderer.domElement.height }); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
        camera.aspect = w / h; camera.fov = w / h < 0.8 ? 74 : small ? 66 : 55; camera.updateProjectionMatrix()
      }
      const ro = new ResizeObserver(resize); ro.observe(el); resize()
      let visible = true
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 }); io.observe(el)

      let last = performance.now(), t0 = last
      const bump = (v) => {
        shake = Math.min(1, v / 12); bumpCd = .4; fx.bumps++; audio.thud(v); try { navigator.vibrate?.(25) } catch {}
        const fxv = Math.sin(st.h), fzv = Math.cos(st.h)
        for (let q = 0; q < (small ? 6 : 10); q++) dustP.emit(st.x + fxv * 1.8 + (Math.random() - .5) * 1.4, .3, st.z + fzv * 1.8 + (Math.random() - .5) * 1.4, (Math.random() - .5) * 2.4, .8 + Math.random(), (Math.random() - .5) * 2.4, .7 + Math.random() * .5, 1.2)
      }
      const tick = (dt, t, draw = true) => {
        const k = keys.current
        if (Math.abs(modeK - modeTo) > 1e-3) { modeK += Math.sign(modeTo - modeK) * Math.min(Math.abs(modeTo - modeK), dt * 1.4); paint(modeK) }
        bumpCd -= dt; clouds.rotation.y += dt * .004
        thr += ((k.up ? 1 : 0) - thr) * (1 - Math.exp(-dt * 7))
        const vPrev = st.v
        const foot = footRef.current
        if (foot) {
          const vmax = k.run ? 6.2 : 2.9
          st.v += ((k.up ? vmax : k.dn ? -1.8 : 0) - st.v) * (1 - Math.exp(-dt * 9))
        } else {
        const acc = k.dn ? (st.v > .5 ? -24 : -10) : 14 * thr
        st.v += acc * dt
        if (!k.up && !k.dn) st.v -= Math.sign(st.v) * Math.min(Math.abs(st.v), 6 * dt)
        st.v = Math.max(-6, Math.min(14, st.v))
        }
        const steer = (k.l ? 1 : 0) - (k.r ? 1 : 0)
        steerS += (steer - steerS) * (1 - Math.exp(-dt * 9))
        if (foot) st.h += steerS * 2.8 * dt
        else st.h += steerS * 2.1 * (1 - .3 * Math.min(1, Math.abs(st.v) / 14)) * Math.max(-1, Math.min(1, st.v / 5)) * dt
        st.x += Math.sin(st.h) * st.v * dt; st.z += Math.cos(st.h) * st.v * dt
        audio.update(foot ? 0 : st.v, k.up, foot)
        for (let i = 0; i < colliders.length; i++) {
          const c = colliders[i], cx = st.x - c[0], cz = st.z - c[1]
          if (Math.abs(cx) > 9 || Math.abs(cz) > 9) continue
          const dd = Math.hypot(cx, cz), lim = c[2] + (foot ? .45 : 1.5)
          if (dd < lim && dd > 1e-4) { if (foot) { st.x = c[0] + (cx / dd) * lim; st.z = c[1] + (cz / dd) * lim; continue } if (c[3] && st.v > 5) { breakLamp(c[3]); st.v *= .88; fx.bumps++; shake = Math.min(1, st.v / 12); continue } if (st.v > 2.5 && bumpCd <= 0) bump(st.v); st.x = c[0] + (cx / dd) * lim; st.z = c[1] + (cz / dd) * lim; st.v *= Math.max(0, 1 - 6 * dt) }
        }
        const d = Math.hypot(st.x, st.z)
        if (d > EDGE) { st.x *= EDGE / d; st.z *= EDGE / d; st.v *= .5 }
        if (nearRef.current >= 0 && !k.up && Math.hypot(st.x - stationPos(nearRef.current)[0], st.z - stationPos(nearRef.current)[1]) < 3.4) st.v *= Math.exp(-dt * 2.5)
        {
          const fxv = Math.sin(st.h), fzv = Math.cos(st.h), lx = Math.cos(st.h), lz = -Math.sin(st.h), sp = Math.abs(st.v)
          let inPud = false
          for (let i = 0; i < puddles.length; i++) { const q = puddles[i], dx = (st.x - q.x) / q.r, dz = (st.z - q.z) / (q.r * q.e); if (dx * dx + dz * dz < 1.05) { inPud = true; break } }
          if (inPud && sp > 1.2) {
            st.v *= Math.exp(-dt * .5)
            splashAcc += sp * dt * (small ? 7 : 11)
            while (splashAcc >= 1) {
              splashAcc -= 1; const sx = Math.random() < .5 ? -1 : 1, sz = Math.random() < .5 ? 1.3 : -1.3, rr = Math.random()
              waterP.emit(st.x + lx * sx * 1.0 + fxv * sz, .15, st.z + lz * sx * 1.0 + fzv * sz, lx * sx * (1.2 + rr * 2.6) + fxv * st.v * .3, 2.6 + Math.random() * 3.6, lz * sx * (1.2 + rr * 2.6) + fzv * st.v * .3, .6 + Math.random() * .5, 1); fx.splash++
            }
            ripT -= dt; if (ripT <= 0) { ripple(st.x + (Math.random() - .5) * 1.4, st.z + (Math.random() - .5) * 1.4); ripT = .2 }
          } else if (sp > 5 && Math.abs(d - R) > 3.4) {
            dustAcc += sp * dt * (small ? 1.6 : 2.4)
            while (dustAcc >= 1) {
              dustAcc -= 1; const sx = Math.random() < .5 ? -1 : 1
              dustP.emit(st.x + lx * sx * .9 - fxv * 1.5, .2, st.z + lz * sx * .9 - fzv * 1.5, -fxv * st.v * .1 + (Math.random() - .5) * .8, .5 + Math.random() * .8, -fzv * st.v * .1 + (Math.random() - .5) * .8, .8 + Math.random() * .7, 1); fx.dust++
            }
          }
          ripples.forEach((r) => { if (r.age > .9) { r.m.visible = false; return } r.age += dt; r.m.scale.set(.4 + r.age * 3.6, 1, .4 + r.age * 3.6); r.m.material.opacity = Math.max(0, 1 - r.age / .9) * .8 })
          waterP.step(dt, 11, .3, .95); dustP.step(dt, -.4, 2.2, .5)
          stepShards(dt)
          // crates
          const cps = [[st.x + fxv * 1.1, st.z + fzv * 1.1], [st.x - fxv * .9, st.z - fzv * .9]], hitR = 1.9
          for (let i = 0; i < crates.length; i++) {
            const c = crates[i]; if (c.broken) continue
            for (let q = 0; q < 2; q++) {
              const dx = c.x - cps[q][0], dz = c.z - cps[q][1], dd = Math.hypot(dx, dz)
              if (dd < hitR && dd > 1e-4) {
                const nx = dx / dd, nz = dz / dd, rel = st.v * (fxv * nx + fzv * nz)
                if (rel > 6.5) { breakCrate(c); st.v *= .9; if (!knockedFlag) { knockedFlag = true; setKnocked(true) } break }
                if (rel > .5) {
                  const spd = rel * 1.2 + 1.4
                  c.vx = nx * spd; c.vz = nz * spd; c.vy = 1.6 + rel * .3; c.tv = 2.6 + rel * .55; c.spin = (Math.random() - .5) * 6; c.gy = Math.atan2(nx, nz)
                  st.v *= .92; fx.knocks++; if (!knockedFlag) { knockedFlag = true; setKnocked(true) }
                }
                c.x = cps[q][0] + nx * hitR; c.z = cps[q][1] + nz * hitR
              }
            }
          }
          for (let i = 0; i < crates.length; i++) {
            const c = crates[i]; if (c.broken) continue
            c.x += c.vx * dt; c.z += c.vz * dt
            const fr = Math.exp(-dt * (c.y > .02 ? .3 : 2.4)); c.vx *= fr; c.vz *= fr
            const air = c.y > 0 || c.vy > 0; c.y += c.vy * dt; if (air) c.vy -= 18 * dt; if (c.y < 0) { c.y = 0; c.vy = c.vy < -3 ? -c.vy * .3 : 0 }
            c.tilt = Math.max(0, Math.min(1.5708, c.tilt + c.tv * dt)); c.tv *= Math.exp(-dt * 1.3)
            const moving = Math.hypot(c.vx, c.vz) > .5 || c.y > .02
            if (!moving && Math.abs(c.tv) < .4) { const tgt = c.tilt > .8 ? 1.5708 : 0; c.tilt += (tgt - c.tilt) * (1 - Math.exp(-dt * 7)) }
            c.rot += c.spin * dt; c.spin *= Math.exp(-dt * 1.6)
            for (let j = i + 1; j < crates.length; j++) {
              const o = crates[j], dx = o.x - c.x, dz = o.z - c.z, dd = Math.hypot(dx, dz)
              if (dd < 1.45 && dd > 1e-4) {
                const nx = dx / dd, nz = dz / dd, pen = (1.45 - dd) / 2; c.x -= nx * pen; c.z -= nz * pen; o.x += nx * pen; o.z += nz * pen
                const rv = (c.vx - o.vx) * nx + (c.vz - o.vz) * nz
                if (rv > .3) { c.vx -= nx * rv * .85; c.vz -= nz * rv * .85; o.vx += nx * rv * .85; o.vz += nz * rv * .85; o.gy = Math.atan2(nx, nz); o.tv += rv * .35; o.vy = Math.max(o.vy, rv * .25); o.spin += (Math.random() - .5) * 3 }
              }
            }
            for (let j = 0; j < colliders.length; j++) {
              const cc = colliders[j], dx = c.x - cc[0], dz = c.z - cc[1]
              if (Math.abs(dx) > 6 || Math.abs(dz) > 6) continue
              const dd = Math.hypot(dx, dz), lim = cc[2] + .9
              if (dd < lim && dd > 1e-4) { c.x = cc[0] + dx / dd * lim; c.z = cc[1] + dz / dd * lim; c.vx *= -.3; c.vz *= -.3 }
            }
            const cd = Math.hypot(c.x, c.z); if (cd > EDGE - 2) { c.x *= (EDGE - 2) / cd; c.z *= (EDGE - 2) / cd; c.vx = c.vz = 0 }
            c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.gy; c.inner.position.y = .65 * Math.sin(c.tilt) + c.y; c.inner.rotation.set(c.tilt, c.rot, 0)
          }
          tails.forEach((m) => m.color.setHex(k.dn && st.v > .3 ? 0xff7a5a : 0xd02a22))
        }
        if (foot) {
          car.position.set(carSt.x, 0, carSt.z); car.rotation.set(0, carSt.h, 0)
          const U = man.userData, sp2 = Math.abs(st.v), want = Math.min(1, sp2 / 3)
          manSp += (want - manSp) * (1 - Math.exp(-dt * 10)); gph += dt * (3 + sp2 * 2.2)
          if (jy === 0 && k.jump) { jv = 5.2; jy = .001 }
          if (jy > 0) { jv -= 15 * dt; jy += jv * dt; if (jy <= 0) { jy = 0; jv = 0 } }
          const sw = Math.sin(gph) * (.55 + .5 * Math.min(1, sp2 / 6)) * manSp * (st.v < 0 ? -1 : 1)
          U.lL.rotation.x = sw; U.lR.rotation.x = -sw; U.aL.rotation.x = -sw * .9; U.aR.rotation.x = sw * .9
          if (jy > 0) { U.lL.rotation.x = -.6; U.lR.rotation.x = .3; U.aL.rotation.x = -2.4; U.aR.rotation.x = -2.4 }
          else if (manSp < .05) { U.aL.rotation.x = Math.sin(t * 1.7) * .05; U.aR.rotation.x = -Math.sin(t * 1.7) * .05 }
          man.position.set(st.x, jy + Math.abs(Math.sin(gph)) * .06 * manSp, st.z); man.rotation.y = st.h; man.rotation.x = -manSp * (k.run ? .16 : .05)
        } else
        car.position.set(st.x, Math.sin(t * 18) * .01 * Math.abs(st.v) / 14, st.z)
        if (!foot) axS += (((st.v - vPrev) / Math.max(dt, 1e-3)) - axS) * (1 - Math.exp(-dt * 8))
        if (!foot) { car.rotation.x = Math.sin(t * 40) * shake * .04 - Math.max(-24, Math.min(14, axS)) * .0042; car.rotation.y = st.h; car.rotation.z = -steerS * Math.min(1, Math.abs(st.v) / 14) * .09
        wheels[0].rotation.y = wheels[1].rotation.y = steerS * .5 }
        if (!foot && Math.abs(steerS) > .7 && st.v > 8 && Math.random() < .5) dustP.emit(st.x - Math.sin(st.h) * 1.4 + (Math.random() - .5), .2, st.z - Math.cos(st.h) * 1.4 + (Math.random() - .5), (Math.random() - .5), .6, (Math.random() - .5), .6, 1)
        { let e = st.h - camH; e = Math.atan2(Math.sin(e), Math.cos(e)); camH += e * (1 - Math.exp(-dt * 3.4)) }
        const camD = foot ? 5.4 : 9 + Math.abs(st.v) * .1, tx = st.x - Math.sin(camH) * camD, tz = st.z - Math.cos(camH) * camD
        camPos.x += (tx - camPos.x) * (1 - Math.exp(-dt * 4)); camPos.z += (tz - camPos.z) * (1 - Math.exp(-dt * 4))
        for (let i = 0; i < colliders.length; i++) {
          const c = colliders[i], cx = camPos.x - c[0], cz = camPos.z - c[1]
          if (Math.abs(cx) > 12 || Math.abs(cz) > 12) continue
          const dd = Math.hypot(cx, cz), lim = c[2] + (c[2] > 2 ? 2.4 : .8)
          if (dd < lim && dd > 1e-4) { camPos.x = c[0] + (cx / dd) * lim; camPos.z = c[1] + (cz / dd) * lim }
        }
        camera.fov = (camera.aspect < 0.8 ? 74 : small ? 66 : 55) + Math.abs(st.v) * .7; camera.updateProjectionMatrix()
        let cX = camPos.x, cZ = camPos.z, cY = foot ? 2.7 : 4.4
        { const vx = cX - st.x, vz = cZ - st.z, len2 = vx * vx + vz * vz, len = Math.sqrt(len2); let k = 1
          for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i]; if (c[2] < 1.2) continue
            const px = c[0] - st.x, pz = c[1] - st.z; if (Math.abs(px) > 16 || Math.abs(pz) > 16) continue
            const tt = Math.max(0, Math.min(1, (px * vx + pz * vz) / Math.max(len2, 1e-6)))
            if (tt < .08) continue
            const dd = Math.hypot(px - vx * tt, pz - vz * tt)
            if (dd < c[2] * .95) k = Math.min(k, Math.max(.3, tt - (c[2] + .6) / Math.max(len, 1)))
          }
          occK += (k - occK) * (1 - Math.exp(-dt * (k < occK ? 12 : 3)))
          cX = st.x + vx * occK; cZ = st.z + vz * occK; cY = (foot ? 2.7 : 4.4) - (1 - occK) * 1.2 }
        camera.position.set(cX + Math.sin(t * 61) * shake * .28, cY + Math.cos(t * 53) * shake * .2, cZ); shake *= Math.exp(-dt * 6)
        camera.lookAt(st.x + Math.sin(st.h) * (foot ? 3 : 4), foot ? 1.5 : 3.4, st.z + Math.cos(st.h) * (foot ? 3 : 4))
        if (window.__camOv) { const o = window.__camOv, a = st.h + o.az; camera.position.set(st.x + Math.sin(a) * o.d, o.y, st.z + Math.cos(a) * o.d); camera.lookAt(st.x, .8, st.z) }
        boards.forEach((o) => { o.b.rotation.y = Math.atan2(st.x - o.wx, st.z - o.wz) })
        sparkObjs.forEach((o) => {
          if (!o.on) return
          o.orb.position.y = 1.4 + Math.sin(t * 2 + o.k) * .25; o.orb.rotation.y = t
          if (Math.hypot(st.x - SPARKS[o.k][0], st.z - SPARKS[o.k][1]) < 2.8) { o.on = false; o.g.visible = false; if (!foundRef.current.includes(o.k)) setFound((f) => [...f, o.k]); setToast(String(o.k) + ':' + Date.now()) }
        })
        if (!foot) wheels.forEach((w) => { w.children[0].rotation.x += st.v * dt / .45 })
        pads.forEach((p, i) => { p.material.opacity = nearRef.current === i ? 1 : .55 + Math.sin(t * 2 + i) * .15 })
        socialObjs.forEach((o) => { o.bd.rotation.y = Math.atan2(st.x - o.x, st.z - o.z) })
        { let sb = -1, sd = 4.6; socialObjs.forEach((o, i) => { const dd = Math.hypot(st.x - o.x, st.z - o.z); if (dd < sd) { sd = dd; sb = i } }); if (sb !== socNearRef.current) { socNearRef.current = sb; setSocNear(sb) } }
        let best = -1, bd = NEAR
        projects.forEach((_, i) => { const [sx, sz] = stationPos(i); const dd = Math.hypot(st.x - sx, st.z - sz); if (dd < bd) { bd = dd; best = i } })
        if (best !== nearRef.current) { nearRef.current = best; setNear(best) }
        gates.forEach((q) => {
          const rx = st.x - q.gx, rz = st.z - q.gz, along = rx * q.axx + rz * q.axz, lat = rx * q.latx + rz * q.latz
          if (Math.abs(lat) < 1.9 && Math.abs(along) < 4) { if (q.prev !== 0 && Math.sign(along) !== q.prev && Math.abs(st.v) > 2) { q.pulse = 1; for (let n = 0; n < 14; n++) dustP.emit(q.gx + (Math.random() - .5) * 4, 1 + Math.random() * 3, q.gz + (Math.random() - .5) * 4, (Math.random() - .5) * 2, 2 + Math.random() * 2, (Math.random() - .5) * 2, .9, 1) } q.prev = Math.sign(along) || q.prev } else q.prev = 0
          q.pulse = Math.max(0, q.pulse - dt * 1.4); q.ring.material.opacity = q.pulse * .55; q.ban.scale.setScalar(1 + q.pulse * .12)
          q.ban.material.opacity = Math.max(0, Math.min(1, (Math.hypot(camera.position.x - q.gx, camera.position.z - q.gz) - 3) / 5)) // fade the banner when the camera is right next to it so it never blocks the view
        })
        if (draw) renderer.render(scene, camera)
      }
      const loop = (now) => {
        raf = requestAnimationFrame(loop)
        const dt = Math.min(.05, (now - last) / 1000); last = now
        if (!visible || window.__driveManual) return
        tick(dt, (now - t0) / 1000)
      }
      // offline fixed-step rendering hook (used only to record smooth preview animations)
      let mt = 0
      window.__driveStep = (dt, kk, draw = true) => { Object.assign(keys.current, kk); mt += dt; tick(dt, mt, draw) }
      raf = requestAnimationFrame(loop)
      setReady(true)
      cleanup = () => {
        cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
        scene.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose() } })
        renderer.dispose(); renderer.domElement.remove()
      }
    })()
    return () => { disposed = true; cleanup() }
  }, [projects, N, t.name])

  const MAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'up', w: 'up', W: 'up', ' ': 'dn', ArrowDown: 'dn', s: 'dn', S: 'dn' }
  const dismissOnb = () => { api.current.wake?.(); if (onbRef.current) { setOnb(false); try { localStorage.setItem('drive-seen', '1') } catch {} } }
  const openAt = (i) => { setOpen(i); setVisited((v) => (v.includes(i) ? v : [...v, i])) }
  const refocus = () => wrap.current?.focus({ preventScroll: true })
  const onKey = (down) => (e) => {
    if (e.key === 'Shift') { keys.current.run = down; return }
    if (down && (e.key === 'c' || e.key === 'C')) { api.current.toggleFoot?.(); e.preventDefault(); return }
    if (e.key === ' ' && footRef.current) { keys.current.jump = down; if (down) dismissOnb(); e.preventDefault(); return }
    const k = MAP[e.key]
    if (k) { keys.current[k] = down; if (down) dismissOnb(); e.preventDefault(); return }
    if (!down) return
    if ((e.key === 'Enter' || e.key === 'e' || e.key === 'E') && nearRef.current < 0 && socNearRef.current >= 0 && e.target === wrap.current) { window.open(SOCIALS_URLS[socNearRef.current], '_blank', 'noopener,noreferrer'); e.preventDefault(); return }
    if ((e.key === 'Enter' || e.key === 'e' || e.key === 'E') && nearRef.current >= 0 && e.target === wrap.current) { openAt(nearRef.current); e.preventDefault() }
    if (e.key === 'r' || e.key === 'R') { api.current.home?.(); e.preventDefault() }
    if (e.key === 'Escape') { if (openRef.current >= 0) { setOpen(-1); refocus() } else if (panel) { setPanel(false); refocus() } else wrap.current?.blur() }
  }
  const hold = (k) => ({
    onPointerDown: (e) => { e.preventDefault(); dismissOnb(); e.currentTarget.setPointerCapture?.(e.pointerId); keys.current[k] = true },
    onPointerUp: () => { keys.current[k] = false }, onPointerCancel: () => { keys.current[k] = false }, onLostPointerCapture: () => { keys.current[k] = false },
    onContextMenu: (e) => e.preventDefault(), style: { touchAction: 'none' },
  })
  const go = (i) => { api.current.gotoStation?.(i); openAt(i); setPanel(false); dismissOnb(); refocus() }
  const cur = open >= 0 ? projects[open] : near >= 0 ? projects[near] : null
  const btn = 'grid h-[68px] w-[68px] select-none place-items-center rounded-3xl border border-[#bcd6ea]/70 bg-[#e4f1f9]/75 text-3xl text-[#1c3350] shadow-lg shadow-sky-900/10 active:bg-gold active:text-black md:h-12 md:w-12 md:text-xl'
  const sparkIdx = toast ? Number(toast.split(':')[0]) : -1
  useEffect(() => { const f = () => { if (!document.fullscreenElement) setImmersive((v) => (v && document.fullscreenEnabled ? false : v)) }; document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])
  useEffect(() => { const f = () => { try { const m = localStorage.getItem('drive-mode'); if (m === 'day' || m === 'night') { setModeState(m); api.current.setMode?.(m) } } catch {} }; window.addEventListener('drive-mode', f); return () => window.removeEventListener('drive-mode', f) }, [])
  useEffect(() => { document.body.style.overflow = immersive ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [immersive])
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4500); return () => clearTimeout(id) }, [toast])
  const chip = 'inline-flex items-center rounded-full border border-[#bcd6ea]/70 bg-[#e9f3fa] px-3 py-1 text-xs text-[#1c3350] shadow-lg shadow-sky-900/10 md:text-sm'

  return (
    <section id="work" aria-label={t.galleryLabel} className={game ? 'absolute inset-0 h-full w-full overflow-hidden bg-black' : immersive ? 'fixed inset-0 z-[60] h-[100dvh] w-full overflow-hidden bg-black' : 'relative h-[100svh] min-h-[560px] w-full overflow-hidden'}>
      <a href="#admin" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-16 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-1 focus:text-black">{t.skipGame}</a>
      {game && <button onClick={onExit} className="game-exit rounded-full border border-[#bcd6ea]/70 bg-[#f7fbfe] px-4 py-2 min-h-[40px] text-sm font-bold text-[#1c3350] shadow-lg shadow-sky-900/10" aria-label={t.exitWorld}>✕ {t.exitWorld}</button>}
      <div ref={wrap} tabIndex={0} role="application" aria-label={t.driveLabel}
        onKeyDown={onKey(true)} onKeyUp={onKey(false)} onFocus={() => setEngaged(true)}
        onBlur={() => { setEngaged(false); Object.keys(keys.current).forEach((k) => (keys.current[k] = false)) }}
        onPointerDown={(e) => { if (e.target === wrap.current || e.target === mount.current) refocus() }}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-gold">
        <div ref={mount} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-64 hud-fade bg-gradient-to-b from-white/75 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pt-20 hud-title md:px-12 md:pt-24">
          <p className="text-xs uppercase tracking-[.2em] text-[#2a4766] md:tracking-[.25em]">{t.role}</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4vw,3rem)] font-extrabold leading-none">{t.name}</h1>
        </div>
        {/* discovery counters (no route hints) + secondary actions */}
        <div className="absolute inset-x-0 top-[9.7rem] z-10 hud-chips flex flex-wrap items-center gap-2 px-6 md:top-[11.25rem] md:px-12">
          <span className={chip} aria-live="polite">{t.discovered}: <b dir="ltr">{visited.length}/{N}</b></span>
          <span className={chip + ' hidden md:inline-flex'} aria-live="polite">{t.sparks}: <b dir="ltr">{found.length}/{SPARKS.length}</b></span>
          <button onClick={() => setPanel((v) => !v)} aria-expanded={panel} className={chip + ' hover:border-[#2a73a6] min-h-[40px] px-4 md:min-h-0 md:px-3 !bg-[#b9e0f7] !border-[#8cc4e8] font-bold'}>{t.allProjects}</button>
          <button onClick={() => { api.current.home?.(); refocus() }} className={chip + ' hover:border-gold min-h-[40px] px-4 md:min-h-0 md:px-3'} aria-label={t.home}>↺<span className="hidden md:inline">&nbsp;{t.homeShort}</span></button>
          <button onClick={() => { api.current.toggleFoot?.(); api.current.wake?.(); refocus() }} aria-pressed={foot} aria-label={foot ? t.takeCar : t.goWalk} className={chip + ' hover:border-gold min-h-[40px] px-4 md:min-h-0 md:px-3 !bg-[#b9e0f7] !border-[#8cc4e8] font-bold'}>{foot ? t.takeCar : t.goWalk}</button>
          <button onClick={() => { const m = mode === 'day' ? 'night' : 'day'; setModeState(m); try { localStorage.setItem('drive-mode', m) } catch {} ; api.current.setMode?.(m); window.dispatchEvent(new Event('drive-mode')); refocus() }} aria-pressed={mode === 'day'} aria-label={t.toggleMode} className={chip + ' hover:border-gold min-h-[40px] px-4 md:min-h-0 md:px-3'}>{mode === 'day' ? '☀' : '☾'}<span className="hidden md:inline">&nbsp;{mode === 'day' ? t.dayMode : t.nightMode}</span></button>
          <button onClick={() => { const m = !snd; setSnd(m); try { localStorage.setItem('drive-sound', m ? 'on' : 'off') } catch {}; api.current.wake?.(); api.current.setSound?.(m); refocus() }} aria-pressed={snd} aria-label={snd ? t.soundOff : t.soundOn} className={chip + ' hover:border-gold min-h-[40px] px-4 md:min-h-0 md:px-3'}>{snd ? '🔊' : '🔇'}</button>
          {!game && <button onClick={() => { const on = !immersive; setImmersive(on); try { if (on) document.documentElement.requestFullscreen?.() ; else if (document.fullscreenElement) document.exitFullscreen?.() } catch {} ; refocus() }} aria-pressed={immersive} aria-label={immersive ? t.exitFull : t.fullscreen} className={chip + ' hover:border-gold min-h-[40px] px-4 md:min-h-0 md:px-3'}>{immersive ? '⤡' : '⤢'}</button>}
          {knocked && <button onClick={() => { api.current.resetCrates?.(); refocus() }} className={chip + ' hover:border-gold min-h-[44px] px-4 md:min-h-0 md:px-3'}>↻ {t.resetBoxes}</button>}
        </div>
        <p className="pointer-events-none hud-hint absolute end-6 top-24 z-10 hidden max-w-xs text-end text-xs text-zinc-400 md:block">{engaged ? t.keysOn : t.keysOff}</p>
        <div className="sr-only" aria-live="polite">{near >= 0 ? t.nearAt + ' ' + t.projects[projects[near].id][0] : ''}</div>

        {panel && (
          <div role="region" aria-label={t.allProjects} className="absolute start-4 top-[15rem] sm:top-[13.8rem] z-30 proj-panel max-h-[calc(100svh-25rem)] sm:max-h-[calc(100svh-26rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-[#bcd6ea]/70 bg-[#f7fbfe] shadow-lg shadow-sky-900/10 p-3 md:start-12 md:top-[15.5rem]">
            <p className="px-2 pb-2 text-xs text-zinc-400">{t.panelNote}</p>
            <ul>{projects.map((q, i) => (
              <li key={q.id}><button onClick={() => go(i)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-zinc-800/80">
                <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-black" style={{ background: q.accent }}>{visited.includes(i) ? '✓' : i + 1}</span>
                <span><span className="block font-semibold">{t.projects[q.id][0]}</span><span className="block text-xs text-zinc-400">{t.projects[q.id][1]}</span></span>
              </button></li>))}</ul>
          </div>
        )}

        {/* spark toast */}
        {sparkIdx >= 0 && <div role="status" className="pointer-events-none absolute inset-x-0 top-[13.8rem] z-20 spark-toast flex justify-center px-6 md:top-[15.5rem]"><p className="rounded-2xl border border-[#bcd6ea]/70 bg-[#f7fbfe] shadow-lg shadow-sky-900/10 px-4 py-2 text-center text-sm">✦ {t.sparkFacts[sparkIdx]}</p></div>}

        {/* touch controls */}
        <div dir="ltr" className="absolute inset-x-0 bottom-5 z-10 touch-ctl items-end justify-between px-4">
          <div className="flex gap-3"><button aria-label={t.left} className={btn} {...hold('l')}>◀</button><button aria-label={t.right} className={btn} {...hold('r')}>▶</button></div>
          <div className="flex items-end gap-3">{foot && <button aria-label={t.run} className={btn + ' !text-base font-bold'} {...hold('run')}>{t.run}</button>}{foot && <button aria-label={t.jump} className={btn + ' !text-2xl'} {...hold('jump')}>⤒</button>}<button aria-label={t.brake} className={btn} {...hold('dn')}>■</button><button aria-label={t.gas} className={btn + ' !h-[82px] !w-[82px] !bg-[#b9e0f7]/85 !text-black'} {...hold('up')}>▲</button></div>
        </div>
        {/* near prompt */}
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 near-prompt flex justify-center px-4 md:bottom-10">
          {socNear >= 0 && !(cur && open < 0) && open < 0 ? (
            <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border-2 bg-[#f7fbfe] shadow-lg shadow-sky-900/10 px-5 py-3" style={{ borderColor: SOC_COL[SOCIALS[socNear].id] }}>
              <div className="text-lg font-bold md:text-2xl">{SOCIALS[socNear].label}</div>
              <a href={SOCIALS[socNear].url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#bcd6ea]/70 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-sky-900/10" style={{ background: SOC_COL[SOCIALS[socNear].id] }}>{t.openSocial} ↗ <span className="hidden md:inline" dir="ltr">(Enter)</span></a>
            </div>
          ) : cur && open < 0 ? (
            <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border-2 bg-[#f7fbfe] shadow-lg shadow-sky-900/10 px-5 py-3" style={{ borderColor: cur.accent }}>
              <div><div className="text-lg font-bold md:text-2xl">{t.projects[cur.id][0]}</div><div className="text-sm text-zinc-300">{t.projects[cur.id][1]}</div></div>
              <button onClick={() => openAt(near)} className="rounded-full border border-[#bcd6ea]/70 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-sky-900/10" style={{ background: cur.accent }}>{t.openStation} <span className="hidden md:inline" dir="ltr">(Enter)</span></button>
            </div>
          ) : null}
        </div>
        {!ready && <div className="absolute inset-0 z-20 grid place-items-center bg-[#eaf4fb]"><div className="text-center"><div className="mx-auto h-14 w-14 animate-pulse rounded-2xl bg-gold/90" /><p className="mt-4 text-[#2a4766]">{t.loading}</p><div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-black/40"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-gold" /></div></div></div>}

        {open >= 0 && (
          <div role="dialog" aria-modal="false" aria-label={t.projects[projects[open].id][0]} className="absolute inset-x-4 bottom-32 z-30 proj-dialog mx-auto max-w-xl rounded-2xl border-2 bg-[#f7fbfe] shadow-lg shadow-sky-900/10 p-5 md:bottom-10" style={{ borderColor: projects[open].accent }}>
            <div className="flex gap-4">
              <img src={'./img/' + projects[open].img} alt="" className="h-24 w-24 rounded-lg object-cover md:h-32 md:w-32" />
              <div className="min-w-0 flex-1">
                <span dir="ltr" className="inline-block text-sm font-extrabold" style={{ color: projects[open].accent }}>{String(open + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}</span>
                <h2 className="text-xl font-bold md:text-3xl">{t.projects[projects[open].id][0]}</h2>
                <p className="text-zinc-300">{t.projects[projects[open].id][1]}</p>
                <a className="mt-2 inline-block font-bold" style={{ color: projects[open].accent }} href={'https://www.behance.net/gallery/' + projects[open].id} target="_blank" rel="noreferrer">{t.behance}</a>
              </div>
              <button autoFocus onClick={() => { setOpen(-1); refocus() }} aria-label={t.close} className="h-9 w-9 shrink-0 rounded-full border border-zinc-600">✕</button>
            </div>
          </div>
        )}

        {/* first visit: say what this is and how to drive, then get out of the way */}
        {onb && (
          <div role="region" aria-label={t.onbTitle} data-onb className="absolute inset-0 z-40 grid place-items-start bg-sky-900/10 p-4 pt-[15rem] md:place-items-center md:bg-sky-900/20 md:pt-4">
            <div className="w-full max-w-md onb-card rounded-3xl border border-[#bcd6ea]/70 bg-[#f7fbfe]/95 shadow-lg shadow-sky-900/10 p-4 text-center md:bg-[#f7fbfe] md:p-6">
              <h2 className="text-xl font-extrabold md:text-2xl">{t.onbTitle}</h2>
              <p className="mt-2 hidden text-zinc-300 md:block">{t.onbSub}</p>
              <div className="mt-3 grid gap-2 text-sm text-zinc-200 md:mt-4">
                <p className="hidden md:block onb-keys" dir="ltr"><kbd className="rounded border px-2 py-0.5">W</kbd> <kbd className="rounded border px-2 py-0.5">A</kbd> <kbd className="rounded border px-2 py-0.5">S</kbd> <kbd className="rounded border px-2 py-0.5">D</kbd> / arrows <span className="text-zinc-400">·</span> <kbd className="rounded border px-2 py-0.5">Enter</kbd> <span className="text-zinc-400">·</span> <kbd className="rounded border px-2 py-0.5">R</kbd></p>
                <p className="hidden md:block onb-keys text-zinc-400">{t.onbKeys}</p>
                <p className="text-sm text-zinc-300 onb-touch md:hidden">{t.onbTouch}</p>
              </div>
              <div className="mt-3 flex flex-row gap-2 md:mt-5 md:flex-col"><style>{`[data-onb] button{flex:1}`}</style>
                <button autoFocus onClick={() => { dismissOnb(); refocus() }} className="rounded-full border border-[#bcd6ea]/70 bg-gold px-5 py-3 min-h-[48px] font-bold text-black shadow-lg shadow-sky-900/10">{t.start}</button>
                <button onClick={() => { dismissOnb(); setPanel(true) }} className="rounded-full border border-[#bcd6ea]/70 bg-[#e9f3fa] px-5 py-2 min-h-[44px] text-sm shadow-lg shadow-sky-900/10">{t.skipDrive}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

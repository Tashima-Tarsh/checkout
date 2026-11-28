import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

function PaymentScene() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }) }
    catch { return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(0, 0)
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 100)
    camera.position.set(0, 0, 8)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9774b5, 2.5))
    const light = new THREE.DirectionalLight(0xfff5dc, 3)
    light.position.set(4, 5, 6)
    scene.add(light)
    const coin = new THREE.Group()
    const metal = new THREE.MeshStandardMaterial({color: 0xbda5eb, metalness: .55, roughness: .28})
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,.24,96),metal)
    disk.rotation.x = Math.PI / 2
    coin.add(disk)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.33,.045,16,96),new THREE.MeshStandardMaterial({color:0xffe7bd,metalness:.65,roughness:.22}))
    rim.position.z = .15
    coin.add(rim)
    const label = document.createElement('canvas')
    label.width = label.height = 512
    const ctx = label.getContext('2d')!
    ctx.font = 'bold 320px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fffaf0'
    ctx.fillText('₹',256,260)
    const texture = new THREE.CanvasTexture(label)
    texture.colorSpace = THREE.SRGBColorSpace
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.4), new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}))
    face.position.z=.16
    coin.add(face)
    scene.add(coin)
    const orbit = new THREE.Group()
    for(let i=0;i<3;i++){
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95+i*.22,.018,10,100),new THREE.MeshStandardMaterial({color:i===1?0x70cdb9:0xd5b78a,metalness:.45,roughness:.35}))
      ring.rotation.set(.65+i*.35,.35+i*.3,0)
      orbit.add(ring)
    }
    scene.add(orbit)
    const resize = () => {const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    let frame=0
    const draw=(ms:number)=>{const t=ms*.001;coin.rotation.y=Math.sin(t*.65)*.45;coin.rotation.x=Math.sin(t*.45)*.12;coin.position.y=Math.sin(t*.9)*.12;orbit.rotation.z=t*.12;renderer.render(scene,camera);frame=requestAnimationFrame(draw)}
    frame=requestAnimationFrame(draw)
    el.dataset.webgl='active'
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose())}});texture.dispose();renderer.dispose();renderer.domElement.remove();delete el.dataset.webgl}
  },[])
  return <div ref={host} className="payment-scene" aria-hidden="true"><span className="payment-fallback">₹</span></div>
}

export const Home: React.FC = () => <main className="public-hero">
  <div className="public-hero-copy">
    <p className="public-kicker">A new direction for Indian commerce</p>
    <h1>Your business.<br/>Your money.<br/><span>Your direction.</span></h1>
    <p className="public-intro">DISHA 8.2 helps businesses manage payment operations without taking custody of their money.</p>
    <div className="public-actions"><a className="btn-primary" href="/how-it-works/">Discover DISHA 8.2</a><a className="btn-secondary" href="/payment-cost-calculator/">Calculate your payment costs</a></div>
    <p className="public-note">Non-custodial payment software</p>
  </div>
  <div className="public-hero-art"><PaymentScene/><div className="public-float public-float-top">Payment software<strong>Built for business</strong></div><div className="public-float public-float-bottom">Your payments<strong>Your control</strong></div></div>
</main>

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const skyVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;

  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition + offset).y;
    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
  }
`

export function HemisphereHero() {
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    let disposed = false
    const mixers: THREE.AnimationMixer[] = []

    const background = new THREE.Color().setHSL(0.6, 0, 1)
    const scene = new THREE.Scene()
    scene.background = background
    scene.fog = new THREE.Fog(background, 1, 5000)

    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000)
    camera.position.set(0, 0, 250)

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2)
    hemiLight.color.setHSL(0.6, 1, 0.6)
    hemiLight.groundColor.setHSL(0.095, 1, 0.75)
    hemiLight.position.set(0, 50, 0)
    scene.add(hemiLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 3)
    dirLight.color.setHSL(0.1, 1, 0.95)
    dirLight.position.set(-1, 1.75, 1)
    dirLight.position.multiplyScalar(30)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(2048, 2048)
    const shadowExtent = 50
    dirLight.shadow.camera.left = -shadowExtent
    dirLight.shadow.camera.right = shadowExtent
    dirLight.shadow.camera.top = shadowExtent
    dirLight.shadow.camera.bottom = -shadowExtent
    dirLight.shadow.camera.far = 3500
    dirLight.shadow.bias = -0.0001
    scene.add(dirLight)

    const groundGeo = new THREE.PlaneGeometry(10000, 10000)
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    groundMat.color.setHSL(0.095, 1, 0.75)
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.position.y = -33
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const uniforms = {
      topColor: { value: new THREE.Color(0x0077ff) },
      bottomColor: { value: new THREE.Color(0xffffff) },
      offset: { value: 33 },
      exponent: { value: 0.6 },
    }
    uniforms.topColor.value.copy(hemiLight.color)
    scene.fog.color.copy(uniforms.bottomColor.value)

    const skyGeo = new THREE.SphereGeometry(4000, 32, 15)
    const skyMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
    })
    scene.add(new THREE.Mesh(skyGeo, skyMat))

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.outputColorSpace = THREE.SRGBColorSpace
    stage.appendChild(renderer.domElement)

    const timer = new THREE.Timer()
    timer.connect(document)

    const resize = () => {
      const width = stage.clientWidth
      const height = stage.clientHeight
      if (width === 0 || height === 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)

    const loader = new GLTFLoader()
    loader.load(`${import.meta.env.BASE_URL}models/Flamingo.glb`, (gltf) => {
      if (disposed) return

      const mesh = gltf.scene.children[0]
      const clip = gltf.animations[0]
      if (!mesh || !clip) return

      mesh.scale.setScalar(0.35)
      mesh.position.y = 15
      mesh.rotation.y = -1
      mesh.traverse((child) => {
        child.castShadow = true
        child.receiveShadow = true
      })
      scene.add(mesh)

      const mixer = new THREE.AnimationMixer(mesh)
      mixer.clipAction(clip).setDuration(1).play()
      mixers.push(mixer)
    })

    renderer.setAnimationLoop(() => {
      timer.update()
      const delta = timer.getDelta()
      for (const mixer of mixers) mixer.update(delta)
      renderer.render(scene, camera)
    })

    return () => {
      disposed = true
      observer.disconnect()
      renderer.setAnimationLoop(null)
      timer.disconnect()
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials) material.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <figure className="hemisphere">
      <div
        ref={stageRef}
        className="hemisphere-stage"
        role="img"
        aria-label="Animated flamingo under a hemisphere light"
      />
      <figcaption>Flamingo by mirada from ro.me</figcaption>
    </figure>
  )
}

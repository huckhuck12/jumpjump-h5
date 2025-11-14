import './style.css'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// 游戏配置
const config = {
  jumpFactor: 5,
  maxDistance: 5,
  minDistance: 1.5,
  gravity: -30,
  playerSize: 0.5,
  playerMass: 1,
}

// 游戏状态
let gameState = {
  score: 0,
  isPlaying: false,
  isPressing: false,
  pressStartTime: 0,
  currentStage: null,
  nextStage: null,
  direction: new THREE.Vector3(1, 0, 0),
  lastReward: 1,
  cameraOffset: new THREE.Vector3(5, 5, 5),
  isLanding: false,  // 添加着陆标志，防止重复触发
}

// Three.js 场景设置
let scene, camera, renderer
let playerMesh, playerBody
let world
let stages = []
let particleSystem

// UI 元素
const scoreElement = document.getElementById('score')
const singleScoreElement = document.getElementById('single-score')
const startPanel = document.getElementById('start-panel')
const gameOverPanel = document.getElementById('game-over-panel')
const finalScoreElement = document.getElementById('final-score')
const startBtn = document.getElementById('start-btn')
const restartBtn = document.getElementById('restart-btn')

// 初始化场景
function initScene() {
  // 场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87CEEB)
  scene.fog = new THREE.Fog(0x87CEEB, 10, 50)

  // 相机
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.copy(gameState.cameraOffset)
  camera.lookAt(0, 0, 0)

  // 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  document.getElementById('game-container').appendChild(renderer.domElement)

  // 光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 20, 10)
  directionalLight.castShadow = true
  directionalLight.shadow.camera.left = -20
  directionalLight.shadow.camera.right = 20
  directionalLight.shadow.camera.top = 20
  directionalLight.shadow.camera.bottom = -20
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)

  // 物理世界
  world = new CANNON.World()
  world.gravity.set(0, config.gravity, 0)

  // 添加地面（用于检测游戏结束）
  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    position: new CANNON.Vec3(0, -5, 0),
  })
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  groundBody.userData = { type: 'ground' }
  world.addBody(groundBody)

  // 创建粒子系统
  createParticleSystem()

  // 窗口大小调整
  window.addEventListener('resize', onWindowResize)
}

// 创建粒子系统
function createParticleSystem() {
  const particleCount = 50
  const particles = new THREE.BufferGeometry()
  const positions = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 0.5
  }

  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const particleMaterial = new THREE.PointsMaterial({
    color: 0xFFFFFF,
    size: 0.05,
    transparent: true,
    opacity: 0.8,
  })

  particleSystem = new THREE.Points(particles, particleMaterial)
  particleSystem.visible = false
  scene.add(particleSystem)
}

// 创建玩家
function createPlayer(position) {
  // 玩家网格（身体+头部）
  const bodyGeometry = new THREE.BoxGeometry(config.playerSize, config.playerSize * 2, config.playerSize)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 })
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.castShadow = true
  body.position.y = 0  // 身体中心在Group中心

  const headGeometry = new THREE.SphereGeometry(config.playerSize * 0.6, 16, 16)
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 })
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.castShadow = true
  head.position.y = config.playerSize * 1.3  // 头在身体上方

  playerMesh = new THREE.Group()
  playerMesh.add(body)
  playerMesh.add(head)
  playerMesh.position.copy(position)
  playerMesh.userData = { body, head }
  scene.add(playerMesh)

  // 玩家物理体 - 高度为2个playerSize，底部对齐
  const shape = new CANNON.Box(new CANNON.Vec3(config.playerSize / 2, config.playerSize, config.playerSize / 2))
  playerBody = new CANNON.Body({
    mass: config.playerMass,
    shape: shape,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.3,
    angularDamping: 0.9,  // 增加角速度阻尼，让旋转快速停止
  })
  playerBody.userData = { type: 'player' }
  world.addBody(playerBody)

  // 碰撞检测
  playerBody.addEventListener('collide', onPlayerCollide)
}

// 创建台子
function createStage(position, isFirst = false) {
  const isCircle = !isFirst && Math.random() > 0.5
  const size = isFirst ? 1.5 : Math.random() * 0.5 + 0.8
  const height = 0.5

  let geometry
  if (isCircle) {
    geometry = new THREE.CylinderGeometry(size / 2, size / 2, height, 32)
  } else {
    geometry = new THREE.BoxGeometry(size, height, size)
  }

  const color = new THREE.Color(Math.random(), Math.random(), Math.random())
  const material = new THREE.MeshStandardMaterial({ color })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(position.x, height / 2, position.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  // 物理体
  let shape
  if (isCircle) {
    shape = new CANNON.Cylinder(size / 2, size / 2, height, 32)
  } else {
    shape = new CANNON.Box(new CANNON.Vec3(size / 2, height / 2, size / 2))
  }

  const body = new CANNON.Body({
    mass: 0,
    shape: shape,
    position: new CANNON.Vec3(position.x, height / 2, position.z),
  })
  body.userData = { type: 'stage' }
  world.addBody(body)

  const stageData = { mesh, body, isCircle, size, height }
  stages.push(stageData)
  return stageData
}

// 生成下一个台子
function spawnNextStage() {
  if (!gameState.currentStage) return

  const currentPos = gameState.currentStage.body.position
  const distance = Math.random() * (config.maxDistance - config.minDistance) + config.minDistance

  // 随机方向（X轴或Z轴）
  gameState.direction = Math.random() > 0.5
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1)

  const nextPos = new THREE.Vector3(
    currentPos.x + gameState.direction.x * distance,
    0,
    currentPos.z + gameState.direction.z * distance
  )

  gameState.nextStage = createStage(nextPos)
}

// 玩家碰撞处理
function onPlayerCollide(event) {
  const { body } = event

  if (body.userData.type === 'ground') {
    if (gameState.isPlaying) {
      gameOver()
    }
    return
  }

  if (body.userData.type === 'stage') {
    // 检查是否是新台子且不在着陆状态中
    if (gameState.nextStage && body === gameState.nextStage.body && !gameState.isLanding) {
      // 检查是否只有脚接触（法向量向上）
      const contact = event.contact
      if (contact && Math.abs(contact.ni.y) > 0.9) {
        // 设置着陆标志，防止重复触发
        gameState.isLanding = true
        landOnStage(body, contact)
      } else {
        // 身体碰撞到台子侧面
        if (gameState.isPlaying && !gameState.isLanding) {
          gameOver()
        }
      }
    }
    // 在当前台子上不做处理，允许玩家站立
  }
}

// 成功落在台子上
function landOnStage(stageBody, contact) {
  // 停止玩家的水平速度，保持一点垂直速度让玩家能稳定落在台子上
  playerBody.velocity.set(0, playerBody.velocity.y * 0.3, 0)
  playerBody.angularVelocity.set(0, 0, 0)

  gameState.currentStage = gameState.nextStage
  gameState.nextStage = null

  // 计算精准度
  const hitPoint = new THREE.Vector3(
    contact.bi.position.x,
    0,
    contact.bi.position.z
  )
  const stageCenter = new THREE.Vector3(
    stageBody.position.x,
    0,
    stageBody.position.z
  )
  const precision = hitPoint.distanceTo(stageCenter)

  // 根据精准度计算分数
  if (precision < 0.2) {
    gameState.lastReward *= 2
  } else {
    gameState.lastReward = 1
  }

  gameState.score += gameState.lastReward
  updateScore()
  showScoreAnimation(gameState.lastReward)

  // 生成下一个台子（这会更新 gameState.direction）
  spawnNextStage()

  // 更新玩家朝向，让玩家面向下一个台子的方向
  updatePlayerRotation()

  // 移动相机
  moveCamera()

  // 延迟重置着陆标志，确保玩家稳定落地
  setTimeout(() => {
    gameState.isLanding = false
  }, 100)
}

// 更新玩家朝向
function updatePlayerRotation() {
  // Unity使用 transform.right = _direction
  // 在Three.js中，我们需要让玩家的右侧（局部X轴）指向跳跃方向
  // 这意味着玩家的身体朝向应该垂直于跳跃方向
  
  if (Math.abs(gameState.direction.x) > 0.5) {
    // 跳跃方向是X轴，玩家应该面向Z轴
    // 如果direction.x > 0（向右跳），玩家右侧应该指向+X，所以玩家面向+Z
    playerMesh.rotation.y = gameState.direction.x > 0 ? Math.PI / 2 : -Math.PI / 2
  } else if (Math.abs(gameState.direction.z) > 0.5) {
    // 跳跃方向是Z轴，玩家应该面向X轴
    // 如果direction.z > 0（向前跳），玩家右侧应该指向+Z，所以玩家面向-X
    playerMesh.rotation.y = gameState.direction.z > 0 ? Math.PI : 0
  }
}

// 更新分数显示
function updateScore() {
  scoreElement.textContent = gameState.score
}

// 显示飘分动画
function showScoreAnimation(score) {
  const screenPos = getScreenPosition(playerMesh.position)
  singleScoreElement.textContent = `+${score}`
  singleScoreElement.style.left = screenPos.x + 'px'
  singleScoreElement.style.top = screenPos.y + 'px'
  singleScoreElement.style.opacity = '1'
  singleScoreElement.style.transform = 'translateY(0)'

  setTimeout(() => {
    singleScoreElement.style.opacity = '0'
    singleScoreElement.style.transform = 'translateY(-100px)'
  }, 100)
}

// 获取3D位置的屏幕坐标
function getScreenPosition(position) {
  const vector = position.clone().project(camera)
  return {
    x: (vector.x * 0.5 + 0.5) * window.innerWidth,
    y: (vector.y * -0.5 + 0.5) * window.innerHeight,
  }
}

// 移动相机
function moveCamera() {
  const targetPos = playerMesh.position.clone().add(gameState.cameraOffset)
  animateCameraMove(camera.position, targetPos, 1000)
}

function animateCameraMove(from, to, duration) {
  const startTime = Date.now()

  function update() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOutQuad(progress)

    camera.position.lerpVectors(from, to, eased)
    camera.lookAt(playerMesh.position)

    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  update()
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// 跳跃
function jump(pressTime) {
  const force = pressTime * config.jumpFactor
  const direction = gameState.direction.clone().normalize()
  const impulse = new CANNON.Vec3(
    direction.x * force,
    5,
    direction.z * force
  )

  playerBody.applyImpulse(impulse, playerBody.position)

  // 重置着陆标志，允许下次着陆
  gameState.isLanding = false

  // 隐藏粒子效果
  particleSystem.visible = false

  // 还原压缩效果
  resetSquashEffect()
}


// 蓄力压缩效果
function updateSquashEffect(pressTime) {
  const squashAmount = Math.min(pressTime * 0.3, 0.3)

  // 压缩玩家身体和头部
  const body = playerMesh.userData.body
  const head = playerMesh.userData.head
  body.scale.y = 1 - squashAmount
  // 身体压缩时，需要向下移动以保持底部不变
  body.position.y = -squashAmount * config.playerSize
  // 头部也需要相应下移
  head.position.y = config.playerSize * 1.3 - squashAmount * 2

  // 压缩当前台子
  if (gameState.currentStage) {
    const stageMesh = gameState.currentStage.mesh
    const stageHeight = gameState.currentStage.height
    stageMesh.scale.y = 1 - squashAmount * 0.5
    stageMesh.position.y = stageHeight / 2 * (1 - squashAmount * 0.5)
  }
}

// 还原压缩效果
function resetSquashEffect() {
  const duration = 200
  const startTime = Date.now()

  const body = playerMesh.userData.body
  const head = playerMesh.userData.head
  const startBodyScale = body.scale.y
  const startBodyY = body.position.y
  const startHeadY = head.position.y

  let startStageScale = 1
  let startStageY = 0
  if (gameState.currentStage) {
    startStageScale = gameState.currentStage.mesh.scale.y
    startStageY = gameState.currentStage.mesh.position.y
  }

  function update() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOutQuad(progress)

    body.scale.y = startBodyScale + (1 - startBodyScale) * eased
    body.position.y = startBodyY + (0 - startBodyY) * eased
    head.position.y = startHeadY + (config.playerSize * 1.3 - startHeadY) * eased

    if (gameState.currentStage) {
      const stageMesh = gameState.currentStage.mesh
      const targetY = gameState.currentStage.height / 2
      stageMesh.scale.y = startStageScale + (1 - startStageScale) * eased
      stageMesh.position.y = startStageY + (targetY - startStageY) * eased
    }

    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }

  update()
}

// 游戏结束
function gameOver() {
  gameState.isPlaying = false
  finalScoreElement.textContent = gameState.score
  gameOverPanel.style.display = 'block'
}

// 开始游戏
function startGame() {
  // 重置游戏状态
  gameState.score = 0
  gameState.isPlaying = true
  gameState.isPressing = false
  gameState.lastReward = 1
  updateScore()

  // 清除旧场景
  stages.forEach(stage => {
    scene.remove(stage.mesh)
    world.removeBody(stage.body)
  })
  stages = []

  if (playerMesh) {
    scene.remove(playerMesh)
    world.removeBody(playerBody)
  }

  // 创建初始台子和玩家
  const firstStage = createStage(new THREE.Vector3(0, 0, 0), true)
  gameState.currentStage = firstStage

  // 玩家站在台子上，Y = 台子高度 + 玩家物理体高度（因为物理体中心点在玩家中心）
  // 台子顶部 Y = 0.5，玩家高度 = config.playerSize * 2 = 1.0，所以玩家中心在 0.5 + 0.5 = 1.0
  createPlayer(new THREE.Vector3(0, 1.0, 0))

  // 生成第一个目标台子
  spawnNextStage()

  // 重置相机
  camera.position.copy(gameState.cameraOffset)
  camera.lookAt(0, 0, 0)

  // 隐藏UI面板
  startPanel.style.display = 'none'
  gameOverPanel.style.display = 'none'
}

// 输入处理
let mouseDownTime = 0

function onMouseDown() {
  if (!gameState.isPlaying) return
  gameState.isPressing = true
  mouseDownTime = Date.now()
  particleSystem.visible = true
  particleSystem.position.copy(playerMesh.position)
}

function onMouseUp() {
  if (!gameState.isPlaying || !gameState.isPressing) return
  gameState.isPressing = false

  const pressTime = (Date.now() - mouseDownTime) / 1000
  jump(pressTime)
}

// 窗口大小调整
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// 动画循环
function animate() {
  requestAnimationFrame(animate)

  // 更新物理世界
  world.step(1 / 60)

  // 同步玩家位置
  if (playerMesh && playerBody) {
    playerMesh.position.copy(playerBody.position)
    // 不同步旋转，保持玩家直立
    // playerMesh.quaternion.copy(playerBody.quaternion)

    // 检查玩家是否掉落（Y坐标过低或倾斜过大）
    if (gameState.isPlaying) {
      // 如果玩家掉落到台子下方太多，判定为游戏结束
      if (playerBody.position.y < -2) {
        gameOver()
      }

      // 移除倾斜角度检测，因为玩家不会旋转了
    }
  }

  // 蓄力效果
  if (gameState.isPressing && gameState.isPlaying) {
    const pressTime = (Date.now() - mouseDownTime) / 1000
    updateSquashEffect(pressTime)

    // 更新粒子位置
    if (gameState.currentStage) {
      particleSystem.position.set(
        gameState.currentStage.body.position.x,
        gameState.currentStage.body.position.y + 0.5,
        gameState.currentStage.body.position.z
      )
    }
  }

  renderer.render(scene, camera)
}

// 初始化并启动
initScene()
animate()

// 事件监听
startBtn.addEventListener('click', startGame)
restartBtn.addEventListener('click', startGame)

renderer.domElement.addEventListener('mousedown', onMouseDown)
renderer.domElement.addEventListener('mouseup', onMouseUp)
renderer.domElement.addEventListener('touchstart', onMouseDown)
renderer.domElement.addEventListener('touchend', onMouseUp)

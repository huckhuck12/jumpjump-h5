import './style.css'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// 游戏配置
const config = {
  jumpFactor: 5,
  maxDistance: 5,        // 适度缩短（5 → 4），保留挑战性
  minDistance: 3,      // 适度缩短（1.5 → 1.3）
  gravity: -30,
  playerSize: 0.5,
  playerMass: 1,
  // 跳跃参数优化
  minPressTime: 0.05,    // 降低最小蓄力时间
  maxPressTime: 1.5,     // 添加最大蓄力时间
  horizontalForce: 10,   // 水平力度（增加到10）
  verticalForce: 12,     // 垂直力度（增加到12）
  // 台子尺寸
  minStageSize: 0.9,     // 适度增大（0.8 → 0.9）
  maxStageSize: 1.3,     // 保持挑战性
  // 辅助线配置
  showGuideLine: true,   // 是否显示辅助线
  guideLineOpacity: 0.5, // 辅助线透明度
  // 轨迹预测补偿（小力度时需要的额外系数）
  trajectoryCompensation: 1.0,  // 实际跳跃距离比预测短，需要补偿
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
let cameraAnimationId = null
let squashAnimationId = null
let guideLine = null  // 辅助线

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

  // 创建辅助线
  createGuideLine()

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

// 创建辅助线（从玩家指向预测落点）
function createGuideLine() {
  // 使用更多点来绘制抛物线轨迹
  const segmentCount = 20
  const points = []
  for (let i = 0; i <= segmentCount; i++) {
    points.push(new THREE.Vector3(0, 0, 0))
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color: 0xFFFF00,  // 黄色
    transparent: true,
    opacity: config.guideLineOpacity,
    linewidth: 2,
  })
  guideLine = new THREE.Line(geometry, material)
  guideLine.visible = false
  scene.add(guideLine)
}

// 更新辅助线位置（显示抛物线轨迹）
function updateGuideLine(pressTime = 0) {
  if (!config.showGuideLine || !guideLine || !gameState.nextStage || !playerBody) {
    if (guideLine) guideLine.visible = false
    return
  }

  // 计算当前蓄力时间对应的跳跃参数
  const clampedPressTime = Math.max(config.minPressTime, Math.min(pressTime, config.maxPressTime))
  const pressRatio = Math.sqrt(clampedPressTime / config.maxPressTime)
  const horizontalSpeed = pressRatio * config.horizontalForce
  const verticalSpeed = pressRatio * config.verticalForce

  // 计算跳跃方向
  const playerPos = new THREE.Vector3(
    playerBody.position.x,
    playerBody.position.y,
    playerBody.position.z
  )
  const targetPos = new THREE.Vector3(
    gameState.nextStage.body.position.x,
    0,
    gameState.nextStage.body.position.z
  )
  const direction = new THREE.Vector3().subVectors(targetPos, new THREE.Vector3(playerPos.x, 0, playerPos.z)).normalize()

  // 计算初始速度（加入补偿系数）
  // 小力度时需要更大的补偿，大力度时补偿较小
  const compensation = config.trajectoryCompensation - (pressRatio * 0.15)  // 力度越大，补偿越小
  let vx = direction.x * horizontalSpeed * compensation
  let vy = verticalSpeed
  let vz = direction.z * horizontalSpeed * compensation

  // 绘制抛物线轨迹（模拟物理引擎的实际行为）
  const segmentCount = 20
  const positions = guideLine.geometry.attributes.position.array
  const physicsStep = 1 / 60  // 物理引擎的固定时间步长
  const stepsPerSegment = 3  // 每段轨迹模拟3个物理步
  const damping = 0.3    // 线性阻尼（与playerBody一致）

  let currentX = playerPos.x
  let currentY = playerPos.y + 0.1  // 加上跳跃时的向上偏移
  let currentZ = playerPos.z

  for (let i = 0; i <= segmentCount; i++) {
    positions[i * 3] = currentX
    positions[i * 3 + 1] = currentY
    positions[i * 3 + 2] = currentZ

    // 如果落到台子高度以下，停止绘制
    if (currentY <= 0.5) {
      // 剩余的点都设置到最后一个点
      for (let j = i + 1; j <= segmentCount; j++) {
        positions[j * 3] = currentX
        positions[j * 3 + 1] = 0.5
        positions[j * 3 + 2] = currentZ
      }
      break
    }

    // 模拟多个物理步（更准确）
    for (let step = 0; step < stepsPerSegment; step++) {
      // 更新速度（重力）
      vy += config.gravity * physicsStep

      // 阻尼（Cannon.js的阻尼：v *= 1 - damping * dt）
      const dampingFactor = 1 - damping * physicsStep
      vx *= dampingFactor
      vz *= dampingFactor

      // 更新位置
      currentX += vx * physicsStep
      currentY += vy * physicsStep
      currentZ += vz * physicsStep
    }
  }

  guideLine.geometry.attributes.position.needsUpdate = true
  guideLine.visible = true
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
  // 使用config中的配置，增大台子尺寸
  const size = isFirst ? 1.5 : Math.random() * (config.maxStageSize - config.minStageSize) + config.minStageSize
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

  // 使用台子的中心位置（Y=0的平面投影）
  const currentPos = gameState.currentStage.body.position
  const currentCenter = new THREE.Vector3(currentPos.x, 0, currentPos.z)
  const distance = Math.random() * (config.maxDistance - config.minDistance) + config.minDistance

  // 随机选择轴向和方向，但避免往回跳
  let newDirection
  do {
    const axis = Math.random() > 0.5 ? 'x' : 'z'
    const sign = Math.random() > 0.5 ? 1 : -1
    newDirection = axis === 'x'
      ? new THREE.Vector3(sign, 0, 0)
      : new THREE.Vector3(0, 0, sign)
  } while (newDirection.dot(gameState.direction) < -0.5) // 避免方向相反

  const nextPos = new THREE.Vector3(
    currentCenter.x + newDirection.x * distance,
    0,
    currentCenter.z + newDirection.z * distance
  )

  gameState.nextStage = createStage(nextPos)

  // 更新跳跃方向为指向新台子的方向（归一化到轴向）
  gameState.direction = newDirection
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

  // 关键修复：保存旧的nextStage，它将成为新的currentStage
  const newCurrentStage = gameState.nextStage

  // 临时更新currentStage用于生成新台子（但不影响gameState.nextStage）
  const tempCurrentStage = gameState.currentStage
  gameState.currentStage = newCurrentStage

  // 基于新的currentStage生成下一个台子（这会更新gameState.nextStage）
  spawnNextStage()

  // 计算精准度 - 使用正确的碰撞点
  const contactPoint = new CANNON.Vec3()
  contact.bi.pointToWorldFrame(contact.ri, contactPoint)

  const hitPoint = new THREE.Vector3(
    contactPoint.x,
    0,
    contactPoint.z
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

  // 然后根据玩家当前位置和新台子位置更新玩家朝向
  if (gameState.nextStage) {
    const playerPos = new THREE.Vector3(
      playerBody.position.x,
      0,
      playerBody.position.z
    )
    const targetPos = new THREE.Vector3(
      gameState.nextStage.body.position.x,
      0,
      gameState.nextStage.body.position.z
    )
    // 计算实际方向并更新玩家朝向
    const actualDirection = new THREE.Vector3().subVectors(targetPos, playerPos).normalize()
    const angle = Math.atan2(-actualDirection.z, actualDirection.x)
    playerMesh.rotation.y = angle
  }

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
  // 默认情况下，Three.js中物体的右侧是+X，前方是-Z
  // 我们需要计算从默认右侧(1,0,0)到目标方向的旋转角度

  const angle = Math.atan2(gameState.direction.z, gameState.direction.x)
  playerMesh.rotation.y = angle
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
  animateCameraMove(camera.position.clone(), targetPos, 1000)
}

function animateCameraMove(from, to, duration) {
  // 取消之前的相机动画，防止冲突
  if (cameraAnimationId) {
    cancelAnimationFrame(cameraAnimationId)
    cameraAnimationId = null
  }

  const startTime = Date.now()

  function update() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = easeInOutQuad(progress)

    camera.position.lerpVectors(from, to, eased)
    camera.lookAt(playerMesh.position)

    if (progress < 1) {
      cameraAnimationId = requestAnimationFrame(update)
    } else {
      cameraAnimationId = null
    }
  }

  update()
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// 跳跃
function jump(pressTime) {
  // 限制蓄力时间范围，提供更好的手感
  const clampedPressTime = Math.max(config.minPressTime, Math.min(pressTime, config.maxPressTime))

  // 使用平方根曲线使手感更线性（物理距离 ∝ v²，所以用√让手感线性化）
  const pressRatio = Math.sqrt(clampedPressTime / config.maxPressTime)

  // 根据玩家当前位置和目标台子位置计算实际跳跃方向
  let direction
  if (gameState.nextStage) {
    const playerPos = new THREE.Vector3(
      playerBody.position.x,
      0,
      playerBody.position.z
    )
    const targetPos = new THREE.Vector3(
      gameState.nextStage.body.position.x,
      0,
      gameState.nextStage.body.position.z
    )

    // 计算从玩家当前位置到目标台子的方向
    direction = new THREE.Vector3().subVectors(targetPos, playerPos).normalize()
  } else {
    // 如果没有目标台子，使用预设方向
    direction = gameState.direction.clone().normalize()
  }

  // 根据蓄力比例计算速度（线性插值）
  const horizontalSpeed = pressRatio * config.horizontalForce
  const verticalSpeed = pressRatio * config.verticalForce

  // 关键修复：先将玩家位置向上提升一点点，脱离台子表面
  // 这样可以避免碰撞力立即抵消速度
  playerBody.position.y += 0.1

  // 直接设置速度
  playerBody.velocity.set(
    direction.x * horizontalSpeed,
    verticalSpeed,
    direction.z * horizontalSpeed
  )

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
  // 取消之前的还原动画，防止冲突
  if (squashAnimationId) {
    cancelAnimationFrame(squashAnimationId)
    squashAnimationId = null
  }

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
      squashAnimationId = requestAnimationFrame(update)
    } else {
      squashAnimationId = null
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

  // 清除旧场景（包括释放内存）
  stages.forEach(stage => {
    scene.remove(stage.mesh)
    world.removeBody(stage.body)
    // 释放几何体和材质，防止内存泄漏
    if (stage.mesh.geometry) stage.mesh.geometry.dispose()
    if (stage.mesh.material) stage.mesh.material.dispose()
  })
  stages = []

  if (playerMesh) {
    scene.remove(playerMesh)
    world.removeBody(playerBody)
    // 释放玩家的几何体和材质
    playerMesh.userData.body.geometry.dispose()
    playerMesh.userData.body.material.dispose()
    playerMesh.userData.head.geometry.dispose()
    playerMesh.userData.head.material.dispose()
  }

  // 创建初始台子和玩家
  const firstStage = createStage(new THREE.Vector3(0, 0, 0), true)
  gameState.currentStage = firstStage

  // 玩家站在台子上，Y = 台子高度 + 玩家物理体高度（因为物理体中心点在玩家中心）
  // 台子顶部 Y = 0.5，玩家高度 = config.playerSize * 2 = 1.0，所以玩家中心在 0.5 + 0.5 = 1.0
  createPlayer(new THREE.Vector3(0, 1.0, 0))

  // 生成第一个目标台子
  spawnNextStage()

  // 初始化玩家朝向，根据玩家位置和目标台子计算
  if (gameState.nextStage) {
    const playerPos = new THREE.Vector3(0, 0, 0)
    const targetPos = new THREE.Vector3(
      gameState.nextStage.body.position.x,
      0,
      gameState.nextStage.body.position.z
    )
    const actualDirection = new THREE.Vector3().subVectors(targetPos, playerPos).normalize()
    const angle = Math.atan2(-actualDirection.z, actualDirection.x)
    playerMesh.rotation.y = angle
  }

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

  // 检查玩家是否在台子上（位置检查而非速度检查）
  if (gameState.currentStage) {
    const stageTop = gameState.currentStage.body.position.y + gameState.currentStage.height / 2
    const onStage = Math.abs(playerBody.position.y - stageTop - config.playerSize) < 0.15

    // 只有站在台子上才能蓄力
    if (!onStage) return
  }

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

    // 只有在台子上时才锁定水平位置（检查Y位置接近台子高度）
    if (gameState.isPlaying && gameState.currentStage) {
      const stageTop = gameState.currentStage.body.position.y + gameState.currentStage.height / 2
      const onStage = Math.abs(playerBody.position.y - stageTop - config.playerSize) < 0.1

      // 只有确实站在台子上时才清零水平速度
      if (onStage && Math.abs(playerBody.velocity.y) < 0.5) {
        playerBody.velocity.x = 0
        playerBody.velocity.z = 0
        playerBody.angularVelocity.set(0, 0, 0)
      }
    }

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

    // 更新粒子位置（跟随玩家而非台子中心）
    if (playerMesh) {
      particleSystem.position.set(
        playerMesh.position.x,
        playerMesh.position.y - config.playerSize,
        playerMesh.position.z
      )
    }

    // 更新辅助线（传入当前蓄力时间）
    updateGuideLine(pressTime)
  } else {
    // 不蓄力时隐藏辅助线
    if (guideLine) guideLine.visible = false
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

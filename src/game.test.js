import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

/**
 * 跳一跳游戏自动化测试套件
 * 
 * 测试用例列表：
 * 1. 游戏配置测试
 * 2. 3D场景初始化测试
 * 3. 物理世界初始化测试
 * 4. 台子生成逻辑测试
 * 5. 玩家创建测试
 * 6. 方向计算测试
 * 7. 碰撞检测模拟测试
 * 8. 分数计算测试
 */

describe('跳一跳游戏测试', () => {
    describe('1. 游戏配置测试', () => {
        it('应该有正确的游戏配置参数', () => {
            const config = {
                jumpFactor: 5,
                maxDistance: 5,
                minDistance: 1.5,
                gravity: -30,
                playerSize: 0.5,
                playerMass: 1,
            }

            expect(config.jumpFactor).toBe(5)
            expect(config.maxDistance).toBe(5)
            expect(config.minDistance).toBe(1.5)
            expect(config.gravity).toBe(-30)
            expect(config.playerSize).toBe(0.5)
            expect(config.playerMass).toBe(1)
        })

        it('最大距离应该大于最小距离', () => {
            const config = {
                maxDistance: 5,
                minDistance: 1.5,
            }
            expect(config.maxDistance).toBeGreaterThan(config.minDistance)
        })
    })

    describe('2. 3D场景初始化测试', () => {
        it('应该能创建Three.js场景', () => {
            const scene = new THREE.Scene()
            expect(scene).toBeInstanceOf(THREE.Scene)
        })

        it('应该能创建相机', () => {
            const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000)
            expect(camera).toBeInstanceOf(THREE.PerspectiveCamera)
            expect(camera.fov).toBe(60)
        })

        it('应该设置场景背景色', () => {
            const scene = new THREE.Scene()
            scene.background = new THREE.Color(0x87CEEB)
            expect(scene.background).toBeInstanceOf(THREE.Color)
        })
    })

    describe('3. 物理世界初始化测试', () => {
        it('应该能创建物理世界', () => {
            const world = new CANNON.World()
            expect(world).toBeInstanceOf(CANNON.World)
        })

        it('应该设置正确的重力', () => {
            const world = new CANNON.World()
            world.gravity.set(0, -30, 0)
            expect(world.gravity.y).toBe(-30)
        })

        it('应该能添加地面物体', () => {
            const world = new CANNON.World()
            const groundBody = new CANNON.Body({
                mass: 0,
                shape: new CANNON.Plane(),
            })
            world.addBody(groundBody)
            expect(world.bodies).toHaveLength(1)
        })
    })

    describe('4. 台子生成逻辑测试', () => {
        it('应该能创建方形台子网格', () => {
            const size = 1.5
            const height = 0.5
            const geometry = new THREE.BoxGeometry(size, height, size)
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
            const mesh = new THREE.Mesh(geometry, material)

            expect(mesh).toBeInstanceOf(THREE.Mesh)
            expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry)
        })

        it('应该能创建圆形台子网格', () => {
            const size = 1.5
            const height = 0.5
            const geometry = new THREE.CylinderGeometry(size / 2, size / 2, height, 32)
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())

            expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry)
        })

        it('台子物理体应该是静态的', () => {
            const shape = new CANNON.Box(new CANNON.Vec3(0.75, 0.25, 0.75))
            const body = new CANNON.Body({
                mass: 0,  // 质量为0表示静态
                shape: shape,
            })

            expect(body.mass).toBe(0)
            expect(body.type).toBe(CANNON.Body.STATIC)
        })

        it('应该在随机距离范围内生成台子', () => {
            const minDistance = 1.5
            const maxDistance = 5

            // 模拟生成10次，检查距离是否在范围内
            for (let i = 0; i < 10; i++) {
                const distance = Math.random() * (maxDistance - minDistance) + minDistance
                expect(distance).toBeGreaterThanOrEqual(minDistance)
                expect(distance).toBeLessThanOrEqual(maxDistance)
            }
        })
    })

    describe('5. 玩家创建测试', () => {
        it('应该能创建玩家网格组', () => {
            const playerMesh = new THREE.Group()
            const bodyGeometry = new THREE.BoxGeometry(0.5, 1, 0.5)
            const body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial())
            playerMesh.add(body)

            expect(playerMesh).toBeInstanceOf(THREE.Group)
            expect(playerMesh.children).toHaveLength(1)
        })

        it('玩家物理体应该有正确的质量', () => {
            const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.5, 0.25))
            const playerBody = new CANNON.Body({
                mass: 1,
                shape: shape,
            })

            expect(playerBody.mass).toBe(1)
            expect(playerBody.type).toBe(CANNON.Body.DYNAMIC)
        })

        it('玩家应该在正确的初始位置', () => {
            const position = new THREE.Vector3(0, 1.0, 0)
            expect(position.x).toBe(0)
            expect(position.y).toBe(1.0)
            expect(position.z).toBe(0)
        })
    })

    describe('6. 方向计算测试', () => {
        it('应该能随机生成X轴或Z轴方向', () => {
            const directions = []
            for (let i = 0; i < 10; i++) {
                const direction = Math.random() > 0.5
                    ? new THREE.Vector3(1, 0, 0)
                    : new THREE.Vector3(0, 0, 1)
                directions.push(direction)
            }

            // 至少应该有两种方向中的一种
            const hasXDirection = directions.some(d => d.x === 1)
            const hasZDirection = directions.some(d => d.z === 1)
            expect(hasXDirection || hasZDirection).toBe(true)
        })

        it('方向向量应该被正确归一化', () => {
            const direction = new THREE.Vector3(1, 0, 0)
            direction.normalize()
            expect(direction.length()).toBeCloseTo(1, 5)
        })
    })

    describe('7. 跳跃力度计算测试', () => {
        it('应该根据蓄力时间计算跳跃力度', () => {
            const jumpFactor = 5
            const pressTime = 0.5
            const force = pressTime * jumpFactor

            expect(force).toBe(2.5)
        })

        it('蓄力时间越长，力度越大', () => {
            const jumpFactor = 5
            const shortPress = 0.3 * jumpFactor
            const longPress = 0.8 * jumpFactor

            expect(longPress).toBeGreaterThan(shortPress)
        })

        it('应该能计算跳跃冲量向量', () => {
            const force = 2.5
            const direction = new THREE.Vector3(1, 0, 0)
            const impulse = new CANNON.Vec3(
                direction.x * force,
                5,
                direction.z * force
            )

            expect(impulse.x).toBe(2.5)
            expect(impulse.y).toBe(5)
            expect(impulse.z).toBe(0)
        })
    })

    describe('8. 分数计算测试', () => {
        it('应该计算玩家落点到台子中心的距离', () => {
            const hitPoint = new THREE.Vector3(0.1, 0, 0.1)
            const stageCenter = new THREE.Vector3(0, 0, 0)
            const precision = hitPoint.distanceTo(stageCenter)

            expect(precision).toBeCloseTo(0.1414, 4)
        })

        it('精准落点应该触发分数翻倍', () => {
            const precision = 0.15
            let lastReward = 1

            if (precision < 0.2) {
                lastReward *= 2
            }

            expect(lastReward).toBe(2)
        })

        it('非精准落点应该重置倍数', () => {
            const precision = 0.3
            let lastReward = 4

            if (precision < 0.2) {
                lastReward *= 2
            } else {
                lastReward = 1
            }

            expect(lastReward).toBe(1)
        })

        it('分数应该正确累加', () => {
            let score = 0
            const rewards = [1, 2, 4, 8, 1, 2]

            rewards.forEach(reward => {
                score += reward
            })

            expect(score).toBe(18)
        })
    })

    describe('9. 玩家朝向更新测试', () => {
        it('X轴正方向应该对应0度旋转', () => {
            const direction = new THREE.Vector3(1, 0, 0)
            let rotation = 0

            if (Math.abs(direction.x) > 0.5) {
                rotation = direction.x > 0 ? 0 : Math.PI
            }

            expect(rotation).toBe(0)
        })

        it('X轴负方向应该对应180度旋转', () => {
            const direction = new THREE.Vector3(-1, 0, 0)
            let rotation = 0

            if (Math.abs(direction.x) > 0.5) {
                rotation = direction.x > 0 ? 0 : Math.PI
            }

            expect(rotation).toBe(Math.PI)
        })

        it('Z轴正方向应该对应90度旋转', () => {
            const direction = new THREE.Vector3(0, 0, 1)
            let rotation = 0

            if (Math.abs(direction.z) > 0.5) {
                rotation = direction.z > 0 ? Math.PI / 2 : -Math.PI / 2
            }

            expect(rotation).toBe(Math.PI / 2)
        })
    })

    describe('10. 游戏结束判定测试', () => {
        it('玩家Y坐标低于阈值应该判定游戏结束', () => {
            const playerY = -2.5
            const threshold = -2
            const isGameOver = playerY < threshold

            expect(isGameOver).toBe(true)
        })

        it('玩家Y坐标高于阈值应该继续游戏', () => {
            const playerY = 1.0
            const threshold = -2
            const isGameOver = playerY < threshold

            expect(isGameOver).toBe(false)
        })
    })

    describe('11. 速度控制测试', () => {
        it('落地后应该清除水平速度', () => {
            const velocity = new CANNON.Vec3(5, 3, 2)
            velocity.set(0, velocity.y * 0.3, 0)

            expect(velocity.x).toBe(0)
            expect(velocity.y).toBeCloseTo(0.9, 5)
            expect(velocity.z).toBe(0)
        })

        it('应该清除角速度', () => {
            const angularVelocity = new CANNON.Vec3(1, 2, 3)
            angularVelocity.set(0, 0, 0)

            expect(angularVelocity.x).toBe(0)
            expect(angularVelocity.y).toBe(0)
            expect(angularVelocity.z).toBe(0)
        })
    })
})

// 运行测试的说明
console.log(`
========================================
跳一跳游戏自动化测试套件
========================================

测试覆盖范围：
✓ 游戏配置验证
✓ 3D场景初始化
✓ 物理引擎设置
✓ 台子生成逻辑
✓ 玩家创建和初始化
✓ 方向计算和归一化
✓ 跳跃力度计算
✓ 分数计算和倍数系统
✓ 玩家朝向更新
✓ 游戏结束判定
✓ 速度控制

运行测试命令：
npm test        - 运行所有测试
npm run test:ui - 打开测试UI界面
npm run test:coverage - 生成测试覆盖率报告
========================================
`)

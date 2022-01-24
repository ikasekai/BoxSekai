class BoxSekai {
  constructor(canvas) {
    if (canvas instanceof HTMLElement && canvas.tagName === 'CANVAS') {
      this.canvas_render = canvas
    } else if (typeof canvas === 'string') {
      const domElm = document.querySelector(canvas)
      if (domElm && domElm.tagName === 'CANVAS') {
        this.canvas_render = domElm
      }
    } else {
      throw 'no canvas'
    }
    this.initParams()
    this.init()
  }
  initParams() {
    this.inputDirection = { fb: 0, rl: 0 } //fb:foward-back, rl:right-left
    this.inputJump = false
    this.listCollisionMesh = []
    this.listClickableMesh = []

    this.MOVE_SPEED = 200
    this.JUMP_SPEED = 200
    this.AIR_FRICTION = 0.5
    this.CLIMB_HEIGHT = 12
    this.PLAYER_HEIGHT = 38
    this.PLAYER_RADIUS = 6
    this.CAMERA_EYE_HEIGHT = 50
    this.GRAVITY = 4
    this.INTERVAL_JUMP = 0.3

    this.RADIAN = {
      d90: 90 * (Math.PI / 180),
      d180: 180 * (Math.PI / 180),
      d270: 270 * (Math.PI / 180),
    }
    this.player = {
      obj: null,
      status: {
        name: '',
        texture: null,
      },
      velocity: { y: 0 },
    }
    this.clock = new THREE.Clock()
    this.positionRolllback = { x: 0, y: 0, z: 0 }
    this.playerVelocity = new THREE.Vector3()
    this.playerDirection = new THREE.Vector3()
    this.vectorMove = new THREE.Vector3()
  }
  init() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#87ceeb')
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas_render,
      antialias: true,
    })
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 2000)
    this.camera.position.set(0, 0, 0)
    this.resizeRenderer()

    this.addEnvLight()
    this.addFloor()
    this.addDirectionBlock()
    this.addPlayerObj()
    this.animate()
    this.setUpEventListner()
  }
  setUpEventListner() {
    document.addEventListener('mousedown', () => {
      this.dragStart = true
      this.canvas_width = this.canvas_render.offsetWidth
      this.canvas_height = this.canvas_render.offsetHeight
    })

    document.body.addEventListener('mousemove', (event) => {
      if (this.dragStart) {
        this.player.obj.rotation.y +=
          ((Math.PI * event.movementX) / this.canvas_width) * 2
        const rotateX =
          this.player.objTilt.rotation.x +
          ((Math.PI * event.movementY) / this.canvas_height) * 2
        this.player.objTilt.rotation.x = THREE.MathUtils.clamp(
          rotateX,
          -1.5,
          1.5
        )
      }
    })

    document.addEventListener('mouseup', () => {
      this.dragStart = false
    })
  }
  addPlayerObj() {
    /*
    const geometryGuide = new THREE.BoxGeometry(1,1,1)
    const materialRed = new THREE.MeshBasicMaterial({ color: 'red' })
    const mesh = new THREE.Mesh(geometryGuide, materialRed)
    this.scene.add(mesh)
    */
    this.player.obj = new THREE.Object3D()
    this.player.objTilt = new THREE.Object3D()
    this.player.objTilt.position.y = this.CAMERA_EYE_HEIGHT
    //this.player.objTilt.add(mesh)

    this.player.objCameraAttachPoint = new THREE.Object3D()
    this.player.objCameraAttachPoint.position.z = -150
    this.player.objCameraAttachPoint.add(this.camera)

    this.player.objTilt.add(this.player.objCameraAttachPoint)

    this.player.obj.add(this.player.objTilt)

    const size = new THREE.Vector3(
      this.PLAYER_RADIUS * 2,
      this.PLAYER_HEIGHT,
      this.PLAYER_RADIUS * 2
    )
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)

    const material = new THREE.MeshBasicMaterial({ color: 'gray' })

    this.player.obj.add(this.generateDirectionBox())
    //this.player.obj.add(mesh)

    const bbox = new THREE.Mesh(geometry, material)
    bbox.position.y = this.PLAYER_HEIGHT / 2

    this.player.bbox = bbox
    this.player.bbox.geometry.computeBoundingBox()

    this.player.objBbox = new THREE.Object3D()
    this.player.objBbox.add(bbox)
    this.scene.add(this.player.objBbox)

    this.player.box3 = new THREE.Box3()
    this.player.box3climb = new THREE.Box3()

    this.playerUpdateBox3()
    this.player.collision = []

    for (let row = 0; row < 2; row++) {
      const rowData = []
      for (let col = 0; col < 2; col++) {
        const rayOffsetX = this.PLAYER_RADIUS * 0.99 * (col === 0 ? 1 : -1)
        const rayOffsetZ = this.PLAYER_RADIUS * 0.99 * (row === 0 ? 1 : -1)
        const colData = {
          box3: new THREE.Box3(),
          raycaster: new THREE.Raycaster(),
          rayOffsetX: rayOffsetX,
          rayOffsetZ: rayOffsetZ,
        }
        colData.raycaster.ray.direction.set(0, -1, 0)
        colData.raycaster.far = this.CLIMB_HEIGHT
        rowData.push(colData)
      }
      this.player.collision.push(rowData)
    }

    this.box3helper = new THREE.Box3Helper(this.player.box3, 0xffff00)
    this.scene.add(this.box3helper)

    //this.player.obj.add(this.player.bbox)
    this.player.obj.rotation.y = this.RADIAN.d180
    this.player.onFloor = false
    this.scene.add(this.player.obj)

    this.player.raycasters = {}

    this.player.raycasters.down = new THREE.Raycaster()
    this.player.raycasters.down
    this.player.raycasters.down.ray.origin.x = 0
    this.player.raycasters.down.ray.origin.y = 10
    this.player.raycasters.down.ray.origin.z = 0
    this.player.raycasters.down.ray.direction.set(0, -1, 0)
    this.player.raycasters.down.far = 10
    this.player.onFloor = false
    this.player.jumpStartY = 0
    this.player.jumpIntervalClock = new THREE.Clock()
    this.player.jumpIntervalClock.getDelta()
  }
  playerUpdateBox3() {
    this.setPlayerBox3(this.player.objBbox.position)
  }
  setPlayerBox3(position) {
    const min = {
      x: position.x - this.PLAYER_RADIUS,
      y: position.y,
      z: position.z - this.PLAYER_RADIUS,
    }
    const max = {
      x: position.x + this.PLAYER_RADIUS,
      y: position.y + this.PLAYER_HEIGHT,
      z: position.z + this.PLAYER_RADIUS,
    }
    this.player.box3.set(min, max)
    min.y
    this.player.box3climb.set(min, max)
  }
  getFloor() {
    this.player.raycasters.down.ray.origin.x = this.player.obj.position.x
    this.player.raycasters.down.ray.origin.y = this.player.obj.position.y + 10
    this.player.raycasters.down.ray.origin.z = this.player.obj.position.z

    const raycastFloor = this.player.raycasters.down.intersectObjects(
      this.listCollisionMesh
    )
    return raycastFloor
  }
  animate() {
    requestAnimationFrame(this.animate.bind(this))
    this.applyPlayerOperate()
    this.renderer.render(this.scene, this.camera)
  }
  box3collisionPushBack(
    startPosition,
    moveDistanceVect,
    mesh,
    enableStepClimb
  ) {
    const destination = {
      x: startPosition.x + moveDistanceVect.x,
      y: startPosition.y + moveDistanceVect.y,
      z: startPosition.z + moveDistanceVect.z,
    }
    this.setPlayerBox3(destination)
    const box3 = mesh.userData.box3
    const result = this.player.box3.intersectsBox(box3)

    if (result) {
      //return false
    }
    const center = mesh.position

    const dirX = this.player.objBbox.position.x >= center.x ? 1 : -1
    const dirY = this.player.objBbox.position.y >= center.y ? 1 : -1
    const dirZ = this.player.objBbox.position.z >= center.z ? 1 : -1

    const pushX =
      dirX === 1
        ? box3.max.x - this.player.box3.min.x
        : box3.min.x - this.player.box3.max.x
    const pushY =
      dirY === 1
        ? box3.max.y - this.player.box3.min.y
        : box3.min.y - this.player.box3.max.y
    const pushZ =
      dirZ === 1
        ? box3.max.z - this.player.box3.min.z
        : box3.min.z - this.player.box3.max.z

    const absX = Math.abs(pushX)
    const absY = Math.abs(pushY)
    const absZ = Math.abs(pushZ)

    const collisionFace = {
      direction: { x: 0, y: 0, z: 0 },
      facePosition: { x: null, y: null, z: null },
      push: { x: 0, y: 0, z: 0 },
      abs: { x: 0, y: 0, z: 0 },
      climbX: false,
      climbZ: false,
      interruptClimbX: false,
      interruptClimbZ: false,
      climbHeightX: 0,
      climbHeightZ: 0,
      climbFacePositionX: null,
      climbFacePositionZ: null,
    }
    if (this.player.box3.min.y + this.CLIMB_HEIGHT < box3.max.y) {
      if (absX < absZ) {
        collisionFace.interruptClimbX = true
      }
      if (absZ < absX) {
        collisionFace.interruptClimbZ = true
      }
    }

    if (absY < absX && absY < absZ) {
      collisionFace.direction.y = dirY
      collisionFace.facePosition.y = dirY === 1 ? box3.max.y : box3.min.y
      collisionFace.push.y = pushY
      collisionFace.abs.y = absY
    } else if (absX < absY && absX < absZ) {
      collisionFace.direction.x = dirX
      collisionFace.facePosition.x = dirX === 1 ? box3.max.x : box3.min.x
      collisionFace.push.x = pushX
      collisionFace.abs.x = absX
    } else if (absZ < absY && absZ < absX) {
      collisionFace.direction.z = dirZ
      collisionFace.facePosition.z = dirZ === 1 ? box3.max.z : box3.min.z
      collisionFace.push.z = pushZ
      collisionFace.abs.z = absZ
    }

    if (enableStepClimb && this.player.onFloor) {
      const climbHeight = box3.max.y - this.player.box3.min.y
      if (
        climbHeight <= this.CLIMB_HEIGHT &&
        climbHeight > 0 &&
        absX > 0 &&
        absZ > 0
      ) {
        /*
        if (moveDistanceVect.z != 0) {
          console.log('comp')
          console.log(moveDistanceVect.x, moveDistanceVect.z)
          console.log(pushX,pushZ)
          console.log(compareX, compareZ)
          console.log(compareX > compareZ)
        }
        */
        const compareX = absX - Math.abs(moveDistanceVect.x)
        const compareZ = absZ - Math.abs(moveDistanceVect.z)
        //collisionFace.direction.y = dirY
        /*
        if (compareX < compareZ && compareX > 0) {
          console.log('compare')
          console.log(absX, absZ)
          console.log(moveDistanceVect.x, moveDistanceVect.z)
          console.log(compareX, compareZ)
  
        }
        if (compareX < compareZ && compareX > 0) {
          console.log('X')
        }

        if (compareZ < compareX && compareZ > 0) {
          console.log('Z')
        }
*/
        if (compareX < compareZ && compareX > -0.001) {
          collisionFace.climbX = true
          collisionFace.climbHeightX = absY
          collisionFace.climbFacePositionX = box3.max.y
        }
        if (compareZ < compareX && compareZ > -0.001) {
          collisionFace.climbZ = true
          collisionFace.climbHeightZ = absY
          collisionFace.climbFacePositionZ = box3.max.y
        }
      }
    }

    if (mesh.name == 'stepBig2') {
      //if (mesh.name == 'stepBig2' && collisionFace.climbFacePositionX != null) {
      //console.log(collisionFace)
      //console.log(box3, this.player.box3)
      //console.log(absX, absY, absZ)
    }

    if (mesh.name != 'floor') {
      //console.log('pushY', collisionFace.facePosition.y)
    }

    return collisionFace
  }
  collisionTest(startPosition, moveDistanceVect, enableStepClimb = false) {
    //const box = new THREE.Box3();
    const collisionTestResult = {
      position: {
        x: startPosition.x,
        y: startPosition.y,
        z: startPosition.z,
      },
    }
    const moveDestination = {
      x: startPosition.x + moveDistanceVect.x,
      y: startPosition.y + moveDistanceVect.y,
      z: startPosition.z + moveDistanceVect.z,
    }
    this.setPlayerBox3(moveDestination)
    const detectMeshList = []
    const collisionFace = {
      direction: { x: 0, y: 0, z: 0 },
      facePosition: { x: null, y: null, z: null },
      push: { x: null, y: null, z: null },
      abs: { x: 0, y: 0, z: 0 },
      interruptClimbX: false,
      interruptClimbZ: false,
      climbHeightX: 0,
      climbHeightZ: 0,
      climbFacePositionX: null,
      climbFacePositionZ: null,
    }
    for (let i = 0, il = this.listCollisionMesh.length; i < il; i++) {
      const box3 = this.listCollisionMesh[i].userData.box3
      const result = this.player.box3.intersectsBox(box3)

      if (result == false) {
        continue
      }
      // 対象box3のAABB判定で一番小さい押し返しを取得
      const tmpCollisionFace = this.box3collisionPushBack(
        startPosition,
        moveDistanceVect,
        this.listCollisionMesh[i],
        enableStepClimb
      )
      if (tmpCollisionFace == false) {
        continue
      }

      if (
        this.listCollisionMesh[i].name == 'stepBig2' &&
        tmpCollisionFace.climbFacePositionX != null
      ) {
        //console.log(this.listCollisionMesh[i].name)
        //console.log(tmpCollisionFace)
      }

      // Y方向は段差乗り越えがあるので分岐処理有
      if (
        tmpCollisionFace.climbX == false &&
        tmpCollisionFace.climbZ == false &&
        tmpCollisionFace.direction.y != 0 &&
        tmpCollisionFace.abs.y > collisionFace.abs.y
      ) {
        collisionFace.direction.y = tmpCollisionFace.direction.y
        collisionFace.facePosition.y = tmpCollisionFace.facePosition.y
        collisionFace.push.y = tmpCollisionFace.push.y
        collisionFace.abs.y = tmpCollisionFace.abs.y
      }

      if (tmpCollisionFace.climbX == true) {
        collisionFace.climbHeightX = tmpCollisionFace.abs.y
        collisionFace.climbFacePositionX = tmpCollisionFace.climbFacePositionX
      }
      if (tmpCollisionFace.climbZ == true) {
        collisionFace.climbHeightZ = tmpCollisionFace.abs.y
        collisionFace.climbFacePositionZ = tmpCollisionFace.climbFacePositionZ
      }

      if (tmpCollisionFace.interruptClimbX == true) {
        collisionFace.interruptClimbX = true
      }
      if (tmpCollisionFace.interruptClimbZ == true) {
        collisionFace.interruptClimbZ = true
      }

      if (
        tmpCollisionFace.direction.x != 0 &&
        tmpCollisionFace.abs.x > collisionFace.abs.x
      ) {
        collisionFace.direction.x = tmpCollisionFace.direction.x
        collisionFace.facePosition.x = tmpCollisionFace.facePosition.x
        collisionFace.push.x = tmpCollisionFace.push.x
        collisionFace.abs.x = tmpCollisionFace.abs.x
      }

      if (
        tmpCollisionFace.direction.z != 0 &&
        tmpCollisionFace.abs.z > collisionFace.abs.z
      ) {
        collisionFace.direction.z = tmpCollisionFace.direction.z
        collisionFace.facePosition.z = tmpCollisionFace.facePosition.z
        collisionFace.push.z = tmpCollisionFace.push.z
        collisionFace.abs.z = tmpCollisionFace.abs.z
      }
      detectMeshList.push(this.listCollisionMesh[i])
    }

    collisionFace.detectMeshList = detectMeshList
    //console.log(collisionFace.facePosition)
    return collisionFace
  }
  collisionClimbStep(startPosition, moveDistanceVect, collisionFace) {
    //console.log(collisionFace)
    let climbFacePosition = null
    if (
      collisionFace.climbFacePositionX != null ||
      collisionFace.climbFacePositionZ != null
    ) {
      climbFacePosition = Math.max(
        collisionFace.climbFacePositionX,
        collisionFace.climbFacePositionZ
      )
      //console.log(collisionFace)
    }
    // console.log(collisionFace.climbFacePositionX, collisionFace.climbFacePositionZ)
    if (climbFacePosition != null) {
      const startPosition2 = {
        x: startPosition.x,
        y: climbFacePosition,
        z: startPosition.z,
      }

      const collisionTestClimb = this.collisionTest(
        startPosition2,
        {
          x: moveDistanceVect.x,
          y: 0,
          z: moveDistanceVect.z,
        },
        false
      )
      if (
        collisionTestClimb.interruptClimbX == false ||
        collisionTestClimb.interruptClimbZ == false
      ) {

        let climbX = null
        climbX =
          collisionFace.interruptClimbX == false &&
          collisionTestClimb.interruptClimbX == false &&
          collisionTestClimb.interruptClimbZ == false
            ? collisionFace.climbFacePositionX
            : null
        let climbZ = null
        climbZ =
          collisionFace.interruptClimbZ == false &&
          collisionTestClimb.interruptClimbZ == false &&
          collisionTestClimb.interruptClimbX == false
            ? collisionFace.climbFacePositionZ
            : null

        if (
          collisionFace.interruptClimbX == false &&
          collisionTestClimb.interruptClimbX == false &&
          collisionFace.facePosition.x != null
        ) {
          climbX = collisionFace.climbFacePositionX
        }
        if (
          collisionFace.interruptClimbZ == false &&
          collisionTestClimb.interruptClimbZ == false &&
          collisionFace.facePosition.z != null
        ) {
          climbZ = collisionFace.climbFacePositionZ
        }

        if (
          collisionTestClimb.interruptClimbX == true ||
          collisionTestClimb.interruptClimbZ == true
        ) {
          if (
            collisionFace.facePosition.x != null &&
            collisionTestClimb.push.y < 0
          ) {
            climbX = null
          }
          if (
            collisionFace.facePosition.z != null &&
            collisionTestClimb.push.y < 0
          ) {
            climbZ = null
          }
        }
        /*
        if (collisionFace.facePosition.x != null && collisionTestClimb.interruptClimbX == true) {
          climbX = null
        }
        if (collisionFace.facePosition.z != null && collisionTestClimb.interruptClimbZ == true) {
          climbZ = null
        }
        */
        /*
        const climbX =
          collisionTestClimb.interruptClimbX == false &&
          collisionTestClimb.interruptClimbZ == false
            ? collisionFace.climbFacePositionX
            : null
        const climbZ =
          collisionTestClimb.interruptClimbZ == false &&
          collisionTestClimb.interruptClimbX == false
            ? collisionFace.climbFacePositionZ
            : null
*/
        /*
&& 
&& collisionFace.facePosition.z == null 
        const climbX = collisionTestClimb.interruptClimbX == false && collisionTestClimb.interruptClimbZ == false ? collisionFace.climbFacePositionX : null
        const climbZ = collisionTestClimb.interruptClimbZ == false  && collisionTestClimb.interruptClimbX == false? collisionFace.climbFacePositionZ : null
*/
        //        const climbX = collisionTestClimb.interruptClimbX == false && collisionFace.facePosition.x == null ? collisionFace.climbFacePositionX : null
        //        const climbZ = collisionTestClimb.interruptClimbZ == false && collisionFace.facePosition.z == null ? collisionFace.climbFacePositionZ : null

        if (climbX != null || climbZ != null) {
          //console.log(climbX, climbZ)
          climbFacePosition = Math.max(climbX, climbZ)
          collisionFace.direction.y = 1
          collisionFace.facePosition.y = climbFacePosition
        }
      }
    }
    //console.log(collisionFace.facePosition.y)
    return collisionFace
    /*
    const moveDestination = {
      x: startPosition.x + moveDistanceVect.x,
      y: startPosition.y + moveDistanceVect.y,
      z: startPosition.z + moveDistanceVect.z,
    }
    let movableX = false
    let movableZ = false
    if (collisionFace.facePosition.x != null) {
      movableX =
        moveDistanceVect.x > 0
          ? collisionFace.facePosition.x < moveDestination.x
          : collisionFace.facePosition.x > moveDestination.x
    } else {
      movableX = true
    }
    if (collisionFace.facePosition.z != null) {
      movableZ =
        moveDistanceVect.z > 0
          ? collisionFace.facePosition.z < moveDestination.z
          : collisionFace.facePosition.z > moveDestination.z
    } else {
      movableZ = true
    }
    if (movableZ == false || collisionFace.interruptClimbZ ) {
      collisionFace.climbFacePositionZ = null
      collisionFace.climbHeightZ = 0
    }
    if (movableX == false || collisionFace.interruptClimbX ) {
      collisionFace.climbFacePositionX = null
      collisionFace.climbHeightX = 0
    }

    const climbFacePosition =
    collisionFace.climbFacePositionX > collisionFace.climbFacePositionZ
        ? collisionFace.climbFacePositionX
        : collisionFace.climbFacePositionZ
    const climbHeight =
    collisionFace.climbHeightX > collisionFace.climbHeightZ ? collisionFace.climbHeightX : collisionFace.climbHeightZ


    collisionFace.direction.y = 1
    collisionFace.facePosition.y = climbFacePosition

    return collisionFace
    if (movableX || movableZ) {
      collisionFace.direction.y = 1
      collisionFace.facePosition.y = climbFacePosition
      collisionFace.push.y = 0
      collisionFace.abs.y = climbHeight
    }
    return collisionFace
    */
  }
  detectFloor(collisionFace) {
    const detectResult = []
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const raycaster = this.player.collision[row][col].raycaster
        const rayOffsetX = this.player.collision[row][col].rayOffsetX
        const rayOffsetZ = this.player.collision[row][col].rayOffsetZ
        raycaster.ray.origin.x = this.player.objBbox.position.x + rayOffsetX
        raycaster.ray.origin.y =
          this.player.objBbox.position.y + this.CLIMB_HEIGHT
        raycaster.ray.origin.z = this.player.objBbox.position.z + rayOffsetZ
        const detectStep = raycaster.intersectObjects(
          collisionFace.detectMeshList
        )
        const isClimb = detectStep.length > 0
        if (isClimb) {
          detectResult.push(detectStep)
          this.player.onFloor = true
        }
      }
    }
    if (collisionFace.direction.y < 0 && this.player.velocity.y > 0) {
      this.player.velocity.y = 0
    }

    if (
      collisionFace.x == null &&
      collisionFace.y == null &&
      collisionFace.z == null
    ) {
      if (collisionFace.direction.y != 1) {
        this.player.onFloor = false
      }
    }
    if (detectResult.length > 0) {
      this.player.onFloor = true
    }
  }
  dispDumpCollisionFace(collisionFace) {
    document.querySelector(
      '#status_collisionFace'
    ).innerHTML = `dir x:${collisionFace.direction.x}, dir y:${collisionFace.direction.y}, dir z:${collisionFace.direction.z}<br>`
    document.querySelector(
      '#status_collisionFace'
    ).innerHTML += `pos x:${collisionFace.position.x}, pos y:${collisionFace.position.y}, pos z:${collisionFace.position.z}<br>`
    document.querySelector(
      '#status_collisionFace'
    ).innerHTML += `pus x:${collisionFace.push.x}, pus y:${collisionFace.push.y}, pus z:${collisionFace.push.z},`
  }
  applyCollisionFaceToBboxOrigin(collisionFace) {
    if (collisionFace.direction.y == 1) {
      this.player.objBbox.position.y = collisionFace.facePosition.y
    }
    if (collisionFace.direction.y == -1) {
      this.player.objBbox.position.y =
        collisionFace.facePosition.y - this.PLAYER_HEIGHT
    }

    if (collisionFace.direction.x == 1) {
      this.player.objBbox.position.x =
        collisionFace.facePosition.x + this.PLAYER_RADIUS
    }
    if (collisionFace.direction.x == -1) {
      this.player.objBbox.position.x =
        collisionFace.facePosition.x - this.PLAYER_RADIUS
    }

    if (collisionFace.direction.z == 1) {
      this.player.objBbox.position.z =
        collisionFace.facePosition.z + this.PLAYER_RADIUS
    }
    if (collisionFace.direction.z == -1) {
      this.player.objBbox.position.z =
        collisionFace.facePosition.z - this.PLAYER_RADIUS
    }
  }
  slipCollisionPushBack(startPosition, collisionFaceMove) {
    //const collisionFace = collisionFaceMove
    const collisionFace = Object.assign({}, collisionFaceMove)

    /*
    const collisionFace = {
      direction: { x: 0, y: 0, z: 0 },
      facePosition: { x: null, y: null, z: null },
      push: { x: 0, y: 0, z: 0 },
      abs: { x: 0, y: 0, z: 0 },
    }
    */

    let collisionFacSlipX = {
      abs: { y: 0 },
    }
    let collisionFacSlipY = {
      abs: { y: 0 },
    }
    let collisionFacSlipZ = {
      abs: { y: 0 },
    }
    if (collisionFace.direction.x != 0) {
      collisionFacSlipX = this.collisionTest(
        startPosition,
        {
          x: -collisionFaceMove.push.x,
          y: 0,
          z: 0,
        },
        false
      )
      collisionFace.direction.x = collisionFacSlipX.direction.x
      collisionFace.facePosition.x = collisionFacSlipX.facePosition.x
      collisionFace.push.x = collisionFacSlipX.push.x
      collisionFace.abs.x = collisionFacSlipX.abs.x
    }
    if (collisionFace.direction.z != 0) {
      //console.log('slipZ')
      collisionFacSlipZ = this.collisionTest(
        startPosition,
        {
          x: 0,
          y: 0,
          z: -collisionFaceMove.push.z,
        },
        false
      )
      //console.log('slipZ', collisionFacSlipZ)
      collisionFace.direction.z = collisionFacSlipZ.direction.z
      collisionFace.facePosition.z = collisionFacSlipZ.facePosition.z
      collisionFace.push.z = collisionFacSlipZ.push.z
      collisionFace.abs.z = collisionFacSlipZ.abs.z
    }
    if (collisionFace.direction.y != 0) {
      collisionFacSlipY = this.collisionTest(
        startPosition,
        {
          x: 0,
          y: -collisionFaceMove.push.y,
          z: 0,
        },
        false
      )
      collisionFace.direction.y = collisionFacSlipY.direction.y
      collisionFace.facePosition.y = collisionFacSlipY.facePosition.y
      collisionFace.push.y = collisionFacSlipY.push.y
      collisionFace.abs.y = collisionFacSlipY.abs.y
    }
    return collisionFace
  }
  applyPlayerOperate() {
    const delta = this.clock.getDelta()

    const radianInputDirection = Math.atan2(
      this.inputDirection.rl,
      this.inputDirection.fb
    )

    const target = new THREE.Vector3()
    this.player.obj.getWorldDirection(target)
    var radianCamera = Math.atan2(target.x, target.z)

    this.player.obj.rotation.y = radianCamera
    const radianMoveDirection =
      this.player.obj.rotation.y + radianInputDirection
    const inpuSpeed =
      this.inputDirection.rl !== 0 || this.inputDirection.fb !== 0
        ? this.MOVE_SPEED
        : 0

    const speed =
      this.player.onFloor == true ? inpuSpeed : inpuSpeed * this.AIR_FRICTION
    const moveDistance = speed * delta
    const rateX = Math.sin(radianMoveDirection)
    const rateZ = Math.cos(radianMoveDirection)
    const moveDistanceX = moveDistance * rateX
    const moveDistanceZ = moveDistance * rateZ

    if (this.player.onFloor == true && this.inputJump == true) {
      if (this.player.jumpIntervalClock.getElapsedTime() > this.INTERVAL_JUMP) {
        this.player.jumpIntervalClock.start()
        this.player.velocity.y = this.JUMP_SPEED
        this.player.jumpStartY = this.player.objBbox.position.y
      }
    } else if (this.player.onFloor == true) {
      this.player.velocity.y = 0
      this.player.jumpStartY = this.player.objBbox.position.y
    }

    document.querySelector('#status_startY').innerHTML = this.player.jumpStartY
    if (this.player.onFloor == false) {
      if (this.player.velocity.y > -this.MOVE_SPEED) {
        this.player.velocity.y -= this.JUMP_SPEED * this.GRAVITY * delta
      } else {
        this.player.velocity.y = -this.MOVE_SPEED
      }
    }

    const moveDistanceY =
      this.player.velocity.y > 0 || this.player.onFloor == false
        ? this.player.velocity.y * delta
        : 0

    //
    const currentPosition = {
      x: this.player.objBbox.position.x,
      y: this.player.objBbox.position.y,
      z: this.player.objBbox.position.z,
    }
    const moveDistanceVect = {
      x: moveDistanceX,
      y: moveDistanceY,
      z: moveDistanceZ,
    }

    const collisionTestInit = this.collisionTest(
      currentPosition,
      moveDistanceVect,
      true
    )
    //console.log(collisionTestInit.detectMeshList)
    //console.log('collisionTestInit',collisionTestInit)

    //console.log('collisionTestInit',this.player.objBbox.position.y)
    this.applyCollisionFaceToBboxOrigin(collisionTestInit)
    const collisionTestResult = this.collisionClimbStep(
      currentPosition,
      moveDistanceVect,
      collisionTestInit
    )

    //console.log(collisionTestResult.direction,collisionTestResult.facePosition)

    //console.log(collisionTestResult.detectMeshList.length)
    //console.log('collisionTestInit 1',this.player.objBbox.position.y)
    //this.applyCollisionFaceToBboxOrigin(collisionTestInit)
    //console.log('collisionTestInit 2',this.player.objBbox.position.y)

    this.player.objBbox.position.x += moveDistanceVect.x
    this.player.objBbox.position.y += moveDistanceVect.y
    this.player.objBbox.position.z += moveDistanceVect.z
    //console.log('collisionTestResult 3',this.player.objBbox.position.y)
    this.applyCollisionFaceToBboxOrigin(collisionTestResult)
    //console.log('collisionTestResult 4',this.player.objBbox.position.y)

    //const collisionFace = collisionTestResult

    // Slip
    const currentPosition2 = {
      x: this.player.objBbox.position.x,
      y: this.player.objBbox.position.y,
      z: this.player.objBbox.position.z,
    }
    const slipMoveDistanceVec = {
      x: -collisionTestResult.push.x,
      y: -collisionTestResult.push.y,
      z: -collisionTestResult.push.z,
    }
    const collisionFace =
      collisionTestResult.direction.x != 0 ||
      collisionTestResult.direction.y != 0 ||
      collisionTestResult.direction.z != 0
        ? this.slipCollisionPushBack(currentPosition2, collisionTestResult)
        : collisionTestResult
    this.player.objBbox.position.x += slipMoveDistanceVec.x
    this.player.objBbox.position.y += slipMoveDistanceVec.y
    this.player.objBbox.position.z += slipMoveDistanceVec.z
    this.applyCollisionFaceToBboxOrigin(collisionFace)
    // Slip

    //console.log('collisionTest Slip',this.player.objBbox.position.y)

    this.detectFloor(collisionFace)
    //console.log(this.player.onFloor)

    if (collisionFace.direction.x || collisionFace.direction.z) {
      //document.querySelector('#status_pushback').innerHTML = 'hit'
      document.querySelector(
        '#status_pushback'
      ).innerHTML = `dx:${collisionFace.direction.x}, dy:${collisionFace.direction.y}, dz:${collisionFace.direction.z}<br>`
      document.querySelector(
        '#status_pushback'
      ).innerHTML += `px:${collisionFace.facePosition.x}, py:${collisionFace.facePosition.y}, pz:${collisionFace.facePosition.z},`
      document.querySelector(
        '#status_pushback'
      ).innerHTML += `<br />${this.player.obj.position.x}, ${this.player.obj.position.y}, ${this.player.obj.position.z}`
    } else {
      //document.querySelector('#status_pushback').innerHTML = 'no'
    }
    if (
      collisionFace.detectMeshList.length !== 0 ||
      this.player.onFloor === false
    ) {
      this.player.obj.position.x = this.player.objBbox.position.x
      this.player.obj.position.y = this.player.objBbox.position.y
      this.player.obj.position.z = this.player.objBbox.position.z

      this.player.box3
        .copy(this.player.bbox.geometry.boundingBox)
        .applyMatrix4(this.player.bbox.matrixWorld)
    } else {
      document.querySelector('#status_pushback').innerHTML = 'move'
      this.player.obj.position.x = this.player.objBbox.position.x
      this.player.obj.position.z = this.player.objBbox.position.z
      this.player.obj.position.y = this.player.objBbox.position.y
    }

    //this.controls.target.set(this.player.obj.position.x,this.player.obj.position.y + this.CAMERA_EYE_HEIGHT,this.player.obj.position.z);
    this.camera.lookAt(
      this.player.obj.position.x,
      this.player.obj.position.y + this.CAMERA_EYE_HEIGHT,
      this.player.obj.position.z
    )
    //this.camera.lookAt(this.player.objTilt.position.x, this.player.objTilt.position.y, this.player.objTilt.position.z)
    document.querySelector('#status_onFloor').innerHTML = this.player.onFloor
    document.querySelector(
      '#status_position'
    ).innerHTML = `${this.player.obj.position.x}, ${this.player.obj.position.y}, ${this.player.obj.position.z}`
    document.querySelector(
      '#status_bbox'
    ).innerHTML = `${this.player.objBbox.position.x}, ${this.player.objBbox.position.y}, ${this.player.objBbox.position.z}`
  }

  pushCollisionMesh(mesh) {
    mesh.updateMatrix()
    mesh.updateMatrixWorld()
    mesh.geometry.computeBoundingBox()
    mesh.userData.box3 = new THREE.Box3()
    mesh.userData.box3
      .copy(mesh.geometry.boundingBox)
      .applyMatrix4(mesh.matrixWorld)

    const helper = new THREE.Box3Helper(mesh.userData.box3, 0xffff00)
    this.scene.add(helper)

    this.listCollisionMesh.push(mesh)
  }
  updateCollisionMeshBox3(mesh){
    mesh.userData.box3
    .copy(mesh.geometry.boundingBox)
    .applyMatrix4(mesh.matrixWorld)
  }
  addEnvLight() {
    const light = new THREE.DirectionalLight(0xffffff, 0.8, 10)
    light.position.set(0.5, 1, -0.8) //default; light shining from top
    light.castShadow = true // default false
    light.shadow.mapSize.width = 2048 // default
    light.shadow.mapSize.height = 2048 // default
    light.shadow.camera.near = 0.5 // default
    light.shadow.camera.far = 500 // default
    this.scene.add(light)

    const lightAmbient = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(lightAmbient)

  }
  addFloor() {
    const materialStone = new THREE.MeshLambertMaterial({
      color: '#9b9b9b',
    })

    const floor = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2000, 2000, 32, 32),
      materialStone
    )
    floor.name = 'baseFloor'
    floor.position.x = 0
    floor.position.y = -20
    floor.position.z = 0
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true // 影の設定
    //this.aryCollisionObjects.push(floor);
    this.scene.add(floor)
    this.pushCollisionMesh(floor)
  }

  addDirectionBlock() {
    const geometry = new THREE.BoxGeometry(10, 10, 10)
    const geometrySmall = new THREE.BoxGeometry(5, 5, 5)

    const materialRed = new THREE.MeshBasicMaterial({
      color: 0xff0000,
    })
    const materialDarkRed = new THREE.MeshBasicMaterial({
      color: 'darkred',
    })

    const materialBlue = new THREE.MeshBasicMaterial({
      color: 'cyan',
    })
    const materialDarkBlue = new THREE.MeshBasicMaterial({
      color: 'darkblue',
    })

    const meshSample = new THREE.Mesh(geometry, materialBlue)
    meshSample.position.x = 0
    meshSample.position.z = 100
    this.scene.add(meshSample)

    const meshSample3 = new THREE.Mesh(geometrySmall, materialDarkBlue)
    meshSample3.position.x = 0
    meshSample3.position.z = -100
    this.scene.add(meshSample3)

    const meshSample2 = new THREE.Mesh(geometry, materialRed)
    meshSample2.position.x = 100
    meshSample2.position.z = 0
    this.scene.add(meshSample2)
    const meshSample4 = new THREE.Mesh(geometrySmall, materialDarkRed)
    meshSample4.position.x = -100
    meshSample4.position.z = 0
    this.scene.add(meshSample4)

    const lineX = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 0, 0),
      ]),
      materialRed
    )
    this.scene.add(lineX)
    const lineXn = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-100, 0, 0),
      ]),
      materialDarkRed
    )
    this.scene.add(lineXn)

    const lineZ = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 100),
      ]),
      materialBlue
    )
    this.scene.add(lineZ)
    const lineZn = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -100),
      ]),
      materialDarkBlue
    )
    this.scene.add(lineZn)

    /*
    this.meshDirectionBox = this.generateDirectionBox()
    this.meshDirectionBox.lookAt(10, 10, 10)
    this.scene.add(this.meshDirectionBox)
      */
    const axes = new THREE.AxesHelper(30)
    this.scene.add(axes)
  }
  generateDirectionBox() {
    const geometryPlayer = new THREE.BoxGeometry(20, 20, 20)
    const materialRed = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
    })
    const materialDarkRed = new THREE.MeshBasicMaterial({
      color: 'darkred',
      transparent: true,
      opacity: 0.5,
    })

    const materialBlue = new THREE.MeshBasicMaterial({
      color: 'cyan',
      transparent: true,
      opacity: 0.5,
    })
    const materialDarkBlue = new THREE.MeshBasicMaterial({
      color: 'darkblue',
      transparent: true,
      opacity: 0.5,
    })
    const materialGreen = new THREE.MeshBasicMaterial({
      color: 'green',
      transparent: true,
      opacity: 0.5,
    })

    const meshDirectionBox = new THREE.Mesh(geometryPlayer, [
      materialRed,
      materialDarkRed,
      materialGreen,
      materialGreen,
      materialBlue,
      materialDarkBlue,
    ])
    return meshDirectionBox
  }
  resizeRenderer() {
    const width = this.canvas_render.parentNode.offsetWidth
    const height = this.canvas_render.parentNode.offsetHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
}

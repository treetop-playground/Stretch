function init (scene) {

    const material = new THREE.MeshPhysicalMaterial({

        color: 0x393939,
        metalness: 0.9,
        roughness: 0.4,
        dithering: true

    });

    const geometry = new THREE.PlaneBufferGeometry(16000, 16000);

    const object = new THREE.Mesh(geometry, material);
    object.receiveShadow = true;
    object.rotation.x += Math.PI * 0.9;
    object.position.set(0, -100, 2000);

    scene.add(object);
}

let
    geometry, adjacency, vertices;

function calculate() {

    const tmp = new THREE.IcosahedronBufferGeometry(100, 5);

    // icosahedron generates non-indexed vertices, we make use of graph adjacency.
    geometry = THREE.BufferGeometryUtils.mergeVertices(tmp, 1.5);

    populateVertices();

    populateAdjacency();
}

function populateVertices() {

    const v0 = new THREE.Vector3();
    const position = geometry.attributes.position;

    vertices = new Array();

    for (let i = 0, il = position.count; i < il; i++) {
        v0.fromBufferAttribute(position, i);
        vertices.push(v0.clone());
    }
}

function populateAdjacency() {

    const
        index = geometry.index,
        faces = Array.from({ length: vertices.length }, () => new Array());

    // compute all faces for set vertex
    for (let i = 0, il = index.count / 3; i < il; i++) {

        const
            i3 = i * 3,
            a = index.getX(i3 + 0),
            b = index.getX(i3 + 1),
            c = index.getX(i3 + 2),

            face = new THREE.Face3(a, b, c);

        faces[a].push(face);
        faces[b].push(face);
        faces[c].push(face);
    }
}

function dispose() {

    geometry = undefined;
    adjacency = undefined;
}

let
    camera,
    interacting = false,
    psel = undefined;

const
    mouse = new THREE.Vector2(),
    tmpmouse = new THREE.Vector3(),
    mouse3d = new THREE.Vector3(),
    raycaster = new THREE.Raycaster(),
    plane = new THREE.Plane(undefined, -180),
    sphere = new THREE.Sphere(undefined, 100);

function init$1(PerspectiveCamera) {

    camera = PerspectiveCamera;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
}

function updating() {

    if (!interacting) return false;

    raycaster.setFromCamera(mouse, camera);

    if (raycaster.ray.intersectSphere(sphere, tmpmouse) != null) {
        mouse3d.copy(tmpmouse);

        if (psel == undefined) {
            let dist = Infinity;
            for (let i = 0; i < vertices.length; i++) {
                const tmp = mouse3d.distanceTo(vertices[i]);

                if (tmp < dist) {
                    dist = tmp;
                    psel = i;
                }
            }
        }
    }

    plane.normal.copy(camera.position).normalize();

    if (raycaster.ray.intersectPlane(plane, tmpmouse) != null) {
        mouse3d.copy(tmpmouse);
    }

    return (interacting && psel) ? true : false;
}

function onMouseMove(evt) {
    mouse.x = (evt.pageX / window.innerWidth) * 2 - 1;
    mouse.y = -(evt.pageY / window.innerHeight) * 2 + 1;
}
function onMouseDown(evt) {
    if (evt.button == 0) {
        interacting = true;
    }
}
function onMouseUp(evt) {
    if (evt.button == 0) {
        interacting = false;
        psel = undefined;
    }
}

var through_vert = /* glsl */`
precision highp float;
attribute vec2 position;
void main() {
	gl_Position = vec4( position, vec2(1.0) );
}
`;

var constraints_frag = /* glsl */`
precision highp float;

uniform vec2 tSize;
uniform sampler2D tPosition;

uniform sampler2D tDistancesA;
uniform sampler2D tDistancesB;

uniform sampler2D tAdjacentsA;
uniform sampler2D tAdjacentsB;

// get vec2 tex coordinate from index
vec2 getUV( float id ) { 
	vec2 coords = vec2(
		floor( mod( ( id + 0.5 ), tSize.x ) ),
		floor( ( id + 0.5 ) / tSize.x )
	) + 0.5;
	return coords / tSize;
}

// compute offset based on current distance and spring rest distance
vec3 getDisplacement( vec3 point0, vec3 point1, float restDistance ) {
	
    float curDistance = distance( point0, point1 );
	return 1.5 * ( curDistance - restDistance ) * ( point1 - point0 ) / curDistance;
}

void main() {
	
	vec3 displacement;
	vec2 uv = gl_FragCoord.xy / tSize.xy;

	// indices of adjacent vertices
	vec4 adjacentA = texture2D( tAdjacentsA, uv );
	vec4 adjacentB = texture2D( tAdjacentsB, uv );
	
	// distances of adjacent vertices
	vec4 distancesA = texture2D( tDistancesA, uv );
	vec4 distancesB = texture2D( tDistancesB, uv );
	
	// vertex position
	vec3 p0 = texture2D( tPosition, uv ).xyz;
	
	// adjacent vertices positions
    vec3 p1 = texture2D( tPosition, getUV( adjacentA.x ) ).xyz;
    vec3 p2 = texture2D( tPosition, getUV( adjacentA.y ) ).xyz;
    vec3 p3 = texture2D( tPosition, getUV( adjacentA.z ) ).xyz;
    vec3 p4 = texture2D( tPosition, getUV( adjacentA.w ) ).xyz;
    vec3 p5 = texture2D( tPosition, getUV( adjacentB.x ) ).xyz;
	vec3 p6 = texture2D( tPosition, getUV( adjacentB.y ) ).xyz;
	
	// spring-based displacement
    displacement += getDisplacement( p0, p1, distancesA.x );
    displacement += getDisplacement( p0, p2, distancesA.y );
    displacement += getDisplacement( p0, p3, distancesA.z );
    displacement += getDisplacement( p0, p4, distancesA.w );
    displacement += getDisplacement( p0, p5, distancesB.x );
    displacement += ( adjacentB.y > 0.0 ) ? getDisplacement( p0, p6, distancesB.y ) : vec3( 0 );
	
	p0 += 0.93 * displacement / ( ( adjacentB.y > 0.0 ) ? 6.0 : 5.0 );
	
	gl_FragColor = vec4( p0, 1.0 );
}
`;

var integrate_frag = /* glsl */`
precision highp float;

uniform vec2 tSize;

uniform sampler2D tOriginal;
uniform sampler2D tPrevious;
uniform sampler2D tPosition;

#define dt 0.016

void main() {

    float dt2 = dt * dt;

	vec2 uv = gl_FragCoord.xy / tSize.xy;
	vec3 org = texture2D( tOriginal, uv ).xyz;
	vec3 prv = texture2D( tPrevious, uv ).xyz;
	vec3 pos = texture2D( tPosition, uv ).xyz;
	vec3 offset = ( org - pos ) * 20.5 * dt2 * 8.33333;
	vec3 disp = ( pos - prv ) * 0.91 + pos;
	gl_FragColor = vec4( disp + offset, 1.0 );
}
`;

var mouse_frag = /* glsl */`
precision highp float;

uniform float psel;
uniform vec2 tSize;
uniform vec3 mouse;
uniform sampler2D tPosition;
uniform sampler2D tOriginal;

// get vec2 tex coordinate from index
vec2 getUV( float id ) { 

	vec2 coords = vec2(
		floor( mod( ( id + 0.5 ), tSize.x ) ),
		floor( ( id + 0.5 ) / tSize.x )
	) + 0.5;

	return coords / tSize;
}

void main() {
	vec2 uv = gl_FragCoord.xy / tSize.xy;
	
	vec3 pos = texture2D( tPosition, uv ).xyz;
	vec3 org = texture2D( tOriginal, uv ).xyz;
	vec3 ref = texture2D( tOriginal, getUV( psel ) ).xyz;
	
	vec3 diff, proj, offset = mouse - ref;

	if ( distance( org, ref ) <= 10.0 )  {
		diff = ref - org;
		proj = dot( diff, offset ) / dot( offset, offset ) * org;
		pos = org + proj + offset;
	}
	gl_FragColor = vec4( pos, 1.0 );
}
`;

var normals_frag = /* glsl */`
precision highp float;

uniform vec2 tSize;

uniform sampler2D tPosition;

uniform sampler2D tAdjacentsA;
uniform sampler2D tAdjacentsB;

// get vec2 tex coordinate from index
vec2 getUV( float id ) { 

	vec2 coords = vec2(
		floor( mod( ( id + 0.5 ), tSize.x ) ),
		floor( ( id + 0.5 ) / tSize.x )
	) + 0.5;
	return coords / tSize;
}

void main () {

	vec3 normal;
	vec2 uv = gl_FragCoord.xy / tSize.xy;

	// indices of adjacent vertices
    vec4 adjacentsA = texture2D( tAdjacentsA, uv );
    vec4 adjacentsB = texture2D( tAdjacentsB, uv );

	// vertex position
    vec3 p0 = texture2D( tPosition, uv ).xyz;

	// adjacent vertices positions
    vec3 p1 = texture2D( tPosition, getUV( adjacentsA.x ) ).xyz;
    vec3 p2 = texture2D( tPosition, getUV( adjacentsA.y ) ).xyz;
    vec3 p3 = texture2D( tPosition, getUV( adjacentsA.z ) ).xyz;
    vec3 p4 = texture2D( tPosition, getUV( adjacentsA.w ) ).xyz;
    vec3 p5 = texture2D( tPosition, getUV( adjacentsB.x ) ).xyz;
    vec3 p6 = texture2D( tPosition, getUV( adjacentsB.y ) ).xyz;
	
    // compute vertex normal contribution
    normal += cross( p1 - p0, p2 - p0 );
    normal += cross( p2 - p0, p3 - p0 );
    normal += cross( p3 - p0, p4 - p0 );
    normal += cross( p4 - p0, p5 - p0 );
    
	if ( adjacentsB.y > 0.0 ) {
        normal += cross( p5 - p0, p6 - p0 );
        normal += cross( p6 - p0, p1 - p0 );
    } else {
        normal += cross( p5 - p0, p1 - p0 );
    }
	
    gl_FragColor = vec4( normalize( normal ), 1.0 );
}
`;

var through_frag = /* glsl */`
precision highp float;
uniform vec2 tSize;
uniform sampler2D texture;
void main() {
	vec2 uv = gl_FragCoord.xy / tSize.xy;
	gl_FragColor = texture2D( texture, uv );
}
`;

// shader-import-block

// copyToRenderTarget
const copyShader = new THREE.RawShaderMaterial({
    uniforms: {
        tSize: { type: 'v2' },
        texture: { type: 't' }
    },
    vertexShader: through_vert,
    fragmentShader: through_frag,
    fog: false,
    lights: false,
    depthWrite: false,
    depthTest: false
});

// forward-integration
const integrateShader = copyShader.clone();
integrateShader.fragmentShader = integrate_frag;
integrateShader.uniforms = {
    dt: { type: 'f' },
    tSize: { type: 'v2' },
    tOriginal: { type: 't' },
    tPrevious: { type: 't' },
    tPosition: { type: 't' }
};

// mouse displacement 
const mouseShader = copyShader.clone();
mouseShader.fragmentShader = mouse_frag;
mouseShader.uniforms = {
    psel: { value: null },
    tSize: { type: 'v2' },
    mouse: { type: 'v3' },
    tOriginal: { type: 't' },
    tPosition: { type: 't' }
};

// vertices relaxation
const constraintsShader = copyShader.clone();
constraintsShader.fragmentShader = constraints_frag;
constraintsShader.uniforms = {
    tSize: { type: 'v2' },
    tPosition: { type: 't' },
    tAdjacentsA: { type: 't' },
    tAdjacentsB: { type: 't' },
    tDistancesA: { type: 't' },
    tDistancesB: { type: 't' }
};

// calculate normals
const normalsShader = copyShader.clone();
normalsShader.fragmentShader = normals_frag;
normalsShader.uniforms = {
    tSize: { type: 'v2' },
    tPosition: { type: 't' },
    tAdjacentsA: { type: 't' },
    tAdjacentsB: { type: 't' }
};

let
    RESOLUTION,
    renderer, mesh, targetRT, normalsRT,
    originalRT, previousRT, positionRT,
    adjacentsRT, distancesRT,
    steps = 40;


const
    tSize = new THREE.Vector2(),
    scene = new THREE.Scene(),
    camera$1 = new THREE.Camera();

function init$2(WebGLRenderer) {

    // setup
    renderer = WebGLRenderer;

    RESOLUTION = Math.ceil(Math.sqrt(vertices.length));
    tSize.set(RESOLUTION, RESOLUTION);

    // geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
        -1.0, -1.0,
        3.0, -1.0,
        -1.0, 3.0
    ]);

    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 2));

    // mesh
    mesh = new THREE.Mesh(geometry, copyShader);
    mesh.frustumCulled = false;
    scene.add(mesh);

    scene.updateMatrixWorld = function () { };

    // render targets
    originalRT = createRenderTarget();
    targetRT = createRenderTarget();
    previousRT = createRenderTarget();
    positionRT = createRenderTarget();
    normalsRT = createRenderTarget();

    adjacentsRT = Array.from({ length: 2 }, createRenderTarget);
    distancesRT = Array.from({ length: 2 }, createRenderTarget);

    // prepare
    copyTexture(createPositionTexture(), originalRT);
    copyTexture(originalRT, previousRT);
    copyTexture(originalRT, positionRT);

    // setup relaxed vertices conditions
    for (let i = 0; i < 2; i++) {

        copyTexture(createAdjacentsTexture(i * 4), adjacentsRT[i]);

    }

    // setup vertices original distances
    for (let i = 0; i < 2; i++) {

        copyTexture(createDistancesTexture(i * 4), distancesRT[i]);

    }

}

function copyTexture(input, output) {

    mesh.material = copyShader;
    copyShader.uniforms.tSize.value = tSize;
    copyShader.uniforms.texture.value = input.texture;

    renderer.setRenderTarget(output);
    renderer.render(scene, camera$1);

}

function createRenderTarget() {

    return new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthTest: false,
        depthWrite: false,
        depthBuffer: false,
        stencilBuffer: false
    });

}

function createPositionTexture() {

    const data = new Float32Array(RESOLUTION * RESOLUTION * 4);
    const length = vertices.length;

    for (let i = 0; i < length; i++) {

        const i4 = i * 4;

        data[i4 + 0] = vertices[i].x;
        data[i4 + 1] = vertices[i].y;
        data[i4 + 2] = vertices[i].z;

    }

    const tmp = {};
    tmp.texture = new THREE.DataTexture(data, RESOLUTION, RESOLUTION, THREE.RGBAFormat, THREE.FloatType);
    tmp.texture.minFilter = THREE.NearestFilter;
    tmp.texture.magFilter = THREE.NearestFilter;
    tmp.texture.needsUpdate = true;
    tmp.texture.generateMipmaps = false;
    tmp.texture.flipY = false;

    return tmp;

}

function createAdjacentsTexture(k) {

    const data = new Float32Array(RESOLUTION * RESOLUTION * 4);
    const length = vertices.length;

    for (let i = 0; i < length; i++) {

        const i4 = i * 4;
        const adj = adjacency[i];
        const len = adjacency[i].length;

        data[i4 + 0] = adj[k + 0];
        data[i4 + 1] = (len < 6 && k > 0) ? - 1 : adj[k + 1];
        data[i4 + 2] = (k > 0) ? - 1 : adj[k + 2];
        data[i4 + 3] = (k > 0) ? - 1 : adj[k + 3];

    }

    const tmp = {};
    tmp.texture = new THREE.DataTexture(data, RESOLUTION, RESOLUTION, THREE.RGBAFormat, THREE.FloatType);
    tmp.texture.minFilter = THREE.NearestFilter;
    tmp.texture.magFilter = THREE.NearestFilter;
    tmp.texture.needsUpdate = true;
    tmp.texture.generateMipmaps = false;
    tmp.texture.flipY = false;

    return tmp;

}

function createDistancesTexture(k) {

    const data = new Float32Array(RESOLUTION * RESOLUTION * 4);
    const length = vertices.length;

    const vert = vertices;

    for (let i = 0; i < length; i++) {

        const i4 = i * 4;
        const adj = adjacency[i];
        const len = adjacency[i].length;

        const v = vert[i];

        data[i4 + 0] = v.distanceTo(vert[adj[k + 0]]);
        data[i4 + 1] = (len < 6 && k > 0) ? - 1 : v.distanceTo(vert[adj[k + 1]]);
        data[i4 + 2] = (k > 0) ? - 1 : v.distanceTo(vert[adj[k + 2]]);
        data[i4 + 3] = (k > 0) ? - 1 : v.distanceTo(vert[adj[k + 3]]);

    }

    const tmp = {};
    tmp.texture = new THREE.DataTexture(data, RESOLUTION, RESOLUTION, THREE.RGBAFormat, THREE.FloatType);
    tmp.texture.minFilter = THREE.NearestFilter;
    tmp.texture.magFilter = THREE.NearestFilter;
    tmp.texture.needsUpdate = true;
    tmp.texture.generateMipmaps = false;
    tmp.texture.flipY = false;

    return tmp;

}

function integrate() {

    mesh.material = integrateShader;
    integrateShader.uniforms.tSize.value = tSize;
    integrateShader.uniforms.tOriginal.value = originalRT.texture;
    integrateShader.uniforms.tPrevious.value = previousRT.texture;
    integrateShader.uniforms.tPosition.value = positionRT.texture;

    renderer.setRenderTarget(targetRT);
    renderer.render(scene, camera$1);

    const tmp = previousRT;
    previousRT = positionRT;
    positionRT = targetRT;
    targetRT = tmp;

}

function solveConstraints() {

    mesh.material = constraintsShader;
    constraintsShader.uniforms.tSize.value = tSize;
    constraintsShader.uniforms.tPosition.value = positionRT.texture;
    constraintsShader.uniforms.tAdjacentsA.value = adjacentsRT[0].texture;
    constraintsShader.uniforms.tAdjacentsB.value = adjacentsRT[1].texture;
    constraintsShader.uniforms.tDistancesA.value = distancesRT[0].texture;
    constraintsShader.uniforms.tDistancesB.value = distancesRT[1].texture;

    renderer.setRenderTarget(targetRT);
    renderer.render(scene, camera$1);

    const tmp = positionRT;
    positionRT = targetRT;
    targetRT = tmp;

}

function mouseOffset() {

    mesh.material = mouseShader;
    mouseShader.uniforms.tSize.value = tSize;
    mouseShader.uniforms.psel.value = psel;
    mouseShader.uniforms.mouse.value = mouse3d;
    mouseShader.uniforms.tOriginal.value = originalRT.texture;
    mouseShader.uniforms.tPosition.value = positionRT.texture;

    renderer.setRenderTarget(targetRT);
    renderer.render(scene, camera$1);

    const tmp = positionRT;
    positionRT = targetRT;
    targetRT = tmp;

}

function computeVertexNormals() {

    mesh.material = normalsShader;
    normalsShader.uniforms.tSize.value = tSize;
    normalsShader.uniforms.tPosition.value = positionRT.texture;
    normalsShader.uniforms.tAdjacentsA.value = adjacentsRT[0].texture;
    normalsShader.uniforms.tAdjacentsB.value = adjacentsRT[1].texture;

    renderer.setRenderTarget(normalsRT);
    renderer.render(scene, camera$1);

}

function update() {

    integrate();

    let mouseUpdating = updating();

    for (let i = 0; i < steps; i++) {

        if (mouseUpdating && (i + 5) < steps) mouseOffset();

        solveConstraints();

    }

    computeVertexNormals();

}

let
    RESOLUTION$1,
    mesh$1;

function init$3(scene) {

    RESOLUTION$1 = Math.ceil(Math.sqrt(vertices.length));

    const bmp = new THREE.TextureLoader().load('./src/textures/bmpMap.png');

    const material = new THREE.MeshPhysicalMaterial({

        color: 0xffda20,
        bumpMap: bmp,
        bumpScale: 0.25,
        metalness: 0.1,
        roughness: 0.6,
        clearcoat: 0.8,
        clearcoatRoughness: 0.35,
        sheen: new THREE.Color(0.2, 0.2, 1).multiplyScalar(1 / 6),
        dithering: true

    });

    // update cloth material with computed position and normals
    material.onBeforeCompile = function (shader) {
        shader.uniforms.tPosition = { value: positionRT.texture };
        shader.uniforms.tNormal = { value: normalsRT.texture };
        shader.vertexShader = 'uniform sampler2D tPosition;\nuniform sampler2D tNormal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <beginnormal_vertex>',
            `vec3 transformed = texture2D( tPosition, position.xy ).xyz;
			 vec3 objectNormal = normalize( texture2D( tNormal, position.xy ).xyz );
			`
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            ''
        );
    };

    // update depth material for correct shadows
    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.onBeforeCompile = function (shader) {
        shader.uniforms.tPosition = { value: positionRT.texture };
        shader.vertexShader = 'uniform sampler2D tPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `vec3 transformed = texture2D( tPosition, position.xy ).xyz;`
        );
    };

    // fill position with associated texture sampling coordinate
    const position = new Float32Array(RESOLUTION$1 * RESOLUTION$1 * 3);
    for (let i = 0, il = RESOLUTION$1 * RESOLUTION$1; i < il; i++) {

        const i3 = i * 3;
        position[i3 + 0] = (i % (RESOLUTION$1)) / (RESOLUTION$1) + 0.5 / (RESOLUTION$1);
        position[i3 + 1] = ~~(i / (RESOLUTION$1)) / (RESOLUTION$1) + 0.5 / (RESOLUTION$1);

    }

    const geometry$1 = new THREE.BufferGeometry();
    geometry$1.setIndex(geometry.index);
    geometry$1.addAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry$1.addAttribute('uv', geometry.attributes.uv);

    mesh$1 = new THREE.Mesh(geometry$1, material);
    mesh$1.customDepthMaterial = depthMaterial;
    mesh$1.castShadow = true;

    scene.add(mesh$1);

}

let
    objects;

const
    clock = new THREE.Clock();

function init$4(scene) {

    // lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0);
    ambientLight.baseIntensity = 0.5;

    const spotLight = new THREE.SpotLight(0xfd8b8b, 0, 4000, Math.PI / 6, 0.2, 0.11);
    spotLight.baseIntensity = 3.6;
    spotLight.position.set(0.9, 0.1, - 0.5).multiplyScalar(400);

    const spotLight2 = new THREE.SpotLight(0x4a7fe8, 0, 4000, Math.PI / 6, 0.2, 0.11);
    spotLight2.baseIntensity = 2.0;
    spotLight2.position.set(- 0.91, 0.1, - 0.5).multiplyScalar(400);

    const spotLight3 = new THREE.SpotLight(0xffffff, 0, 4000, Math.PI / 5.5, 1.4, 0.08);
    spotLight3.baseIntensity = 1.5;
    spotLight3.position.set(0, 0, -1).multiplyScalar(400);
    spotLight3.castShadow = true;
    spotLight3.shadow.radius = 5;
    spotLight3.shadow.camera.far = 4000;
    spotLight3.shadow.mapSize.height = 1024;
    spotLight3.shadow.mapSize.width = 1024;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0);
    directionalLight.baseIntensity = 0.3;
    directionalLight.position.set(0, 1, 0.5);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0);
    directionalLight2.baseIntensity = 1.3;
    directionalLight2.position.set(0, 1, -0.4);

    scene.add(ambientLight, spotLight, spotLight2, spotLight3, directionalLight, directionalLight2);
    objects = [ambientLight, spotLight, spotLight2, spotLight3, directionalLight, directionalLight2];

}

function easing(t, c) {
    if ((t /= 1 / 2) < 1) return c / 2 * t * t * t;
    return c / 2 * ((t -= 2) * t * t + 2);
}

function update$1() {

    const time = clock.getElapsedTime();

    if (time > 1 && time < 4) {

        for (let i = 0; i < objects.length; i++) {
            objects[i].intensity = objects[i].baseIntensity * easing((time - 1) / 3, 1.0);
        }
    }
}

let renderer$1, camera$2, scene$1;

function init$5() {

    // renderer
    renderer$1 = new THREE.WebGLRenderer({ antialias: true });
    renderer$1.setSize(window.innerWidth, window.innerHeight);
    renderer$1.setPixelRatio(window.devicePixelRatio);

    renderer$1.gammaOutput = true;
    renderer$1.physicallyCorrectLights = true;

    renderer$1.shadowMap.enabled = true;
    renderer$1.shadowMap.type = THREE.PCFShadowMap;

    document.body.appendChild(renderer$1.domElement);

    // scene
    scene$1 = new THREE.Scene();
    scene$1.background = new THREE.Color(0x121312);

    // camera
    camera$2 = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 4000);
    camera$2.position.set(0, - 50, - 350);
    camera$2.lookAt(new THREE.Vector3());

    // pre-calculate geometry information
    calculate();

    // initialization block
    init(scene$1);
    init$4(scene$1);
    init$3(scene$1);

    init$1(camera$2, renderer$1.domElement);
    init$2(renderer$1);

    // dispose of calculation data
    dispose();

    // start program
    animate();
}

function animate() {

    update$1();
    update();

    renderer$1.setRenderTarget(null);
    renderer$1.render(scene$1, camera$2);

    requestAnimationFrame(animate);
}

window.onresize = function () {

    const w = window.innerWidth;
    const h = window.innerHeight;

    camera$2.aspect = w / h;
    camera$2.updateProjectionMatrix();

    renderer$1.setSize(w, h);
};

init$5();

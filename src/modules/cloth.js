import * as PRE from './pre.js';
import * as FBO from './fbo.js';

let
    RESOLUTION,
    mesh;

function init(scene) {

    RESOLUTION = Math.ceil(Math.sqrt(PRE.vertices.length));

    const tl = new THREE.TextureLoader();

    const bmp = tl.load('./src/textures/bmpMap.png');

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

    material.onBeforeCompile = function (shader) {
        shader.uniforms.tPosition = { value: FBO.positionRT.texture };
        shader.uniforms.tNormal = { value: FBO.normalsRT.texture };
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

    const depthMaterial = new THREE.MeshDepthMaterial();
    depthMaterial.onBeforeCompile = function (shader) {
        shader.uniforms.tPosition = { value: FBO.positionRT.texture };
        shader.vertexShader = 'uniform sampler2D tPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `vec3 transformed = texture2D( tPosition, position.xy ).xyz;`
        );
    };

    const position = new Float32Array(RESOLUTION * RESOLUTION * 3);
    for (let i = 0, il = RESOLUTION * RESOLUTION; i < il; i++) {

        const i3 = i * 3;
        position[i3 + 0] = (i % (RESOLUTION)) / (RESOLUTION) + 0.5 / (RESOLUTION);
        position[i3 + 1] = ~~(i / (RESOLUTION)) / (RESOLUTION) + 0.5 / (RESOLUTION);

    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(PRE.geometry.index);
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('uv', PRE.geometry.attributes.uv);

    mesh = new THREE.Mesh(geometry, material);
    mesh.customDepthMaterial = depthMaterial;
    mesh.castShadow = true;

    scene.add(mesh);

}

export { init, mesh };

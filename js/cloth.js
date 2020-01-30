import * as FBO from './fbo.js';

let RESOLUTION,
    mesh;

function init (geo) {

    RESOLUTION = Math.ceil(Math.sqrt(geo.attributes.position.count));

    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffda20,
        metalness: 0.1,
        roughness: 0.5,
        clearcoat: 0.8,
        clearcoatRoughness: 0.3
    });

    material.onBeforeCompile = function (shader) {
        shader.uniforms.tPosition = { value: FBO.positionRT.texture };
        shader.vertexShader = 'uniform sampler2D tPosition;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <beginnormal_vertex>',
            `vec3 transformed = texture2D(tPosition, position.xy).xyz;
                       vec3 objectNormal = normalize(transformed);
                        `
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            ''
        );
    };

    const position = new Float32Array(RESOLUTION * RESOLUTION * 3);
    for (let i = 0, il = RESOLUTION * RESOLUTION; i < il; i++) {

        const i3 = i * 3;
        position[i3 + 0] = (i % (RESOLUTION)) / (RESOLUTION) + 0.5 / (RESOLUTION);
        position[i3 + 1] = ~~(i / (RESOLUTION)) / (RESOLUTION) + 0.5 / (RESOLUTION);

    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(geo.index);
    geometry.addAttribute('position', new THREE.BufferAttribute(position, 3));

    mesh = new THREE.Mesh(geometry, material);
    // mesh.castShadow = true;
}

export { init, mesh };

export default /* glsl */`
precision highp float;
precision highp sampler2D;

uniform vec2 tSize;
uniform float order;
uniform sampler2D tOriginal;
uniform sampler2D tPrevious0;
uniform sampler2D tPrevious1;
uniform sampler2D tPosition0;
uniform sampler2D tPosition1;

#define dt 0.016

vec3 unpackPosition( vec3 pos ) {
	pos *= 1024.0;
	return ( order > 0.0 ) ? floor( pos ) : fract( pos );
}

void main() {

    float dt2 = dt * dt;

	vec2 uv = gl_FragCoord.xy / tSize.xy;

	vec3 org = texture2D( tOriginal, uv ).xyz;
	vec3 prv = ( texture2D( tPrevious0, uv ).xyz + texture2D( tPrevious1, uv ).xyz ) / 1024.0;
	vec3 pos = ( texture2D( tPosition0, uv ).xyz + texture2D( tPosition1, uv ).xyz ) / 1024.0;

	vec3 offset = ( org - pos ) * 20.5 * dt2 * 8.33333;
	vec3 disp = ( pos - prv ) * 0.91 + pos;
	
	gl_FragColor = vec4( unpackPosition( disp + offset ), 1.0 );
}
`;

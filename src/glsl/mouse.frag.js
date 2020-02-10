export default /* glsl */`
precision highp float;
uniform int psel;
uniform vec2 tSize;
uniform vec3 mouse;
uniform sampler2D tPosition;
uniform sampler2D tOriginal;
vec2 getUV( float id ) {
	float div = id / tSize.x;
	float d = floor( div );
	float y = d / tSize.x;
	float x = div - d;
	float off = 0.5 / tSize.x;
	return vec2( x + off, y + off );
}
void main() {

    vec4 diff, proj;

	vec2 uv = gl_FragCoord.xy / tSize.xy;
	vec3 pos = texture2D( tPosition, uv ).xyz;
	vec3 org = texture2D( tOriginal, uv ).xyz;
	uv = getUV( float( psel ) );
	vec3 ref = texture2D( tOriginal, uv ).xyz;
	vec3 offset = mouse - ref;
	if ( distance( org, ref ) <= 05.0 )  {
	
	    diff = ref - org;
	    
	    proj = dot(diff, offset) / dot(offset, offset) * org;
	    
		pos = org + proj + offset;
	}
	gl_FragColor = vec4( pos, 1.0 );
}
`;

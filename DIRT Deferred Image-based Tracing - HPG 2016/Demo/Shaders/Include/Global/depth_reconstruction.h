#line 2
// Depth Reconstruction Utilities

// Reconstructs a position in ECS based on its coordinates in post-projective space
// Parameters:
// - texcoord, the XY screen-space coordinates [0,1]
// - depth, the depth value [0,1]
// returns the reconstructed ECS position
vec3 reconstruct_position_from_depth(vec2 texcoord, float depth)
{
	vec4 pndc = vec4(2 * vec3(texcoord.xy, depth) - 1, 1);
	vec4 pecs = uniform_proj_inverse * pndc;
	pecs.xyz = pecs.xyz / pecs.w;
	return pecs.xyz;
}

// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Mipmap Depth pass
// The near value is stored with reverse sign

#include "version.h"

uniform int		uniform_cube_index;								// view index
layout(binding = 11) uniform sampler2DArray tex_depth_bounds;	// the previous lod of the depth bounds texture
layout(location = 0) out vec2 out_frag_mipmap;					// the new lod of the depth bounds texture

void main(void)
{
	ivec2 coords = ivec2(gl_FragCoord.xy) * 2;
	vec2 t_minmax[4];
	t_minmax[0] = texelFetch( tex_depth_bounds, ivec3(coords.xy, uniform_cube_index) , 0).xy;
	t_minmax[1] = texelFetch( tex_depth_bounds, ivec3(coords.xy + ivec2(1,  0), uniform_cube_index ), 0 ).xy;
	t_minmax[2] = texelFetch( tex_depth_bounds, ivec3(coords.xy + ivec2(1, 1), uniform_cube_index ), 0 ).xy;
	t_minmax[3] = texelFetch( tex_depth_bounds, ivec3(coords.xy + ivec2( 0, 1), uniform_cube_index ), 0 ).xy;
	
	float minZ = max( max( t_minmax[0].x, t_minmax[1].x ), max( t_minmax[2].x, t_minmax[3].x ) );
	float maxZ = max( max( t_minmax[0].y, t_minmax[1].y ), max( t_minmax[2].y, t_minmax[3].y ) );
	
	out_frag_mipmap = vec2(minZ, maxZ);
}
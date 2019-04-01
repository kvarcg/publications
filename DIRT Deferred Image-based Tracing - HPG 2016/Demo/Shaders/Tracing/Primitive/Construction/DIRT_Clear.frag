// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Clear pass
// This step simply clears the internal data structures

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"
in vec2 TexCoord;

layout(binding = 1, std430)		writeonly buffer  LLD_SHADING	 { NodeTypeShading		nodes_shading []; }; // the shading buffer
uniform vec2 uniform_viewport; // viewport dimensions

void main(void)
{
	uvec2	frag = uvec2(floor(gl_FragCoord.xy));
	uint resolve_index = int(frag.y * uniform_viewport.x + frag.x) * 3;
#ifdef NO_PACKING
	nodes_shading[resolve_index + 2u].extra			= vec4(-1,0,0,0); 
#else
	nodes_shading[resolve_index + 2u].specular		= 0u; 
	nodes_shading[resolve_index + 2u].ior_opacity	= 0u; 
#endif // NO_PACKING
	nodes_shading[resolve_index + 2u].position.w	= -1; 
}

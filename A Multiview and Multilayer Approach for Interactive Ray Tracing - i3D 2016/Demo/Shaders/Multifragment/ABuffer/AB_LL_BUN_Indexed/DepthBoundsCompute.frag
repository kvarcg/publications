// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled linked-list with buckets fragment implementation of DepthBoundsCompute stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

uniform sampler2D sampler_color;

uniform uint	uniform_texture_mask;

in vec2 TexCoord;
in vec4 vertex_color;
in float pecsZ;

layout(binding = 1, r32ui)  coherent uniform uimage2DArray image_depth_bounds;

void  setPixelFragMinDepth (uint Z) { imageAtomicMin (image_depth_bounds, ivec3(gl_FragCoord.xy, 0), Z); }
void  setPixelFragMaxDepth (uint Z) { imageAtomicMax (image_depth_bounds, ivec3(gl_FragCoord.xy, 1), Z); }

void main(void)
{
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);
	if (tex_color.a < 0.5)
		discard;

	float d = -pecsZ;					// ** wtf?? ** //
	uint  Z = floatBitsToUint(d); 

	setPixelFragMinDepth (Z);
	setPixelFragMaxDepth (Z);
}
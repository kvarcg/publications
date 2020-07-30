// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Depth Bounds pass
// The eye-space position of the incoming fragments is stored using blending to capture the pixel's extents.
// NOTE: The depth bounds texture needs to be only vec2. However, vec2 blending wasn't working properly on NVIDIA, so a vec4 texture is allocated instead.

#include "version.h"

uniform sampler2D sampler_color;					// samplers and uniforms for alpha culling checks	
uniform sampler2D sampler_opacity;	
uniform uint	uniform_texture_mask;

in vec2 TexCoord;									// uv coordinates
in float pecsZ;										// eye-space Z

layout(location = 0) out vec4 out_frag_depth_bounds;

#define FLT_MAX         3.402823466e+38F        /* max value */
void main(void)
{
	// perform alpha culling
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);

	// opacity map fetches
	uint hasop		= (uniform_texture_mask & 0x10u) >> 4u;
	float opacity_map = (hasop > 0u) ? texture(sampler_opacity, TexCoord.st).x : 0.0;

	bool should_cull = tex_color.a < 0.5 || opacity_map == 1.0;
	if(should_cull) 
	{
		out_frag_depth_bounds = vec4(-FLT_MAX, 0, 0, 0);
		return;
	}

	// write the fragment depth
	out_frag_depth_bounds = vec4(pecsZ, -pecsZ, 0, 0);
}

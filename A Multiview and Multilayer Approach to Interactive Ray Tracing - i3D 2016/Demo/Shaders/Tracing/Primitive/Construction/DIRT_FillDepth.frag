// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Fill Depth pass
// Incoming primitives are clipped and stored in the depth buffer texture
// The near value is stored with reverse sign to make the mipmap calculations simpler
// Note: This pass requires conservative rasterization otherwise oblique primitives might not be rasterized

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

#define NUM_CUBEMAPS __NUM_FACES__

uniform sampler2D sampler_color;					// samplers and uniforms for alpha culling checks
uniform sampler2D sampler_opacity;

uniform uint	uniform_texture_mask;				// texture availability mask
uniform mat4	uniform_view_array[NUM_CUBEMAPS];	// world->eye transformation for all views
uniform vec2	uniform_near_far[NUM_CUBEMAPS];		// near far clipping distance for all views
uniform vec4	uniform_viewports[NUM_CUBEMAPS];	// viewport for all views

uniform vec3	uniform_plane_points_wcs[NUM_CUBEMAPS * 8]; // world-space position of the frustum corners for all views

in vec2	TexCoord;									// uv coordinates
flat in int  uniform_cube_index;					// view index
flat in vec4 prim_vertex_wcs[3];					// primitive vertices in world space

layout(binding = 3, std430)		readonly			buffer			LLD_PRIMITIVE	 { NodeTypePrimitive nodes_primitives[]; };
layout(binding = 4, offset = 0)				uniform		atomic_uint			next_address;

layout(location = 0) out vec2 out_frag_depth_bounds;

#include "DIRT/DIRT_clip.glsl"

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
		out_frag_depth_bounds = vec2(-FLT_MAX, 0.0);
		return;
	}

	vec3 p1 = prim_vertex_wcs[0].xyz;
	vec3 p2 = prim_vertex_wcs[1].xyz;
	vec3 p3 = prim_vertex_wcs[2].xyz;

	// clip the primitive against the frustum boundaries
	vec2 bounds = clip(p1, p2, p3, 0);	
	out_frag_depth_bounds = vec2(-bounds.x, bounds.y);
}

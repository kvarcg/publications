// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Fill Primitives pass
// Incoming primitives are clipped against against pixel the frustum boundaries
// and stored in all buckets overlapping the clipped primitive
// Note: This pass requires conservative rasterization, otherwise i) the minimum lod level must be 0 and (ii) oblique primitives might not be rasterized

#include "version.h"

#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

#define CAMERA_Z

#define NUM_CUBEMAPS			__NUM_FACES__
#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1

uniform sampler2D sampler_color;								// samplers and uniforms for alpha culling checks
uniform sampler2D sampler_opacity;
uniform uint	uniform_texture_mask;

in vec2 TexCoord;
flat in int		uniform_cube_index;								// the view index from the geometry shader
flat in uint	primitive_id;									// the primitive id
flat in vec4	prim_vertex_wcs[3];								// the incoming vertex positions from the geometry shader
uniform vec4	uniform_viewports[NUM_CUBEMAPS];				// viewport for all views
uniform vec3	uniform_plane_points_wcs[NUM_CUBEMAPS * 8];		// world space position of the frustum corners for all views

uniform mat4	uniform_view_array[NUM_CUBEMAPS];				// world->eye transformation for all views
uniform vec2	uniform_near_far[NUM_CUBEMAPS];					// near far clipping distance for all views

uniform int uniform_ab_mipmap;									// the lod level of the downscaled id buffer e.g. for a tile of 1x1 uniform_ab_mipmap = 0, for a tile of 2x2 uniform_ab_mipmap = 1, etc.

layout(binding = 0, r32ui  )	coherent	uniform		uimage2DArray		image_head_id_buffer;			// the storage location for the head textures (1 head pointer is used for each bucket)
layout(binding = 2, std430)		coherent	buffer		LLD_ID				{ NodeTypeTrace		nodes[]; };	// the id buffer
layout(binding = 3, std430)		readonly	buffer		LLD_PRIMITIVE		{ NodeTypePrimitive nodes_primitives[]; }; // the vertex buffer
layout(binding = 4, offset = 0)				uniform		atomic_uint			next_address;					// the next address counter for the id buffer

layout(binding = 11) uniform sampler2DArray tex_depth_bounds;	// the depth bounds texture

#define PEEL_HEAD_LAYER_OFFSET 1
// set the incoming value as the head and the returned value as the next pointer
uint  exchangeidBufferHead(const int  b	 , const uint val)	{ return					imageAtomicExchange	(image_head_id_buffer,		ivec3(gl_FragCoord.xy, PEEL_HEAD_LAYER_OFFSET + b), val);}

#include "DIRT/DIRT_clip.glsl"

void main(void)
{	
#if CONSERVATIVE == 0
	return;
#endif

	// fetch incoming data, perform texture fetches, etc
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);

	// opacity map fetches
	uint hasop		= (uniform_texture_mask & 0x10u) >> 4u;
	float opacity_map = (hasop > 0u) ? texture(sampler_opacity, TexCoord.st).x : 0.0;

	// increase the counter in the list to find next address
	uint index = atomicCounterIncrement(next_address)  + 1U;
	uint l = nodes.length();

	bool should_cull = tex_color.a < 0.5 || opacity_map == 1.0;
	if (should_cull || index >= l) return;

	// clip the primitive against the frustum boundaries
	vec3 p1 = nodes_primitives[primitive_id].vertex1.xyz;
	vec3 p2 = nodes_primitives[primitive_id].vertex2.xyz;
	vec3 p3 = nodes_primitives[primitive_id].vertex3.xyz;
	vec2 bounds = clip(p1, p2, p3, 0);
	float	minZ		= bounds.x;
	float	maxZ		= bounds.y;

	// find the bucket range overlapping the clipped primitive
	ivec2	coords_lod = ivec2(gl_FragCoord.xy);
	vec2	depths		= texelFetch(tex_depth_bounds, ivec3(coords_lod, uniform_cube_index), 
#if CONSERVATIVE == 1
	0
#else
	uniform_ab_mipmap
#endif	
	).rg;
	float	depth_near	= -depths.r;
	float	depth_far	=  depths.g;

	float	depth_length = depth_far - depth_near;
	int		b0			 = min(int((float(BUCKET_SIZE)*((minZ - depth_near)/depth_length))),BUCKET_SIZE_1n); 
	int		b1			 = min(int((float(BUCKET_SIZE)*((maxZ - depth_near)/depth_length))),BUCKET_SIZE_1n);

	// for vertical to view direction polygons use only one value
	//if (maxZ - minZ < EPSILON)
	{
		//float	normalized_depth = (maxZ - depth_near)/(depth_length);
	//	normalized_depth	= clamp(normalized_depth, 0.0, 1.0);
		//b0 = int(floor(float(BUCKET_SIZE)*normalized_depth));
		//b1 = b0;
	}

	b0 = uniform_cube_index * BUCKET_SIZE + b0;
	// increase the counter in the list to find next address
	b1 = uniform_cube_index * BUCKET_SIZE + b1;
	int b = 0;
#ifdef USE_BUCKETS
	for(; b<=BUCKET_SIZE_1n && b0 <= b1 && index < l; b++,b0++)
#endif	
	{	
		nodes[index].next			= exchangeidBufferHead(b0, index);
		nodes[index].primitive_id	= primitive_id;
#ifdef USE_BUCKETS
		index = atomicCounterIncrement(next_address) + 1U;
#endif	
	}
}
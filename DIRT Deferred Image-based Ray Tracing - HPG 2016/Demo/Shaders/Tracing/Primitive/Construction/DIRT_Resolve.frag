// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains fragment implementation of preview functionality for the ADS

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

#define CAMERA_Z
#define BUCKET_SIZE				__BUCKET_SIZE__
#define NUM_CUBEMAPS			__NUM_FACES__

layout(binding = 0, r32ui  )	coherent  uniform uimage2DArray	  image_hit_buffer_head;							// the hit buffer head id texture
layout(binding = 1, std430)		coherent buffer  LL_SHADING		 { NodeTypeShading			nodes_shading []; };	// the shading buffer
layout(binding = 2, std430)		coherent buffer  LL_ID			 { NodeTypeTrace		nodes[]; };					// the id buffer
layout(binding = 3, std430)		readonly buffer  LL_PRIMITIVE	 { NodeTypePrimitive nodes_primitives[]; };			// the vertex buffer	

layout(binding = 5, r32ui  )	coherent  uniform uimage2DArray	  tex_head_id_buffer;								// the id buffer head id texture

layout(binding = 11) uniform sampler2DArray tex_depth_bounds;														// the depth bounds texture, used for HiZ

#define PEEL_HEAD_LAYER_OFFSET 1
// gets the hit buffer head for the current pixel
uint  getPixelHeadHitBuffer	(const ivec2 coords, const int b) { return	imageLoad (image_hit_buffer_head		, ivec3(coords, PEEL_HEAD_LAYER_OFFSET + b)).x; }
// gets the id buffer head for the current pixel
uint  getPixelHeadidBuffer	(const ivec2 coords, const int b) { return	imageLoad (tex_head_id_buffer	, ivec3(coords, PEEL_HEAD_LAYER_OFFSET + b)).x; }

#define RESOLVE_LAYER											// visualization data used only for preview purposes
#if defined (RESOLVE_LAYER)
	uniform int	uniform_ab_mipmap;								// the minimum lod of the id buffer and the depth texture (e.g., for block size 1 lod=0, block size 2 lod = 1, etc.)
	uniform int	uniform_depth_mipmap;							// the maximum lod of the depth texture (used during HiZ)
	layout(location = 0, index = 0) out vec4 out_frag_color;	// the view index
#endif

uniform int uniform_cube_index;

#define VISUALIZE_DEPTH_MIPMAP 0 
#define VISUALIZE_PRIMITIVE_MIPMAP 1
#define VISUALIZE_FIRST_PRIMITIVE_MIPMAP 2 
#define VISUALIZE_PRIMITIVE_COUNT 3
#define VISUALIZE_FIRST_LAYER 4
#define VISUALIZATION 3

#include "normal_compression.h"
void main(void)
{			
#if VISUALIZATION == VISUALIZE_PRIMITIVE_COUNT
	// visualize primitive map
	ivec2	coords = ivec2(gl_FragCoord.xy)/ivec2(pow(2,uniform_ab_mipmap));
	vec4	color = vec4(0);
	//int		counterb[BUCKET_SIZE];
	int		counter = 0;
	bool store = false;
	for (int b=0; b<BUCKET_SIZE
	#ifndef USE_BUCKETS
		&& b < 1
	#endif // USE_BUCKETS
	; b++)
	{
		int	  _counterb = 0;
		int bucket  = uniform_cube_index * BUCKET_SIZE + b;
		uint index  = getPixelHeadHitBuffer(coords, bucket); 
		uint index2  = getPixelHeadidBuffer(coords, bucket);
		if (uniform_ab_mipmap > 0)
			index = index2;
		if(index == 0U) continue;
		while(index != 0U)	
		{
			++_counterb;
			index = nodes[index].next;
		}
		counter += _counterb;
		if (_counterb > 10) store = true;

	}
	out_frag_color = vec4(counter / float(100.0));

#endif // VISUALIZE_PRIMITIVE_MIPMAP

#if VISUALIZATION == VISUALIZE_PRIMITIVE_MIPMAP
	// visualize primitive map
	ivec2	coords = ivec2(gl_FragCoord.xy)/ivec2(pow(2,uniform_ab_mipmap));
	vec4 color = vec4(0);
	int counter = 0;
	for (int b=0; b<BUCKET_SIZE
	#ifndef USE_BUCKETS
		&& b < 1
	#endif // USE_BUCKETS
	; b++)
	{
		int bucket  = uniform_cube_index * BUCKET_SIZE + b;
		uint index  = getPixelHeadHitBuffer(coords, bucket);  
		uint index2  = getPixelHeadidBuffer(coords, bucket);
		if (uniform_ab_mipmap > 0)
			index = index2;
		if(index == 0U) continue;
		while(index != 0U)	
		{
			color += vec4(float(nodes[index].primitive_id) / 200000.0);
			++counter;
			index = nodes[index].next;
		}
	}
	out_frag_color = vec4(color / float(counter));
#endif // VISUALIZE_PRIMITIVE_MIPMAP
	
#if VISUALIZATION == VISUALIZE_FIRST_PRIMITIVE_MIPMAP
	// visualize first element of primitive map
	ivec2	coords = ivec2(gl_FragCoord.xy)/ivec2(pow(2,uniform_ab_mipmap));
	vec4 color = vec4(0);
	int counter = 0;
	for (int b=0; b<BUCKET_SIZE
	#ifndef USE_BUCKETS
		&& b < 1
	#endif // USE_BUCKETS
	; b++)
	{
		int bucket  = uniform_cube_index * BUCKET_SIZE + b;
		uint index  = getPixelHeadHitBuffer(coords, bucket);  
		uint index2  = getPixelHeadidBuffer(coords, bucket);
		if (uniform_ab_mipmap > 0)
			index = index2;
		if(index == 0U) continue;
		color = vec4(float(nodes[index].primitive_id) / 200000.0);
	}
	out_frag_color = vec4(color);
#endif // VISUALIZE_FIRST_PRIMITIVE_MIPMAP
	
#if VISUALIZATION == VISUALIZE_FIRST_LAYER
	//	out_frag_color = vec4(norm);
	if (uniform_cube_index == 0)
	{
		uvec2 dimensions = uvec2(imageSize(image_hit_buffer_head).xy);
#if CONSERVATIVE == 1
		dimensions *= uvec2(pow(2u,uniform_ab_mipmap));
#endif // CONSERVATIVE
		uvec2 frag = uvec2(floor(gl_FragCoord.xy));
		// store each 3-point pair sequentially
		uint resolve_index = int(frag.y * dimensions.x + frag.x) * 3 + 2u;
#ifdef NO_PACKING
		out_frag_color = nodes_shading[resolve_index].albedo;
#else
		out_frag_color = unpackUnorm4x8(nodes_shading[resolve_index].albedo);
#endif // NO_PACKING
	}
	else
	{
		// visualize depth mipmap
		ivec2 coord_lod = ivec2(gl_FragCoord.xy) / ivec2(pow(2,uniform_depth_mipmap));
		vec2	depths = texelFetch(tex_depth_bounds,  ivec3(coord_lod, uniform_cube_index), 
#if CONSERVATIVE == 1
	uniform_depth_mipmap - uniform_ab_mipmap
#else
	uniform_depth_mipmap
#endif
		).rg;
		float	depth_near	= -depths.r;
		float	depth_far	=  depths.g;
		float norm = depth_near/10.0;
		out_frag_color = vec4(norm);
	}
#endif // VISUALIZE_FIRST_LAYER

#if VISUALIZATION == VISUALIZE_DEPTH_MIPMAP
	// visualize depth mipmap
	ivec2 coord_lod = ivec2(gl_FragCoord.xy) / ivec2(pow(2,uniform_depth_mipmap));
	vec2	depths = texelFetch(tex_depth_bounds,  ivec3(coord_lod, uniform_cube_index), 
#if CONSERVATIVE == 1
	uniform_depth_mipmap - uniform_ab_mipmap
#else
	uniform_depth_mipmap
#endif
	).rg;
	float	depth_near	= -depths.r;
	float	depth_far	=  depths.g;
	//float norm = (depth_far - depth_near)/10.0;
	float norm = depth_near/100.0;	
	out_frag_color = vec4(norm);
#endif // VISUALIZE_DEPTH_MIPMAP


#ifdef STATISTICS
	int  counterTotal = 0;
	int  counterLocal = 0;
	int bucket = 0;
	uint index = 0U;
	ivec2 stat_coord_lod = ivec2(gl_FragCoord.xy) / ivec2(pow(2,uniform_depth_mipmap));
	vec2	stat_depths = texelFetch(tex_depth_bounds,  ivec3(stat_coord_lod, uniform_cube_index), 
#if CONSERVATIVE == 1
	uniform_depth_mipmap - uniform_ab_mipmap
#else
	uniform_depth_mipmap
#endif
	).rg;
	float	stat_depth_near	= -stat_depths.r;
	float	stat_depth_far	=  stat_depths.g;
	
	ivec2 stat_coords = ivec2(gl_FragCoord.xy)/ivec2(pow(2,uniform_ab_mipmap));
	vec4 counterB = vec4(0);
	counterTotal = 0;
	for (int b=0; b<BUCKET_SIZE; b++)
	{
		counterLocal = 0;
		bucket  = uniform_cube_index * BUCKET_SIZE + b;
		uint index  = getPixelHeadHitBuffer(stat_coords, bucket);  
		uint index2  = getPixelHeadidBuffer(stat_coords, bucket);
		if (uniform_ab_mipmap > 0)
			index = index2;
		if(index == 0U) continue;
		while(index > 0U && counterLocal < ABUFFER_GLOBAL_SIZE)	
		{
			index = nodes[index].next;
			counterLocal++;
		}
		counterTotal += counterLocal;
	}
	
	vec4 total = imageLoad(image_test, ivec2(gl_FragCoord.xy));
	total.x += counterTotal;
	if (total.y < counterTotal)
		total.y = counterTotal;
	total.z = uniform_cube_index + 1;
	imageStore(image_test, ivec2(gl_FragCoord.xy), total);
#endif
}


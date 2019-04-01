// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled S-Buffer fragment implementation of TraceTest stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "trace_define.h"
#include "data_structs.h"

#define __STORE_BUFFER__

layout(binding = 0, r32ui   ) readonly uniform uimage2D	  image_counter;
layout(binding = 1, r32ui   ) readonly uniform uimage2D	  image_head;
#if		defined (BUFFER_IMAGE)
layout(binding = 2, rgba32ui) readonly uniform uimageBuffer image_peel_data;
layout(binding = 3, rg32f	) readonly uniform  imageBuffer image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
layout(binding = 2, std430	) readonly buffer   SB_DATA		{ NodeTypeData data  []; };
layout(binding = 3, std430	) readonly buffer   SB_NODES	{ NodeTypeSB   nodes []; };
#endif

#if		defined (BUFFER_IMAGE)
uint sharedPoolGetColorValue	(const uint  index ) {return imageLoad (image_peel_data		, int(index)).r;  }
vec2 sharedPoolGetIdDepthValue	(const uint  index ) {return imageLoad (image_peel_id_depth	, int(index)).rg; }
#endif
uint getPixelNextAddress		(const ivec2 coords) {return imageLoad (image_head	 , coords).x-1U;}
uint getPixelFragCounter		(const ivec2 coords) {return imageLoad (image_counter, coords).x;   }

layout(location = 0, index = 0) out vec4 out_frag_color;

#if BINARY_SEARCH == 1
int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)
{
	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;

	// empty list
	uint counter = getPixelFragCounter(coords); 
	if (counter == 0U) return invalid_result;
	uint counter_1n = counter - 1U;

	uint init_index = getPixelNextAddress(coords);
		
	float maxZ_thickness = maxZ + THICKNESS;
	
	vec2 sceneZ;
#ifdef SINGLE_LAYER
	// single view test
#if		defined (BUFFER_IMAGE)
	sceneZ = sharedPoolGetIdDepthValue(init_index);
#elif	defined (BUFFER_STRUCT)
	sceneZ = vec2(nodes[init_index].index, nodes[init_index].depth);
#endif
	return  (sceneZ.g <= maxZ_thickness && sceneZ.g > minZ) ? int(sceneZ.r) : invalid_result;
#else

#if EARLY_SKIP == 1
#if		defined (BUFFER_IMAGE)
	// early skip if out of Z-slice bounds
	// 1. close depth check	 
	if (sharedPoolGetIdDepthValue(init_index).g < minZ) return invalid_result;

	// 2.far depth check
	if (sharedPoolGetIdDepthValue(init_index - counter_1n).g > maxZ_thickness) return invalid_result;		
#elif	defined (BUFFER_STRUCT)
	// early skip if out of Z-slice bounds
	// 1. close depth check	 
	if (nodes[init_index].depth < minZ) return invalid_result;

	// 2.far depth check
	if (nodes[init_index - counter_1n].depth > maxZ_thickness) return invalid_result;
#endif	
#endif
	int low = 0;
	int high = int(counter_1n);

	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool	reverseZ = increment <= 0;
	const float k1 = (reverseZ) ? minZ : maxZ_thickness;
	const float k2 = (reverseZ) ? maxZ_thickness : minZ;

	// continue searching while [low,high] is not empty
	float mid;
	int midpoint, index = invalid_result;
	while (low <= high)
	{
		// calculate the midpoint for roughly equal partition
		midpoint = low + ((high - low) >> 1);

#if		defined (BUFFER_IMAGE)
		mid = sharedPoolGetIdDepthValue(init_index - uint(midpoint)).g;
#elif	defined (BUFFER_STRUCT)
		mid = nodes[init_index - uint(midpoint)].depth;
#endif
		if (k1 >= mid)
		{
			// change min index to search upper subarray
			high = midpoint - 1;
			// set id to the current midpoint
			index = (reverseZ) ? high : midpoint; // index = high;
		}
		else
		{
			// change max index to search lower subarray
			low = midpoint + 1;
			// set id to the index next to the current midpoint
			index = (reverseZ) ? midpoint : low; // index = midpoint;
		}
	}

	// determine if we have collision with key2
	if (index < 0) return invalid_result;

	uint u_index = init_index - uint(index);
#if		defined (BUFFER_IMAGE)
	sceneZ = sharedPoolGetIdDepthValue(u_index);
#elif	defined (BUFFER_STRUCT)
	sceneZ = vec2(nodes[u_index].index, nodes[u_index].depth);
#endif
	return (reverseZ) ? (k2 >= sceneZ.g) ? int(sceneZ.r) : invalid_result : (k2 < sceneZ.g) ? int(sceneZ.r) : invalid_result;
#endif 
}
#else
int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)
{
	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;

	// empty list
	uint counter = getPixelFragCounter(coords);
	if (counter == 0U) return invalid_result;
	uint counter_1n = counter - 1U;

	uint init_index = getPixelNextAddress(coords);
		
	float maxZ_thickness = maxZ + THICKNESS;
	
	vec2 sceneZ;
#ifdef SINGLE_LAYER
	// single view test
#if		defined (BUFFER_IMAGE)
	sceneZ = sharedPoolGetIdDepthValue(init_index);
#elif	defined (BUFFER_STRUCT)
	sceneZ = vec2(nodes[init_index].index, nodes[init_index].depth);
#endif
	//float sceneZ = nodes[init_index].depth;
	return (sceneZ.g <= maxZ_thickness && sceneZ.g > minZ) ? int(sceneZ.r) : invalid_result;
#else

#if EARLY_SKIP == 1
#if		defined (BUFFER_IMAGE)
	// early skip if out of Z-slice bounds
	// 1. close depth check	 
	if (sharedPoolGetIdDepthValue(init_index).g < minZ) return invalid_result;

	// 2.far depth check
	if (sharedPoolGetIdDepthValue(init_index - counter_1n).g > maxZ_thickness) return invalid_result;		
#elif	defined (BUFFER_STRUCT)
	// early skip if out of Z-slice bounds
	// 1. close depth check	 
	if (nodes[init_index].depth < minZ) return invalid_result;

	// 2.far depth check
	if (nodes[init_index - counter_1n].depth > maxZ_thickness) return invalid_result;
#endif	
#endif 
	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool frontZ	= increment > 0;
	const uint  inc		= (frontZ) ? -1U : 1U;
	const uint  start	= (frontZ) ? init_index : init_index - counter_1n;
	const uint  end		= (frontZ) ? init_index - counter_1n - 1 : init_index + 1;

	int id = invalid_result;
	for (uint index = start; index != end && id < 0; index += inc)
	{
#if		defined (BUFFER_IMAGE)
		sceneZ = sharedPoolGetIdDepthValue(index);
#elif	defined (BUFFER_STRUCT)
		sceneZ = vec2(nodes[index].index, nodes[index].depth);
#endif
		if (sceneZ.g <= maxZ_thickness && sceneZ.g > minZ)
			id = int(sceneZ.r);
	}
	return id;
#endif

}
#endif

vec4 FetchResult(ivec3 coords_id)
{
#if		defined (BUFFER_IMAGE)
	return unpackUnorm4x8(sharedPoolGetColorValue(uint(coords_id.z)));
#elif	defined (BUFFER_STRUCT)
	return unpackUnorm4x8(data[coords_id.z].albedo);
#endif	// BUFFER_STRUCT
}

#include"trace_test.h"
void main(void)
{
	ivec2 size			= imageSize(image_counter).xy;
	out_frag_color		= traceTest(size);
}
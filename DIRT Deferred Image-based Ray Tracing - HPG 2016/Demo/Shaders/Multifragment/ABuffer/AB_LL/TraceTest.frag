// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// Linked-list fragment implementation of TraceTest stage
// Real-time concurrent linked list construction on the GPU (EGSR 2010)
// http://dx.doi.org/10.1111/j.1467-8659.2010.01725.x
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "data_structs.h"
#include "trace_define.h"

#define __STORE_BUFFER__

layout(binding = 0, r32ui )	readonly uniform uimage2D	  image_head;
#if		defined (BUFFER_IMAGE)
layout(binding = 2, rgba32f) readonly uniform imageBuffer image_peel;
#elif	defined (BUFFER_STRUCT)
layout(binding = 2, std430)	readonly buffer  LINKED_LISTS { NodeTypeDataLL nodes[]; };
#endif

#if		defined (BUFFER_IMAGE)
vec4 sharedPoolGetValue	(const uint  index ) {return imageLoad (image_peel	 , int(index)); }
#endif
uint getPixelHeadID		(const ivec2 coords) { return imageLoad (image_head, coords).x; }

layout(location = 0, index = 0) out vec4 out_frag_color;

int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)//, out vec2 test)
{
	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;

	// empty list
	uint init_index = getPixelHeadID(coords);
	if (init_index <= 0U) return invalid_result;
			
	float maxZ_thickness = maxZ + THICKNESS;
	
	float sceneZ;
#ifdef SINGLE_LAYER
	// single view test
#if		defined (BUFFER_IMAGE)
	sceneZ = sharedPoolGetValue(init_index).g;
#elif	defined (BUFFER_STRUCT)
	sceneZ = nodes[init_index].depth;
#endif
	return (sceneZ <= maxZ_thickness && sceneZ > minZ) ? int(init_index) : invalid_result;
#else

#if EARLY_SKIP == 1
	// early skip if out of Z-slice bounds
	// 1. close depth check
#if		defined (BUFFER_IMAGE)
	if (sharedPoolGetValue(init_index).g < minZ) return invalid_result;
#elif	defined (BUFFER_STRUCT)
	if (nodes[init_index].depth < minZ) return invalid_result;
#endif 
#endif 
	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool	frontZ = increment > 0;

	int  index_max = invalid_result;
	uint index	   = init_index;

	if(frontZ)
	{
		while(index != 0U && index_max < 0)
		{
	//	test.x++;
#if		defined (BUFFER_IMAGE)
			vec4 peel = sharedPoolGetValue(index);
			sceneZ = peel.g;
#elif	defined (BUFFER_STRUCT)
			NodeTypeDataLL node = nodes[index];
			//sceneZ = nodes[index].depth;
#endif
			if (node.depth <= maxZ_thickness && node.depth > minZ)
				index_max = int(index);
#if		defined (BUFFER_IMAGE)
			index	= floatBitsToUint(peel.b);
#elif	defined (BUFFER_STRUCT)
			index	= node.next;
#endif
		}
	}
	else
	{
		bool found = false;
		bool has_result = false;
		while(index != 0U && !has_result)
		{
	//	test.y++;
#if		defined (BUFFER_IMAGE)
			vec4 peel = sharedPoolGetValue(index);
			sceneZ = peel.g;
#elif	defined (BUFFER_STRUCT)
			NodeTypeDataLL node = nodes[index];
			//sceneZ = nodes[index].depth;
#endif
			if (node.depth <= maxZ_thickness && node.depth > minZ)
			{
				found = true;
				index_max = int(index);
			}
			else if (found)
				has_result = true;
#if		defined (BUFFER_IMAGE)
			index	= floatBitsToUint(peel.b);
#elif	defined (BUFFER_STRUCT)
			index	= node.next;
#endif
		} 
	}
	return index_max;
#endif 
}

vec4 FetchResult(ivec3 coords_id)
{
#if		defined (BUFFER_IMAGE)
	return unpackUnorm4x8(floatBitsToUint(sharedPoolGetValue(uint(coords_id.z)).r));
#elif	defined (BUFFER_STRUCT)
	return unpackUnorm4x8(nodes[coords_id.z].albedo);
#endif	// BUFFER_STRUCT
}

#include"trace_test.h"
void main(void)
{
	ivec2 size			= imageSize(image_head).xy;
	out_frag_color		= traceTest(size);
}
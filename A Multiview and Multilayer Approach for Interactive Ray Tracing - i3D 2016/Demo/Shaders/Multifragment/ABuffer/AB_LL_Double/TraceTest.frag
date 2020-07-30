// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Double linked-list fragment implementation of TraceTest stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "data_structs.h"
#include "trace_define.h"

layout(binding = 1, std430)	readonly buffer  LINKED_LISTS_DOUBLE  { NodeTypeDataLL_Double nodes[]; };

#ifdef SPIN_LOCK
layout(binding = 0, rg32ui)	readonly uniform uimage2D	 image_pointers;
uvec2	getPixelHeadTailID  (const ivec2 coords) { return imageLoad (image_pointers, coords).xy; }
#else
layout(binding = 0, r32ui)	readonly uniform uimage2DArray	 image_pointers;
uint	getPixelHeadID  (const ivec2 coords) { return imageLoad (image_pointers, ivec3(coords, 0)).x; }
uint	getPixelTailID  (const ivec2 coords) { return imageLoad (image_pointers, ivec3(coords, 1)).x; }
#endif // SPIN_LOCK
layout(location = 0, index = 0) out vec4 out_frag_color;


int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)//, out vec2 test)
{

	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;

	uvec2 init_index;
	
#ifdef SPIN_LOCK
	init_index = getPixelHeadTailID(coords);
#else
	init_index.x = getPixelHeadID(coords);
#endif // SPIN_LOCK
	if(init_index.x <= 0U) return invalid_result;
	
	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	bool	reverseZ = increment < 0;	
	float maxZ_thickness = maxZ + THICKNESS;
	/*
	float midZ = -(maxZ_thickness + minZ) * 0.5;
	float depth_range = abs(nodes[init_index.y].depth - nodes[init_index.x].depth);
	float percent = (midZ - abs(nodes[init_index.x].depth)) / depth_range;
	int direction = percent <= 0.5 ? 1 : -1;
	*/
	//int iter = 0;

#if EARLY_SKIP == 1
	// early skip if out of Z-slice bounds

	// 1. close depth check
	if (nodes[init_index.x].depth < minZ) return invalid_result;
#endif // EARLY_SKIP

#ifdef SPIN_LOCK
#else
	init_index.y = getPixelTailID(coords);
#endif // SPIN_LOCK	
#if EARLY_SKIP == 1
	// 2.far depth check 
	if (nodes[init_index.y].depth > maxZ_thickness) return invalid_result;
#endif // EARLY_SKIP

	float sceneZ;
#ifdef SINGLE_LAYER
	// single view test
	sceneZ = nodes[init_index.x].depth;
	return (sceneZ <= maxZ_thickness && sceneZ > minZ) ? int(init_index.x) : invalid_result;
#else
	
	int  index_max = invalid_result;
	uint index;
	/*
	if (direction > 0)
	{
		// start from the head
		index = init_index.x;
		if(!reverseZ)
		{
			while(index != 0U && index_max < 0)
			{
				sceneZ  = nodes[index].depth;
				if (sceneZ <= maxZ_thickness && sceneZ > minZ)
					index_max = int(index);
				index	= nodes[index].next;
			}
		}
		else
		{
			bool found = false;
			bool has_result = false;
			while(index != 0U && !has_result)
			{
				sceneZ = nodes[index].depth;
				if (sceneZ <= maxZ_thickness && sceneZ > minZ)
				{
					found = true;
					index_max = int(index);
				}
				else if (found)
					has_result = true;
				index	= nodes[index].next;
			} 
		}
	}
	else
	{
		// start from the tail
		index = init_index.y;
		if(reverseZ)
		{
			while(index != 0U && index_max < 0)
			{
				sceneZ  = nodes[index].depth;
				if (sceneZ <= maxZ_thickness && sceneZ > minZ)
					index_max = int(index);
				index	= nodes[index].prev;
			}
		}
		else
		{
			bool found = false;
			bool has_result = false;
			while(index != 0U && !has_result)
			{
				sceneZ = nodes[index].depth;
				if (sceneZ <= maxZ_thickness && sceneZ > minZ)
				{
					found = true;
					index_max = int(index);
				}
				else if (found)
					has_result = true;
				index	= nodes[index].prev;
			} 
		}
	}
	*/

	if(reverseZ)
	{
		index = init_index.y;
		while(index != 0U && index_max < 0)
		{		
			NodeTypeDataLL_Double node = nodes[index];
			if (node.depth <= maxZ_thickness && node.depth > minZ)
				index_max = int(index);
			index	= node.prev;
			//test.y ++;
		}
	} 
	else
	{
		index = init_index.x;
		while(index != 0U && index_max < 0)
		{			
			NodeTypeDataLL_Double node = nodes[index];
			if (node.depth <= maxZ_thickness && node.depth > minZ)
				index_max = int(index);
			index	= node.next;
			//test.x ++;
		}
	}	

	return index_max;

#endif 
}

vec4 FetchResult(ivec3 coords_id)
{
	return unpackUnorm4x8(nodes[coords_id.z].albedo);
}

#include"trace_test.h"
void main(void)
{
	ivec2 size			= imageSize(image_pointers).xy;		
	out_frag_color		= traceTest(size);
}
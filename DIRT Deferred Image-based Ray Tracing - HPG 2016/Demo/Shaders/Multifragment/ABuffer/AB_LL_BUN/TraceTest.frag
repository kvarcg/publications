// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// Linked-list with buckets fragment implementation of TraceTest stage
// Depth-Fighting Aware Methods for Multifragment Rendering (TVCG 2013)
// http://dx.doi.org/10.1109/TVCG.2012.300
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "data_structs.h"
#include "trace_define.h"

#define BUCKET_SIZE		__BUCKET_SIZE__
#define BUCKET_SIZE_1n	BUCKET_SIZE - 1

	layout(binding = 0, r32ui )	readonly uniform uimage2DArray  image_head;
	layout(binding = 1, r32ui ) readonly uniform uimage2DArray	image_depth_bounds;
	float getPixelDepthMin	(const ivec2 coords) { return uintBitsToFloat	(imageLoad (image_depth_bounds, ivec3(coords, 0)).r);}
	float getPixelDepthMax	(const ivec2 coords) { return uintBitsToFloat	(imageLoad (image_depth_bounds, ivec3(coords, 1)).r);}
	layout(binding = 2, std430)	readonly buffer  LINKED_LISTS  { NodeTypeDataLL nodes[]; };

uint  getPixelHeadID	(const ivec3 coords) { return	imageLoad (image_head, coords).x; }

layout(location = 0, index = 0) out vec4 out_frag_color;

int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)
{
	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;
	
	// early skip if out of Z-slice bounds
	float depth_near    = getPixelDepthMin(coords);
	
#if EARLY_SKIP == 1
	// 1. close depth check
	if (minZ >= -depth_near) return invalid_result;
#endif // EARLY_SKIP
		
	float maxZ_thickness = maxZ + THICKNESS;
	float depth_far = getPixelDepthMax(coords);

#if EARLY_SKIP == 1
	// 1. far depth check
	if (maxZ_thickness <= -depth_far) return invalid_result;
#endif // EARLY_SKIP

#ifdef USE_BUCKETS
	float	depth_length = depth_near - depth_far;
	int		b0			 = (						maxZ_thickness >= -depth_near) ? 0				: min(int((float(BUCKET_SIZE)*((depth_near + maxZ)/depth_length))),BUCKET_SIZE_1n); 
	int		b1			 = (b0 == BUCKET_SIZE_1n || minZ		   <= -depth_far ) ? BUCKET_SIZE_1n : min(int((float(BUCKET_SIZE)*((depth_near + minZ)/depth_length))),BUCKET_SIZE_1n);
	int		d			 = max(0, b1-b0);
#else
	int b0 = 0;
	int b1 = BUCKET_SIZE_1n;
	int d = 3;
#endif // USE_BUCKETS

	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool	frontZ  = increment > 0;
	const int	inc		= (frontZ) ?  1 : -1;
			int	b		= (frontZ) ? b0 : b1;
		
	bool found		= false;
	bool has_result = false;
	int	 index_max	= invalid_result;
	for(uint i=0; i <= d && index_max == invalid_result && !has_result; i++, b += inc)
	{
		uint init_index = getPixelHeadID(ivec3(coords, b));
		if(init_index <= 0U)
			continue;

		float sceneZ;
#ifdef SINGLE_LAYER
		// single view test
		sceneZ = nodes[init_index].depth;
		return (sceneZ <= maxZ_thickness && sceneZ > minZ) ? int(init_index) : invalid_result;
#else

		uint		index		= init_index;
		if(frontZ)
		{
			while(index != 0U && index_max < 0)
			{
				NodeTypeDataLL node = nodes[index];
				//sceneZ = nodes[index].depth;
				if (node.depth <= maxZ_thickness && node.depth > minZ)
					index_max = int(index);
				index	= node.next;
			}
		}
		else
		{
			bool found = false;
			bool has_result = false;
			while(index != 0U && !has_result)
			{
				NodeTypeDataLL node = nodes[index];
				//sceneZ = nodes[index].depth;
				if (node.depth <= maxZ_thickness && node.depth > minZ)
				{
					found = true;
					index_max = int(index);
				}
				else if (found)
					has_result = true;
				index	= node.next;
			} 
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
	ivec2 size			= imageSize(image_head).xy;
	out_frag_color		= traceTest(size);
}
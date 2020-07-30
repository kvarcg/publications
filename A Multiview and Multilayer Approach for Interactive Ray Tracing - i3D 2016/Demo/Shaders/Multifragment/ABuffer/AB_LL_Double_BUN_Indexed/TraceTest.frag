// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled double linked-list with buckets fragment implementation of TraceTest stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "data_structs.h"
#include "trace_define.h"

#define __STORE_BUFFER__

#define BUCKET_SIZE		__BUCKET_SIZE__
#define BUCKET_SIZE_1n	BUCKET_SIZE - 1

#ifdef MULTITEX
layout(binding = 0, r32ui )	readonly uniform uimage2DArray  image_head;
layout(binding = 1, r32ui)	coherent uniform uimage2DArray	image_tail;
uint  getPixelTailID	(const ivec3 coords) { return imageLoad (image_tail, coords).x; }
uint  getPixelHeadID	(const ivec3 coords) { return imageLoad (image_head, coords).x; }
#else
#ifdef SPIN_LOCK
layout(binding = 0, rg32ui)	readonly uniform uimage2DArray	 image_head;
uvec2	getPixelHeadTailID  (const ivec3 coords) { return imageLoad (image_head, coords).xy; }
#else
layout(binding = 0, r32ui)	readonly uniform uimage2DArray	 image_head;
uint	getPixelTailID	(const ivec3 coords) { return imageLoad (image_head, coords).x; }
uint    getPixelHeadID	(const ivec3 coords) { return imageLoad (image_head, coords).x; }
#endif // SPIN_LOCK
#endif // MULTITEX

layout(binding = 2, r32ui ) readonly uniform uimage2DArray	image_depth_bounds;
#if		defined (BUFFER_IMAGE)
layout(binding = 3, rgba32ui) readonly uniform uimageBuffer image_peel_data;
layout(binding = 4, rgba32f ) readonly uniform  imageBuffer image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
layout(binding = 3, std430)		readonly buffer  LL_DATA	 { NodeTypeData			data []; };
layout(binding = 4, std430)		coherent buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };
#endif

#if		defined (BUFFER_IMAGE)
vec4 sharedPoolGetIdDepthValue	(const uint  index ) {return imageLoad (image_peel_id_depth	, int(index)); }
uvec4 sharedPoolGetDataValue	(const uint  index ) {return imageLoad (image_peel_data		, int(index)); }
#endif

float getPixelDepthMin	(const ivec2 coords) { return uintBitsToFloat	(imageLoad (image_depth_bounds, ivec3(coords, 0)).r);}
float getPixelDepthMax	(const ivec2 coords) { return uintBitsToFloat	(imageLoad (image_depth_bounds, ivec3(coords, 1)).r);}

layout(location = 0, index = 0) out vec4 out_frag_color;

int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)
{
	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;

	// early skip if out of Z-slice bounds
	float	depth_near   = getPixelDepthMin(coords);
#if EARLY_SKIP == 1
	// 1. close depth check
	if (minZ >= -depth_near) return invalid_result;
#endif // EARLY_SKIP
	
	float maxZ_thickness = maxZ + THICKNESS;
	
	float	depth_far    = getPixelDepthMax(coords);
#if EARLY_SKIP == 1
	// 2. far depth check
	if (maxZ_thickness <= -depth_far) return invalid_result;
#endif // EARLY_SKIP

#ifdef USE_BUCKETS
	float	depth_length = depth_near - depth_far;
	int		b0			 = (maxZ_thickness >= -depth_near) ? 0 : min(int((float(BUCKET_SIZE)*((depth_near + maxZ)/depth_length))),BUCKET_SIZE_1n); 
	int		b1			 = (b0 == 3 || minZ <= -depth_far ) ? 3 : min(int((float(BUCKET_SIZE)*((depth_near + minZ)/depth_length))),BUCKET_SIZE_1n);
	int		d			 = max(0, b1-b0);
#else
	int b0 = 0;
	int b1 = BUCKET_SIZE_1n;
	int d = 3;
#endif // USE_BUCKETS

	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool	reverseZ = increment < 0;
	const int	inc		 = (reverseZ) ? -1 : 1;
			int	b		 = (reverseZ) ? b1 : b0;

	uvec2 init_index;
	float sceneZ;		
	int	 index_max	= invalid_result;
	for(int i=0; i <= d && index_max == invalid_result; i++, b += inc)
	{
#ifdef MULTITEX
	init_index.x = getPixelHeadID(ivec3(coords, b));
#else
#ifdef SPIN_LOCK
	init_index = getPixelHeadTailID(ivec3(coords, b));
#else
	init_index.x = getPixelHeadID(ivec3(coords, BUCKET_SIZE + b));
#endif // SPIN_LOCK
#endif // MULTITEX

		if(init_index.x <= 0U)
			continue;

#ifdef SINGLE_LAYER
		// single view test
#if		defined (BUFFER_IMAGE)
		sceneZ = sharedPoolGetIdDepthValue(init_index.x).g;
#elif	defined (BUFFER_STRUCT)
		sceneZ = nodes[init_index.x].depth;
#endif
		return (sceneZ <= maxZ_thickness && sceneZ > minZ) ? int(init_index.x) : invalid_result;
#else
 
		uint index;
#if		defined (BUFFER_IMAGE)	
		if(!reverseZ)
		{
			index = init_index.x;
			while(index != 0U && index_max < 0)
			{
				vec4 peel = sharedPoolGetIdDepthValue(index);
				sceneZ = peel.g;
				if (sceneZ <= maxZ_thickness && sceneZ > minZ)
					index_max = int(index);
				index	= uint(peel.r);
			}
		}
		else
		{
			index = getPixelTailID(ivec3(coords, b));
			while(index != 0U && index_max < 0)
			{
				vec4 peel = sharedPoolGetIdDepthValue(index);
				sceneZ = peel.g;
				if (sceneZ < maxZ_thickness && sceneZ >= minZ)
					index_max = int(index);
				index	= uint(peel.b);
			}
		}
#elif	defined (BUFFER_STRUCT)
		if(reverseZ)
		{
#ifdef MULTITEX
			index = getPixelTailID(ivec3(coords, b));
#else
#ifdef SPIN_LOCK
			index = init_index.y;
#else
			index = getPixelTailID(ivec3(coords, BUCKET_SIZE + b));
#endif // SPIN_LOCK
#endif // MULTITEX

			while(index != 0U && index_max < 0)
			{
				sceneZ  = nodes[index].depth;
				NodeTypeLL_Double node = nodes[index];
				if (node.depth <= maxZ_thickness && node.depth > minZ)
					index_max = int(index);
				index	= node.prev;
			}
		}
		else
		{
			index = init_index.x;
			while(index != 0U && index_max < 0)
			{
				NodeTypeLL_Double node = nodes[index];
				if (node.depth <= maxZ_thickness && node.depth > minZ)
					index_max = int(index);
				index	= node.next;
			}
		}
#endif 
	}
	return index_max;
#endif 
}

vec4 FetchResult(ivec3 coords_id)
{
#if		defined (BUFFER_IMAGE)
	return unpackUnorm4x8(sharedPoolGetDataValue(uint(coords_id.z)).r);
#elif	defined (BUFFER_STRUCT)
	return unpackUnorm4x8(data[coords_id.z].albedo);
#endif	// BUFFER_STRUCT
}

#include"trace_test.h"
void main(void)
{
	ivec2 size			= imageSize(image_head).xy;
	out_frag_color		= traceTest(size);
}
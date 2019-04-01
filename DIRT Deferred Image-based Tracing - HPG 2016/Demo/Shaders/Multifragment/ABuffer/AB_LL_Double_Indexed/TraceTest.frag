// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled double linked-list fragment implementation of TraceTest stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "data_structs.h"
#include "trace_define.h"

#define __STORE_BUFFER__

#if UNIFORM_FRAG_DISTRIBUTION
#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#endif // UNIFORM

#if		defined (BUFFER_IMAGE)
	layout(binding = 1, rgba32ui) readonly uniform uimageBuffer image_peel_data;
	layout(binding = 2, rgba32f ) readonly uniform  imageBuffer image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 1, std430)	readonly buffer  LL_DATA	 { NodeTypeData			data []; };
	layout(binding = 2, std430)	readonly buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };
#endif

#if		defined (BUFFER_IMAGE)
	 vec4 sharedPoolGetIdDepthValue	(const uint  index ) {return imageLoad (image_peel_id_depth	, int(index)); }
	uvec4 sharedPoolGetDataValue	(const uint  index ) {return imageLoad (image_peel_data		, int(index)); }
#endif

#if UNIFORM_FRAG_DISTRIBUTION
	layout(binding = 0, r32ui)	readonly uniform uimage2DArray	 image_pointers;
	uint getPixelHeadID				(const ivec3 coords) { return imageLoad (image_pointers, coords).x; }
	uint getPixelTailID				(const ivec2 coords) { return imageLoad (image_pointers, ivec3(coords, BUCKET_SIZE)).x; }
#else
	#ifdef SPIN_LOCK
	layout(binding = 0, rg32ui)	readonly uniform uimage2D	 image_pointers;
	uvec2	getPixelHeadTailID  (const ivec2 coords) { return imageLoad (image_pointers, coords).xy; }
	#else
	layout(binding = 0, r32ui)	readonly uniform uimage2DArray	 image_pointers;
	uint	getPixelHeadID  (const ivec2 coords) { return imageLoad (image_pointers, ivec3(coords, 0)).x; }
	uint	getPixelTailID  (const ivec2 coords) { return imageLoad (image_pointers, ivec3(coords, 1)).x; }
	#endif // SPIN_LOCK
#endif // UNIFORM_FRAG_DISTRIBUTION

	layout(location = 0, index = 0) out vec4 out_frag_color;
	
#if UNIFORM_FRAG_DISTRIBUTION

	float getPixelBucketDepth(const ivec3 coords)
	{
		uint head = getPixelHeadID(coords);
		return
#if		defined (BUFFER_IMAGE)
				sharedPoolGetIdDepthValue(head).g;
#elif	defined (BUFFER_STRUCT)
				nodes[head].depth;
#endif
	}

	int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)
	{
	// maxZ out of bounds
		if (maxZ >= 0.0) return invalid_result;
		
		float maxZ_thickness = maxZ + THICKNESS;
		
#if EARLY_SKIP == 1
		// early skip if out of Z-slice bounds
		// 1. close depth check
		if (getPixelBucketDepth(ivec3(coords, 0)) < minZ) return invalid_result;

		// 2.far depth check 
		if (getPixelBucketDepth(ivec3(coords, BUCKET_SIZE)) > maxZ_thickness) return invalid_result;
#endif

		int b0=0, b1=3;
		//for (int b=1			 ; b<BUCKET_SIZE && (maxZ < getPixelBucketDepth(ivec3(coords, b))); b++)
		//	b0 = b; 

		//for (int b=BUCKET_SIZE_1n; b>0			 && (minZ > getPixelBucketDepth(ivec3(coords, b))); b--)
		//	b1 = b - 1;

		// increment is positive if the ray is moving in the direction of the camera, 
		// negative towards the camera (which must flip the search order)
		vec4  peel;
		uint  index;
		float sceneZ;		
		int	  index_max	= invalid_result;
		uvec2 init_index;

		if (increment < 0)
		{
			init_index.x = (b0==0) ? 0U : getPixelHeadID(ivec3(coords, b0));
			init_index.y = getPixelHeadID(ivec3(coords, b1+1));
			
			index		 = init_index.y;
			while(index != init_index.x && index_max < 0)
			{
#if		defined (BUFFER_IMAGE)
				peel		= sharedPoolGetIdDepthValue(index);
				sceneZ		= peel.g;
#elif	defined (BUFFER_STRUCT)
				sceneZ		= nodes[index].depth;
#endif
				if (sceneZ < maxZ_thickness && sceneZ >= minZ)
					index_max	= int(index);
#if		defined (BUFFER_IMAGE)
				index			= uint(peel.b);
#elif	defined (BUFFER_STRUCT)
				index			= nodes[index].prev;
#endif
			}
		}
		else
		{	
			init_index.x = getPixelHeadID(ivec3(coords, b0));
			init_index.y = (b1==3) ? 0U : getPixelHeadID(ivec3(coords, b1+1));
			
			index		 = init_index.x;
			while(index != init_index.y && index_max < 0)
			{
#if		defined (BUFFER_IMAGE)
				peel		= sharedPoolGetIdDepthValue(index);
				sceneZ		= peel.g;
#elif	defined (BUFFER_STRUCT)
				sceneZ		= nodes[index].depth;
#endif
				if (sceneZ < maxZ_thickness && sceneZ >= minZ)
					index_max	= int(index);
#if		defined (BUFFER_IMAGE)
				index			= uint(peel.r);
#elif	defined (BUFFER_STRUCT)
				index			= nodes[index].next;
#endif
			}
		}
		return index_max;
	}

#else
	int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment)
	{
		// maxZ out of bounds
		if (maxZ >= 0.0) return invalid_result;

		// empty list
		uvec2 init_index;
#ifdef SPIN_LOCK
	init_index = getPixelHeadTailID(coords);
#else
	init_index.x = getPixelHeadID(coords);
#endif // SPIN_LOCK
		if(init_index.x <= 0U) return invalid_result;

		float maxZ_thickness = maxZ + THICKNESS;
		
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
#if		defined (BUFFER_IMAGE)
		sceneZ = sharedPoolGetIdDepthValue(init_index.x).g;
#elif	defined (BUFFER_STRUCT)
		sceneZ = nodes[init_index.x].depth;
#endif
		return (sceneZ <= maxZ_thickness && sceneZ > minZ) ? init_index : invalid_result;
#else
		// increment is positive if the ray is moving in the direction of the camera, 
		// negative towards the camera (which must flip the search order)
		const bool reverseZ = increment < 0;
				
		int  index_max = invalid_result;
		uint index;
#if		defined (BUFFER_IMAGE)
		if(reverseZ)
		{
			index = init_index.y;
			while(index != 0U && index_max < 0)
			{
				vec4 peel = sharedPoolGetIdDepthValue(index);
				sceneZ = peel.g;
				if (sceneZ < maxZ_thickness && sceneZ >= minZ)
					index_max = int(index);
				index	= int(peel.b);
			}
		}
		else
		{
			index = init_index.x;
			while(index != 0U && index_max < 0)
			{
				vec4 peel = sharedPoolGetIdDepthValue(index);
				sceneZ = peel.g;
				if (sceneZ <= maxZ_thickness && sceneZ > minZ)
					index_max = int(index);
				index	= int(peel.r);
			}
		}
#elif	defined (BUFFER_STRUCT)
		if(reverseZ)
		{
			index = init_index.y;
			while(index != 0U && index_max < 0)
			{
				//sceneZ  = nodes[index].depth;
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
		return index_max;
#endif
	}
#endif

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
		ivec2 size			= imageSize(image_pointers).xy;
		out_frag_color		= traceTest(size);
	}
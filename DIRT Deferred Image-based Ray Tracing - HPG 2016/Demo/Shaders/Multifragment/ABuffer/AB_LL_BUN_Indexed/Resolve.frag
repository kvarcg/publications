// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled linked-list with buckets fragment implementation of Resolve stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"
#define __Z_COORD_SPACE__
#define __RESOLVE__
#define __STORE_BUFFER__
#define BUCKET_SIZE				__BUCKET_SIZE__
#include "sort2.h"

#if defined (RESOLVE_LAYER)
	layout(binding = 0, r32ui)		readonly uniform uimage2DArray	image_head;
#if		defined (BUFFER_IMAGE)
	layout(binding = 2, rgba32ui)	readonly uniform uimageBuffer   image_peel_data;
	layout(binding = 3, rg32f	)	readonly uniform  imageBuffer   image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 2, std430)		readonly buffer  LL_DATA	 { NodeTypeData	data []; };
	layout(binding = 3, std430)		readonly buffer  LL_NODES	 { NodeTypeLL	nodes[]; };
#endif
#else
	layout(binding = 0, r32ui)		coherent uniform uimage2DArray	image_head;
#if		defined (BUFFER_IMAGE)
	layout(binding = 2, rgba32ui)	coherent uniform uimageBuffer   image_peel_data;
	layout(binding = 3, rg32f	)	coherent uniform  imageBuffer   image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 2, std430)		coherent buffer  LL_DATA	 { NodeTypeData	data []; };
	layout(binding = 3, std430)		coherent buffer  LL_NODES	 { NodeTypeLL	nodes[]; };
#endif
#endif

#if		defined (BUFFER_IMAGE)
	uvec4 sharedPoolGetDataValue	(const uint index					) {return imageLoad (image_peel_data, int(index));}
	vec4  sharedPoolGetIdDepthValue	(const uint index					) {return imageLoad (image_peel_id_depth, int(index));}
#endif

#if defined (STORE_ONLY)
	void setPixelHeadID	(const int  b, const uint val) {		imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
#if		defined (BUFFER_IMAGE)
	void sharedPoolSetIdDepthValue	(const uint index, const  vec4 val) { imageStore(image_peel_id_depth, int(index), val);}
#endif
#endif
	uint getPixelHeadID	(const int  b				 ) { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).r;}

#if defined (RESOLVE_LAYER)
	uniform int	uniform_layer;

	layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

void main(void)
{
	int  counterTotal = 0;
	for (int b=0; b<BUCKET_SIZE; b++)
	{
		uint init_index = getPixelHeadID(b);
		if(init_index > 0U)
		{
			// 1. LOAD
			int  counterLocal = 0;
			uint index = init_index;
			while(index != 0U && counterLocal < ABUFFER_GLOBAL_SIZE)
			{
#if		defined (BUFFER_IMAGE)
				vec2 peel = sharedPoolGetIdDepthValue(index).rg;
				fragments[counterLocal] = vec2(float(index), peel.g);
				index	= floatBitsToUint(peel.r);
#elif	defined (BUFFER_STRUCT)
				fragments [counterLocal] = vec2(float(index), nodes[index].depth);
				index	= nodes[index].next;
#endif
				counterLocal++;
			}

			// 2. SORT
			sort(counterLocal);
			
#if defined (RESOLVE_LAYER)
			// 3. RESOLVE LAYER
			if(uniform_layer-counterTotal < counterLocal)
			{
#if		defined (BUFFER_IMAGE)
				out_frag_color = unpackUnorm4x8(sharedPoolGetDataValue(uint(fragments [uniform_layer-counterTotal].r)).r);
#elif	defined (BUFFER_STRUCT)
				out_frag_color = unpackUnorm4x8(data[uint(fragments [uniform_layer-counterTotal].r)].albedo);
#endif	
				return;
			}
			counterTotal += counterLocal;
#else

		// 3. FIX NEXT POINTERS
#if		defined (BUFFER_IMAGE)
		
			setPixelHeadID(b, uint(fragments [0].r));
			for(int i=0; i<counterLocal-1; i++)
				sharedPoolSetIdDepthValue(uint(fragments [i].r), vec4(fragments[i+1].r,fragments[i].g,0,0));
			sharedPoolSetIdDepthValue(uint(fragments [counterLocal-1].r), vec4(0,fragments[counterLocal-1].g,0,0));

#elif	defined (BUFFER_STRUCT)

			setPixelHeadID(b, uint(fragments [0].r));
			for(int i=0; i<counterLocal-1; i++)
				nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
			nodes[uint(fragments [counterLocal-1].r)].next = 0U;
#endif
#endif
		}
	}
	discard;
}
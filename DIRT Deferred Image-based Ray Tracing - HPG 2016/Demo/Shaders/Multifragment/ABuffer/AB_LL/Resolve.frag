// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// Linked-list fragment implementation of Resolve stage
// Real-time concurrent linked list construction on the GPU (EGSR 2010)
// http://dx.doi.org/10.1111/j.1467-8659.2010.01725.x
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

#define __STORE_BUFFER__

#if	defined (BUFFER_STRUCT)
#include "data_structs.h"
#endif

#define __Z_COORD_SPACE__
#define __RESOLVE__

#include "sort_define.h"

#if		defined (BUFFER_IMAGE)
#include "sort4.h"
#elif	defined (BUFFER_STRUCT)
#include "sort2.h"
#endif

#if		defined (RESOLVE_LAYER)
	layout(binding = 0, r32ui)		readonly uniform uimage2D	   image_head;
	layout(binding = 1, r32ui)		readonly uniform uimage2D	   image_counter;
#if		defined (BUFFER_IMAGE)
	layout(binding = 2, rgba32f	)	readonly uniform imageBuffer   image_peel;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 2, std430)		readonly buffer  LINKED_LISTS { NodeTypeDataLL nodes[]; };
#endif
#else
	layout(binding = 0, r32ui)		coherent uniform uimage2D	   image_head;
	layout(binding = 1, r32ui)		readonly uniform uimage2D	   image_counter;
#if		defined (BUFFER_IMAGE)
	layout(binding = 2, rgba32f	)	coherent uniform imageBuffer   image_peel;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 2, std430)		coherent buffer  LINKED_LISTS { NodeTypeDataLL nodes[]; };
#endif
#endif

#if		defined (BUFFER_IMAGE)
	vec4 sharedPoolGetValue		(const uint index					) {return imageLoad (image_peel, int(index));}
#endif

	uint getPixelFragCounter() { return imageLoad (image_counter, ivec2(gl_FragCoord.xy)).x;}
	uint getPixelHeadID		() { return	imageLoad (image_head	, ivec2(gl_FragCoord.xy)).x;}

#if		defined (STORE_ONLY)
	void setPixelHeadID		(const uint val	) { imageStore(image_head, ivec2(gl_FragCoord.xy), uvec4(val,0u,0u,0u));}
#if		defined (BUFFER_IMAGE)
	void sharedPoolSetValue	(const uint index, const  vec4 val	) {		  imageStore(image_peel, int(index), val);}
#endif
#else
	uniform int	uniform_layer;

	layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

void main(void)
{
	int  counterLocal = 0;
	int	 counterTotal = int(getPixelFragCounter());
	
	if(counterTotal > 0)
	{
		uint init_index = getPixelHeadID();
		// 1. LOAD
		uint index = init_index;
		for(int i=0; i<counterTotal; i++)
		{
#if		defined (BUFFER_IMAGE)
			fragments[counterLocal] = sharedPoolGetValue(index);
			index	= floatBitsToUint(fragments[counterLocal].b);
#elif	defined (BUFFER_STRUCT)
			fragments[counterLocal] = vec2(float(index), nodes[index].depth);
			index	= nodes[index].next;
#endif
			counterLocal++;
		}

		// 2. SORT
		sort(counterLocal);
			
#if defined (RESOLVE_LAYER)
		// 3. RESOLVE LAYER
		if(uniform_layer < counterLocal)
#if		defined (BUFFER_IMAGE)
			out_frag_color = unpackUnorm4x8(floatBitsToUint(fragments [uniform_layer].r));
#elif	defined (BUFFER_STRUCT)
			out_frag_color = unpackUnorm4x8(nodes[uint(fragments [uniform_layer].r)].albedo);
#endif
		else
			discard;
#else
		// 3. STORE
#if		defined (BUFFER_IMAGE)
		
		index = init_index;
		for(int i=0; i<counterTotal; i++)
		{
			vec4 peel = sharedPoolGetValue(index);
			sharedPoolSetValue(index, vec4(fragments[i].rg,peel.b,fragments[i].a));
			index	= floatBitsToUint(peel.b);
		}
#elif	defined (BUFFER_STRUCT)

		setPixelHeadID(uint(fragments [0].r));
		for(int i=0; i<counterLocal-1; i++)
			nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
		nodes[uint(fragments [counterLocal-1].r)].next = 0U;

#endif
		
#endif
	}

#if defined (RESOLVE_LAYER)
	if(uniform_layer < counterTotal)
		return;
	else
		discard;
#endif
}
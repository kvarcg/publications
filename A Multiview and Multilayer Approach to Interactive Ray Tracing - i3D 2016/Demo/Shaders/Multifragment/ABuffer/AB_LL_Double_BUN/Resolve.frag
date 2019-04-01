// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Double linked-list with buckets fragment implementation of Resolve stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"

#define __Z_COORD_SPACE__
#define __RESOLVE__
#define BUCKET_SIZE				__BUCKET_SIZE__
#include "sort2.h"

#ifdef MULTITEX
layout(binding = 0, r32ui)		coherent uniform uimage2DArray			image_head;
layout(binding = 1, r32ui)		coherent uniform uimage2DArray			image_tail;
void setPixelTailID	(const int  b,	const uint val) {		 imageStore(image_tail, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
uint getPixelHeadID	(const int  b				  ) { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).r;}
void setPixelHeadID	(const int  b,	const uint val) {		 imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
#else
#ifdef SPIN_LOCK
layout(binding = 0, rg32ui)		coherent uniform uimage2DArray image_pointers;

uvec2 getPixelHeadTailID  (const int  b)				 { return imageLoad (image_pointers, ivec3(gl_FragCoord.xy, b)).xy; }
void setPixelHeadTailID	 (const int  b,	const uvec2 val) {	imageStore(image_pointers, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u));}

#else
layout(binding = 0, r32ui)		coherent uniform uimage2DArray			image_head;
void setPixelTailID	(const int  b,	const uint val) {		 imageStore(image_head, ivec3(gl_FragCoord.xy, BUCKET_SIZE + b), uvec4(val,0u,0u,0u));}
uint getPixelHeadID	(const int  b				  ) { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).r;}
void setPixelHeadID	(const int  b,	const uint val) {		 imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
#endif // SPIN_LOCK
#endif // MULTITEX

layout(binding = 3, std430)		coherent buffer  LINKED_LISTS_DOUBLE  { NodeTypeDataLL_Double nodes[]; };

#if defined (RESOLVE_LAYER)
	uniform int	uniform_layer;

	layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

void main(void)
{
	int  counterTotal = 0;
	for (int b=0; b<BUCKET_SIZE; b++)
	{
		int  counterLocal = 0;
#ifdef MULTITEX
		uint init_index = getPixelHeadID(b);
#else
#ifdef SPIN_LOCK
		uint init_index = getPixelHeadTailID(b).x;
#else
		uint init_index = getPixelHeadID(b);
#endif // SPIN_LOCK
#endif // MULTITEX
		if(init_index > 0U)
		{
			// 1. LOAD
			uint index = init_index;
			while(index != 0U && counterLocal < ABUFFER_GLOBAL_SIZE)
			{
				fragments [counterLocal++] = vec2(float(index), nodes[index].depth);
				index	= nodes[index].next;
			}

			// 2. SORT
			sort(counterLocal);

#if defined (RESOLVE_LAYER)
			// 4. RESOLVE LAYER
			if(uniform_layer-counterTotal < counterLocal)
			{
				out_frag_color = unpackUnorm4x8(nodes[uint(fragments [uniform_layer-counterTotal].r)].albedo);
				return;
			}
#else
			// 3. FIX PREV POINTERS
			for(int i=counterLocal-1; i>0; i--)
				nodes[uint(fragments [i].r)].prev = uint(fragments [i-1].r);
			nodes[uint(fragments [0].r)].prev = 0U;

			// 4. FIX NEXT POINTERS
			for(int i=0; i<counterLocal-1; i++)
				nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
			nodes[uint(fragments [counterLocal-1].r)].next = 0U;

#ifdef MULTITEX
			setPixelTailID(b, uint(fragments [counterLocal-1].r));
			setPixelHeadID (b, uint(fragments [0].r));
#else
#ifdef SPIN_LOCK
			setPixelHeadTailID(b, uvec2(fragments [0].r, fragments [counterLocal-1].r));
#else
			setPixelTailID(b, uint(fragments [counterLocal-1].r));
			setPixelHeadID (b, uint(fragments [0].r));
#endif // SPIN_LOCK
#endif // MULTITEX

#endif
			counterTotal += counterLocal;
		}
	}

	discard;
}
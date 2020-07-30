// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Double linked-list fragment implementation of Resolve stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"
#define __Z_COORD_SPACE__
#define __RESOLVE__
#include "sort2.h"

layout(binding = 1, std430)		coherent buffer  LINKED_LISTS_DOUBLE  { NodeTypeDataLL_Double nodes[]; };

#if defined (STORE_ONLY)
#else
uniform int	uniform_layer;

layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

#ifdef SPIN_LOCK
layout(binding = 0, rg32ui)		coherent uniform uimage2D image_pointers;

uvec2 getPixelHeadTailID  (				) { return	imageLoad (image_pointers, ivec2(gl_FragCoord.xy)).xy; }
void setPixelHeadTailID	 (const uvec2 val) {	imageStore(image_pointers, ivec2(gl_FragCoord.xy), uvec4(val,0u,0u));}

#else
layout(binding = 0, r32ui)		coherent uniform uimage2DArray image_pointers;
uint getPixelHeadID  (				) { return	imageLoad (image_pointers, ivec3(gl_FragCoord.xy, 0)).x; }
uint getPixelTailID  (				) { return	imageLoad (image_pointers, ivec3(gl_FragCoord.xy, 1)).x; }

void setPixelTailID	 (const uint val) {			imageStore(image_pointers, ivec3(gl_FragCoord.xy, 1), uvec4(val,0u,0u,0u));}
void setPixelHeadID	 (const uint val) {			imageStore(image_pointers, ivec3(gl_FragCoord.xy, 0), uvec4(val,0u,0u,0u));}
#endif // SPIN_LOCK
	
void main(void)
{
	int  counter=0;
#ifdef SPIN_LOCK
	uint init_index = getPixelHeadTailID().x;
#else
	uint init_index = getPixelHeadID();
#endif // SPIN_LOCK
	if(init_index > 0U)
	{
		// 1. LOAD
		uint index = init_index;
		while(index != 0U && counter < ABUFFER_GLOBAL_SIZE)
		{
			fragments [counter++] = vec2(float(index), nodes[index].depth);
			index	= nodes[index].next;
		}

		// 2. SORT
		sort(counter);

#if defined (RESOLVE_LAYER)
		// 4. RESOLVE LAYER
		if(uniform_layer < counter)
			out_frag_color = unpackUnorm4x8(nodes[uint(fragments [uniform_layer].r)].albedo);
		else
			discard;
#else
		// 4. FIX NEXT POINTERS
		for(int i=0; i<counter-1; i++)
			nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
		nodes[uint(fragments [counter-1].r)].next = 0U;

		// 3. FIX PREV POINTERS
		for(int i=counter-1; i>0; i--)
			nodes[uint(fragments [i].r)].prev = uint(fragments [i-1].r);
		nodes[uint(fragments [0].r)].prev = 0U;

		
#ifdef SPIN_LOCK
		setPixelHeadTailID(uvec2(fragments [0].r, fragments [counter-1].r));
#else
		setPixelHeadID(uint(fragments [0].r));
		setPixelTailID(uint(fragments [counter-1].r));
#endif // SPIN_LOCK
#endif
	}
	else 
		discard;
}
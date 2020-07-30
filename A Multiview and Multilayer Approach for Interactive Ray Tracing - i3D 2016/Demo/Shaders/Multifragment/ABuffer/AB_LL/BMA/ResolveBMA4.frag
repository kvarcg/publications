//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
//                                                    //
//----------------------------------------------------//

#include "version.h"
#include "data_structs.h"

#define __Z_COORD_SPACE__
#define __RESOLVE__
#define __PIXEL_TEST__

#define INSERT_VS_SHELL			__SORTING_METHOD_SIZE__

#define ABUFFER_LOCAL_START		32
#define ABUFFER_LOCAL_END		64

#define ABUFFER_LOCAL_SIZE		ABUFFER_LOCAL_END
#define ABUFFER_LOCAL_SIZE_1n	ABUFFER_LOCAL_SIZE - 1

#include "sort2local.h"

#if defined (RESOLVE_LAYER)
	layout(binding = 0, r32ui)		readonly uniform uimage2D	   image_head;
	layout(binding = 1, r32ui)		readonly uniform uimage2D	   image_counter;
	layout(binding = 2, std430)		readonly buffer  LINKED_LISTS { NodeTypeDataLL nodes[]; };
#else
	layout(binding = 0, r32ui)		coherent uniform uimage2D	   image_head;
	layout(binding = 1, r32ui)		coherent uniform uimage2D	   image_counter;
	layout(binding = 2, std430)		coherent buffer  LINKED_LISTS { NodeTypeDataLL nodes[]; };
#endif

	uint getPixelFragCounter() { return imageLoad (image_counter, ivec2(gl_FragCoord.xy)).x;}
	uint getPixelHeadID		() { return	imageLoad (image_head	, ivec2(gl_FragCoord.xy)).x;}

#if defined (STORE_ONLY)
	void setPixelHeadID	(const uint val	) { imageStore(image_head, ivec2(gl_FragCoord.xy), uvec4(val,0u,0u,0u));}
#else
	uniform int	uniform_layer;

	layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

void main(void)
{
	int counterTotal = int(getPixelFragCounter());
#if defined (BLENDING)
	if (counterTotal > ABUFFER_LOCAL_START && counterTotal <= ABUFFER_LOCAL_END)
#endif
	{
		// 1. LOAD
		int  counterLocal = 0;
		uint index = getPixelHeadID();
		while(index != 0U)
		{
			fragments [counterLocal++] = vec2(float(index), nodes[index].depth);
			index	= nodes[index].next;
		}

		// 2. SORT
		sort_shell(counterLocal);
			
#if defined (RESOLVE_LAYER)
		// 3. RESOLVE LAYER
		if(uniform_layer < counterLocal)
			out_frag_color = unpackUnorm4x8(nodes[uint(fragments [uniform_layer].r)].albedo);
		else
			discard;
#else
		// 3. STORE
		setPixelHeadID(uint(fragments [0].r));
		for(int i=0; i<counterLocal-1; i++)
			nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
		nodes[uint(fragments [counterLocal-1].r)].next = 0U;
#endif
	}
#if defined (BLENDING)
	else
		out_frag_color = vec4(0);
#endif
}
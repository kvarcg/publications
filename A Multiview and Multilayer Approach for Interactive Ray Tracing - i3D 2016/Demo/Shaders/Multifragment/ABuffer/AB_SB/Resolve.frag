// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// S-Buffer fragment implementation of Resolve stage
// S-buffer: Sparsity-aware Multi-fragment Rendering (Short Eurographics 2012)
// http://dx.doi.org/10.2312/conf/EG2012/short/101-104
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"

#define __Z_COORD_SPACE__
#define __RESOLVE__
#define __STORE_BUFFER__
#include "sort4.h"

layout(binding = 0, r32ui  ) readonly  uniform uimage2D		image_counter;
layout(binding = 1, r32ui  ) readonly  uniform uimage2D		image_head;
#if		defined (BUFFER_IMAGE)
	layout(binding = 2, rgba32f	) coherent uniform  imageBuffer image_peel;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 2, std430	) coherent buffer   SBUFFER	{ NodeTypeDataSB nodes []; };
#endif

#if		defined (BUFFER_IMAGE)
	vec4 sharedPoolGetValue		(const uint index					) {return imageLoad (image_peel, int(index));}
	void sharedPoolSetValue		(const uint index, const  vec4 val	) {		  imageStore(image_peel, int(index), val);}
#endif

uint getPixelHeadAddress	(									) {return imageLoad (image_head	  , ivec2(gl_FragCoord.xy)).x-1U;}
uint getPixelFragCounter	(									) {return imageLoad (image_counter, ivec2(gl_FragCoord.xy)).x;   }

#if defined (RESOLVE_LAYER)
uniform int	uniform_layer;

layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

void main(void)
{
	int counter = int(getPixelFragCounter());
	if(counter > 0)
	{	
		// 1. LOAD
		uint init_index = getPixelHeadAddress();
		uint index		= init_index;

		for(uint i=0; i<counter; i++)
		{
#if		defined (BUFFER_IMAGE)
			fragments[i]  = sharedPoolGetValue(index);
#elif	defined (BUFFER_STRUCT)
			fragments[i] = vec4(uintBitsToFloat(nodes[index].albedo), nodes[index].depth, uintBitsToFloat(nodes[index].normal), uintBitsToFloat(nodes[index].specular));
#endif
			index--;
		}

		// 2. SORT
		sort(counter);
		
#if defined (RESOLVE_LAYER)
		// 3. RESOLVE LAYER
		if(uniform_layer < counter)
			out_frag_color = unpackUnorm4x8(floatBitsToUint(fragments[uniform_layer].r));
		else
			discard;
#else
		// 3. STORE
		index = init_index;
		for(uint i=0; i<counter; i++)
		{
#if		defined (BUFFER_IMAGE)
			sharedPoolSetValue(index--, fragments[i]);
#elif	defined (BUFFER_STRUCT)
			nodes[index].albedo		= floatBitsToUint(fragments[i].r);
			nodes[index].depth		= fragments[i].g;
			nodes[index].normal		= floatBitsToUint(fragments[i].b);
			nodes[index].specular	= floatBitsToUint(fragments[i].a);
			index--;
#endif
		}
#endif
	}	
}
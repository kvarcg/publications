// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled S-Buffer fragment implementation of Resolve stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"

#define __Z_COORD_SPACE__
#define __RESOLVE__
#define __STORE_BUFFER__
#include "sort2.h"

layout(binding = 0, r32ui  ) readonly  uniform uimage2D		image_counter;
layout(binding = 1, r32ui  ) readonly  uniform uimage2D		image_head;
#if		defined (BUFFER_IMAGE)
	layout(binding = 2, rgba32ui) coherent uniform uimageBuffer image_peel_data;
	layout(binding = 3, rg32f	) coherent uniform  imageBuffer image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 2, std430	) coherent buffer   SB_DATA		{ NodeTypeData data  []; };
	layout(binding = 3, std430	) coherent buffer   SB_NODES	{ NodeTypeSB   nodes []; };
#endif

#if		defined (BUFFER_IMAGE)
	float sharedPoolGetDepthValue	(const uint index					) {return imageLoad (image_peel_id_depth, int(index)).g;}
	uvec4 sharedPoolGetDataValue	(const uint index					) {return imageLoad (image_peel_data	, int(index));}
	void  sharedPoolSetIdDepthValue	(const uint index, const  vec4 val	) {		  imageStore(image_peel_id_depth, int(index), val);}
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
			fragments[i] = vec2(float(index), sharedPoolGetDepthValue(index));
#elif	defined (BUFFER_STRUCT)
			fragments[i] = vec2(float(index), nodes[index].depth);
#endif
			index--;
		}

		// 2. SORT
		sort(counter);
		
#if defined (RESOLVE_LAYER)
		// 3. RESOLVE LAYER
		if(uniform_layer < counter)
#if		defined (BUFFER_IMAGE)
			out_frag_color = unpackUnorm4x8(sharedPoolGetDataValue(uint(fragments[uniform_layer].r)).r);
#elif	defined (BUFFER_STRUCT)
			out_frag_color = unpackUnorm4x8(data[uint(fragments [uniform_layer].r)].albedo);
#endif
		else
			discard;
#else
		// 3. STORE
		index = init_index;
		for(uint i=0; i<counter; i++)
		{
#if		defined (BUFFER_IMAGE)
			sharedPoolSetIdDepthValue(index, vec4(fragments[i], 0, 0));
#elif	defined (BUFFER_STRUCT)
			nodes[index].index = uint(fragments[i].r);
			nodes[index].depth = fragments[i].g;
#endif
			index--;
		}
#endif
	}	
}
// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// Linked-list with buckets fragment implementation of Resolve stage
// Depth-Fighting Aware Methods for Multifragment Rendering (TVCG 2013)
// http://dx.doi.org/10.1109/TVCG.2012.300
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"

#define __Z_COORD_SPACE__
#define __RESOLVE__
#define BUCKET_SIZE				__BUCKET_SIZE__
#include "sort2.h"

	in vec2 TexCoord;

#if defined (RESOLVE_LAYER)
	layout(binding = 0, r32ui)		readonly uniform uimage2DArray	image_head;
	layout(binding = 2, std430)		readonly buffer  LINKED_LISTS  { NodeTypeDataLL nodes[]; };
#else
	layout(binding = 0, r32ui)		coherent uniform uimage2DArray	image_head;
	layout(binding = 2, std430)		coherent buffer  LINKED_LISTS  { NodeTypeDataLL nodes[]; };
#endif

#if defined (STORE_ONLY)
	void setPixelCurrentPageID	(const int  b, const uint val) {		imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
#endif
	uint getPixelCurrentPageID	(const int  b				 ) { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).r;}

	layout(binding = 11) uniform sampler2D tex_depth_bounds;

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
		uint init_index = getPixelCurrentPageID(b);
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
			// 3. RESOLVE LAYER
			//if(uniform_layer-counterTotal < counterLocal)
			{
				//out_frag_color = unpackUnorm4x8(nodes[uint(fragments [uniform_layer-counterTotal].r)].albedo);
				int lod = uniform_layer;
				int lod_step = int(lod/2);

				out_frag_color = vec4(-texelFetch(tex_depth_bounds, 
				ivec2(gl_FragCoord.xy)/ivec2(pow(2,lod_step)), lod_step)[(lod%2)*2]);
				//out_frag_color = vec4(texelFetch(tex_depth_bounds, ivec2(gl_FragCoord.xy)/ivec2(pow(2,lod)), lod).g);


				//out_frag_color = vec4(texelFetch(tex_depth_bounds, ivec2(gl_FragCoord.xy)/ivec2(pow(2,lod)), lod).g) - 
					//			 vec4(-texelFetch(tex_depth_bounds, ivec2(gl_FragCoord.xy)/ivec2(pow(2,lod)), lod).r);

				return;
			}
#else
			// 3. STORE
			setPixelCurrentPageID(b, uint(fragments [0].r));
			for(int i=0; i<counterLocal-1; i++)
				nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
			nodes[uint(fragments [counterLocal-1].r)].next = 0U;
#endif
			counterTotal += counterLocal;
		}
	}
	//discard;
}
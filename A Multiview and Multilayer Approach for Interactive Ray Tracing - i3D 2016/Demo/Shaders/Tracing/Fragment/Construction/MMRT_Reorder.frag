// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Reorder pass
// 1. The stored (unsorted) fragments are fetched, sorted and stored back in the ID buffer
// 2. The head/tail pointers are being set, reflecting the newly sorted fragments
// This pass is being called once per view

#include "version.h"

#define BUCKET_SIZE				__BUCKET_SIZE__
#define NUM_CUBEMAPS			__NUM_FACES__
#define CAMERA_Z

#include "sort_define.h"
#include "MMRT/MMRT_data_structs.glsl"
#include "trace_define.h"
#include "MMRT/MMRT_sort.glsl"

layout(binding = 0, r32ui)		coherent uniform uimage2DArray image_head_tail;								// stored head pointers per view and per bucket and then tail pointers in the same manner
layout(binding = 1, std430)		readonly buffer  LL_DATA	 { NodeTypeData			data []; };				// the Data buffer
layout(binding = 2, std430)		coherent buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };				// the ID buffer
layout(binding = 11) uniform sampler2DArray tex_depth_bounds;												// the depth bounds

void setPixelHeadID	(const int  b,	const uint val) {		 imageStore(image_head_tail, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}			// set the head ID for a bucket
void setPixelTailID	(const int  b,	const uint val) {		 imageStore(image_head_tail, ivec3(gl_FragCoord.xy, b + BUCKET_SIZE*NUM_CUBEMAPS), uvec4(val,0u,0u,0u));} // set the tail ID for a bucket
uint getPixelHeadID	(const int  b				  ) { return imageLoad (image_head_tail, ivec3(gl_FragCoord.xy, b)).r;}								// retrieve the head ID for a bucket
uint getPixelTailID	(const int  b				  ) { return imageLoad (image_head_tail, ivec3(gl_FragCoord.xy, b + BUCKET_SIZE*NUM_CUBEMAPS)).r;}	// retrieve the tail ID for a bucket

// visualization data
uniform int uniform_ray_preview;								// preview fragment count
uniform int	uniform_layer;										// the layer to visualize
layout(location = 0, index = 0) out vec4 out_frag_color;		// the framebuffer target

uniform int uniform_cube_index;									// the view index

#include "normal_compression.h"

void main(void)
{
	vec4 out_color = vec4(0);
	bool assigned = false;
	int  counterTotal = 0;
	int  counterLocal = 0;
	int bucket = 0;
	uint init_index = 0U;

	for (int b=0; b<BUCKET_SIZE
#ifndef USE_BUCKETS
	&& b < 1
#endif
; b++)
	{
		counterLocal = 0;
		bucket = uniform_cube_index * BUCKET_SIZE + b;
		init_index = getPixelHeadID(bucket);
		if(init_index == 0U) continue;
			
		// 1. LOAD
		uint index = init_index;				
		while(index > 0U && counterLocal < ABUFFER_GLOBAL_SIZE)
		{
			fragments_id[counterLocal] = index;
			fragments_depth[counterLocal] = nodes[index].depth;
			index	= nodes[index].next;
			counterLocal++;
		}

		// 2. SORT
		sort(counterLocal);

		// 3. HEAD TAILS
		setPixelHeadID(bucket, fragments_id[0]);
		setPixelTailID(bucket, fragments_id [counterLocal-1]);

		// 4. PREV
		for(int i=counterLocal-1; i>0; i--)
			nodes[fragments_id [i]].prev = fragments_id [i-1];
		nodes[fragments_id [0]].prev = 0U;

		// 5. NEXT
		for(int i=0; i<counterLocal-1; i++)
			nodes[fragments_id [i]].next = fragments_id [i+1];
		nodes[fragments_id [counterLocal-1]].next = 0U;

		// 4. RESOLVE LAYER
		if(uniform_layer > -1 && uniform_ray_preview == 0 && uniform_layer-counterTotal < counterLocal && !assigned)
		{
			out_color = unpackUnorm4x8(data[fragments_id[uniform_layer-counterTotal]].albedo);
			assigned = true;
		}
		counterTotal += counterLocal;
	}

	if (uniform_ray_preview == 1)
	{
		out_color = vec4(counterTotal/float(ABUFFER_GLOBAL_SIZE));
		assigned = true;
	}

#ifdef STATISTICS
	vec4 total = imageLoad(image_test, ivec2(gl_FragCoord.xy));
	total.x += counterTotal;
	if (total.y < counterTotal)
		total.y = counterTotal;
	total.z = uniform_cube_index + 1;
	imageStore(image_test, ivec2(gl_FragCoord.xy), total);
#endif 
	
	if (uniform_layer == -1) return;

	if (!assigned) out_frag_color = vec4(0);
	else out_frag_color = out_color;
}


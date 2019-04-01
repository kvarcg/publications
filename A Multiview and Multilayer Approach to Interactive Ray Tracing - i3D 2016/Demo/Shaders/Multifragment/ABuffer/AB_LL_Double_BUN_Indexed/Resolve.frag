// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled double linked-list with buckets fragment implementation of Resolve stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "trace_define.h"
#include "data_structs.h"
#include "color_functions.h"

#define __Z_COORD_SPACE__
#define __RESOLVE__
#define __STORE_BUFFER__

#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE-1

#include "sort2.h"

#ifdef MULTITEX
layout(binding = 0, r32ui)		coherent uniform uimage2DArray			image_head;
layout(binding = 1, r32ui)		coherent uniform uimage2DArray			image_tail;
void setPixelTailID	(const int  b,	const uint val) {		 imageStore(image_tail, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
uint getPixelHeadID	(const int  b				  ) { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).r;}
void setPixelHeadID	(const int  b,	const uint val) {		 imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
#else
#ifdef SPIN_LOCK
layout(binding = 0, rg32ui)		coherent uniform uimage2DArray image_head;

uvec2 getPixelHeadTailID  (const int  b)				 { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).xy; }
void setPixelHeadTailID	 (const int  b,	const uvec2 val) {	imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u));}
#else
layout(binding = 0, r32ui)		coherent uniform uimage2DArray			image_head;
void setPixelTailID	(const int  b,	const uint val) {		 imageStore(image_head, ivec3(gl_FragCoord.xy, BUCKET_SIZE + b), uvec4(val,0u,0u,0u));}
uint getPixelHeadID	(const int  b				  ) { return imageLoad (image_head, ivec3(gl_FragCoord.xy, b)).r;}
void setPixelHeadID	(const int  b,	const uint val) {		 imageStore(image_head, ivec3(gl_FragCoord.xy, b), uvec4(val,0u,0u,0u));}
#endif // SPIN_LOCK
#endif // MULTITEX

	layout(binding = 2, r32ui)		coherent uniform uimage2DArray	image_depth_bounds;
#if		defined (BUFFER_IMAGE)
	layout(binding = 3, rgba32ui)	coherent uniform uimageBuffer   image_peel_data;
	layout(binding = 4, rgba32f	)	coherent uniform  imageBuffer   image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 3, std430)		coherent buffer  LL_DATA	 { NodeTypeData			data []; };
	layout(binding = 4, std430)		coherent buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };
#endif

#if		defined (BUFFER_IMAGE)
	uvec4 sharedPoolGetDataValue	(const uint index ) { return imageLoad (image_peel_data, int(index));}
	vec4  sharedPoolGetIdDepthValue	(const uint index ) { return imageLoad (image_peel_id_depth, int(index));}
#endif

#if		defined (BUFFER_IMAGE)
	void sharedPoolSetIdDepthValue	(const uint index, const  vec4 val) { imageStore(image_peel_id_depth, int(index), val);}
#endif

#if defined (RESOLVE_LAYER)
	uniform int	uniform_layer;

	layout(location = 0, index = 0) out vec4 out_frag_color;
#endif

layout(binding = 7, r32ui)		coherent uniform uimage2D semaphore;

void main(void)
{
	int counters[BUCKET_SIZE];
	int counterTotal = 0;

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
			
#if defined (RESOLVE_LAYER) && !UNIFORM_FRAG_DISTRIBUTION

			// 4. RESOLVE LAYER
			if(uniform_layer-counterTotal < counterLocal)
			{
#if		defined (BUFFER_IMAGE)
				out_frag_color = unpackUnorm4x8(sharedPoolGetDataValue(uint(fragments [uniform_layer-counterTotal].r)).r);
#elif	defined (BUFFER_STRUCT)
				out_frag_color = unpackUnorm4x8(data[uint(fragments [uniform_layer-counterTotal].r)].albedo);
#endif
				return;
			}
#else

			// 3. FIX PREV-NEXT POINTERS
#if		defined (BUFFER_IMAGE)
			
			sharedPoolSetIdDepthValue(uint(fragments [0].r), vec4(fragments [1].r,fragments [0].g,0,0));

			sharedPoolSetIdDepthValue(uint(fragments [counterLocal-1].r), 
				(counterLocal>1) ?	  vec4(0,fragments [counterLocal-1].g, fragments [counterLocal-2].r,0)
								 : vec4(0,fragments [counterLocal-1].g, 0,0)
				);

			for(int i=1; i<counterLocal-1; i++)
				sharedPoolSetIdDepthValue(uint(fragments [i].r), 
					vec4(fragments [i+1].r,fragments [i].g,fragments [i-1].r,0));

#elif	defined (BUFFER_STRUCT)
			// 3.1 FIX PREV POINTERS
			for(int i=counterLocal-1; i>0; i--)
				nodes[uint(fragments [i].r)].prev = uint(fragments [i-1].r);
			nodes[uint(fragments [0].r)].prev = 0U;

			// 3.2 FIX NEXT POINTERS
			for(int i=0; i<counterLocal-1; i++)
				nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
			nodes[uint(fragments [counterLocal-1].r)].next = 0U;
#endif
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

			counters [b]  = counterLocal;
			counterTotal += counterLocal;
		}
		else
			counters [b]  = 0;
	}

	// average layers
	imageStore(semaphore, ivec2(gl_FragCoord.xy), uvec4(counterTotal,0u,0u,0u));

	discard;

	/*
	// A. Uniform fragment distributation into Buckets
#if UNIFORM_FRAG_DISTRIBUTION
	if(counterTotal > 3) // All buckets must have more than one fragments 
	{
		// 1. LOAD [can be removed??? - faster variation]
		int counterT = 0;
		for (int b=0; b<BUCKET_SIZE; b++)
		{		
			uint index = getPixelHeadID(b);
			while(index != 0U)
			{
#if		defined (BUFFER_IMAGE)
				vec2 peel = sharedPoolGetIdDepthValue(index).rg;
				fragments [counterT] = vec2(float(index), peel.g);
				index = uint(peel.r);
#elif	defined (BUFFER_STRUCT)
				fragments [counterT] = vec2(float(index), nodes[index].depth);
				index = nodes[index].next;
#endif
				counterT++;
			}
		}

		// 2. Compute Bucket Sizes
		int counterS = 0;
		int	finalSizes[BUCKET_SIZE];
		for (int b=0; b<BUCKET_SIZE; b++)
		{
			finalSizes[b] = int( float(counterT) / float(BUCKET_SIZE-b) );

			for(int i=0; i<finalSizes[b]; i++)
			{
				bool mid = true;
				int  pos = counterS + i;

				if		(i == 0)				// Head
				{
					mid = false;
					setPixelHeadID (b, uint(fragments [pos].r));

#if		defined (BUFFER_IMAGE)
					sharedPoolSetIdDepthValue(uint(fragments [pos].r), vec4(fragments [pos+1].r	, fragments [pos].g, 0.0, 0.0));
#elif	defined (BUFFER_STRUCT)
					nodes[uint(fragments [pos].r)].next = uint(fragments [pos+1].r);
					nodes[uint(fragments [pos].r)].prev = 0U;
#endif				
				}
				
				if	(i == finalSizes[b]-1)		// Tail
				{
					setPixelTailID (b, uint(fragments [pos].r));

#if		defined (BUFFER_IMAGE)
					sharedPoolSetIdDepthValue(uint(fragments [pos].r), vec4(0.0					, fragments [pos].g, (!mid) ? 0.0 : fragments [pos-1].r, 0.0));
#elif	defined (BUFFER_STRUCT)
					nodes[uint(fragments [pos].r)].next = 0U;
					if(mid)
					nodes[uint(fragments [pos].r)].prev = uint(fragments [pos-1].r);
#endif
					mid = false;
				}
				
				if	(mid)							// In-between
				{
#if		defined (BUFFER_IMAGE)
					sharedPoolSetIdDepthValue(uint(fragments [pos].r), vec4(fragments [pos+1].r	, fragments [pos].g, fragments [pos-1].r, 0));				
#elif	defined (BUFFER_STRUCT)
					nodes[uint(fragments [pos].r)].next = uint(fragments [pos+1].r);
					nodes[uint(fragments [pos].r)].prev = uint(fragments [pos-1].r);		
#endif
				}
			}

			counterS += finalSizes[b];
			counterT -= finalSizes[b];
		}
	}
#endif
*/

#if defined (RESOLVE_LAYER) && UNIFORM_FRAG_DISTRIBUTION
	// Again: LOAD from global memory -- REMOVE !!
	counterTotal = 0;
	for (int b=0; b<BUCKET_SIZE; b++)
	//for (int b=BUCKET_SIZE-1; b>=0; b--) // for inverse traversing list
	{
		int  counterLocal = 0;
		uint init_index = getPixelHeadID(b);
		if(init_index > 0U)
		{
			// 1. LOAD
			uint index = init_index;
			while(index != 0U)
			{
#if		defined (BUFFER_IMAGE)
				vec2 peel = sharedPoolGetIdDepthValue(index).rg;
				fragments[counterLocal] = vec2(float(index), peel.g);
				index	= uint(peel.r);
#elif	defined (BUFFER_STRUCT)
				fragments [counterLocal] = vec2(float(index), nodes[index].depth);
				index	= nodes[index].next;
#endif
				counterLocal++;
			}
		
			// 2. RESOLVE LAYER
			if(uniform_layer-counterTotal < counterLocal)
			{
#if		defined (BUFFER_IMAGE)
				out_frag_color = unpackUnorm4x8(sharedPoolGetDataValue(uint(fragments [uniform_layer-counterTotal].r)).r);
#elif	defined (BUFFER_STRUCT)
				out_frag_color = unpackUnorm4x8(data[uint(fragments [uniform_layer-counterTotal].r)].albedo);	
#endif
				//return;
			}

			counters [b]  = counterLocal;
			counterTotal += counterLocal;
		}
		else
			counters [b]  = 0;
	}
#endif

#if defined (RESOLVE_LAYER)
	// Per Bucket Fragment Counting Visulization
	{
		vec3	heatmap_hsl  = vec3(0.0, 1.0, 1.0);
		float	counter_norm = (counterTotal > 4) ?
		clamp(float(counters[uniform_layer])/float(counterTotal), 0.0, 1.0) : 0.0;
		heatmap_hsl.r		 = mix(240, 0, counter_norm);
		out_frag_color		 = vec4(hsv2rgb(heatmap_hsl),1.0);
		return;
	}
#endif

	discard;
}


			// for inverse traversing list
			/*setPixelHeadID(b, uint(fragments [0].r));
			sharedPoolSetIdDepthValue(uint(fragments [0].r), vec4(fragments [1].r,fragments [0].g,0,0));

			setPixelTailID(b, uint(fragments [counterLocal-1].r));
			sharedPoolSetIdDepthValue(uint(fragments [counterLocal-1].r), 
				(counterLocal>1) ?	  vec4(0,fragments [counterLocal-1].g, fragments [counterLocal-2].r,0)
								 : vec4(0,fragments [counterLocal-1].g, 0,0)
				);

			for(int i=1; i<counterLocal-1; i++)
				sharedPoolSetIdDepthValue(uint(fragments [i].r), 
					vec4(fragments [i+1].r,fragments [i].g,fragments [i-1].r,0));

			init_index = getPixelTailID(b);
			counterLocal = 0;
			index	= init_index;
			while(index != 0U)
			{
#if		defined (BUFFER_IMAGE)
				vec2 peel = sharedPoolGetIdDepthValue(index).bg;
				fragments[counterLocal] = vec2(float(index), peel.g);
				index	= uint(peel.r);
#elif	defined (BUFFER_STRUCT)
				fragments [counterLocal] = vec2(float(index), nodes[index].depth);
				index	= nodes[index].prev;
#endif
				counterLocal++;
			}*/
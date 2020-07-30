// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled double linked-list fragment implementation of Resolve stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"
#include "sort_define.h"
#include "data_structs.h"
#define __Z_COORD_SPACE__
#define __RESOLVE__
#define __STORE_BUFFER__
#include "sort2.h"

#include "trace_define.h"
#if UNIFORM_FRAG_DISTRIBUTION
#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#endif


#if defined (RESOLVE_LAYER)
#if		defined (BUFFER_IMAGE)
	layout(binding = 1, rgba32ui)	readonly uniform uimageBuffer   image_peel_data;
	layout(binding = 2, rgba32f	)	readonly uniform  imageBuffer   image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 1, std430)		readonly buffer  LL_DATA	 { NodeTypeData			data []; };
	layout(binding = 2, std430)		readonly buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };
#endif
#else
#if		defined (BUFFER_IMAGE)
	layout(binding = 1, rgba32ui)	coherent uniform uimageBuffer   image_peel_data;
	layout(binding = 2, rgba32f	)	coherent uniform  imageBuffer   image_peel_id_depth;
#elif	defined (BUFFER_STRUCT)
	layout(binding = 1, std430)		coherent buffer  LL_DATA	 { NodeTypeData			data []; };
	layout(binding = 2, std430)		coherent buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };
#endif
#endif

#if UNIFORM_FRAG_DISTRIBUTION
	layout(binding = 0, rg32ui)		coherent uniform uimage2D image_pointers;
	uint getPixelHeadID				(				 ) { return	imageLoad (image_pointers, ivec3(gl_FragCoord.xy, 0)).x; }
	uint getPixelTailID				(				 ) { return	imageLoad (image_pointers, ivec3(gl_FragCoord.xy, BUCKET_SIZE)).x; }
#else
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
#endif // UNIFORM_FRAG_DISTRIBUTION

#if	defined (BUFFER_IMAGE)
	uvec4 sharedPoolGetDataValue	(const uint index) { return imageLoad (image_peel_data, int(index));}
	vec4  sharedPoolGetIdDepthValue	(const uint index) { return imageLoad (image_peel_id_depth, int(index));}
#endif

#if defined (STORE_ONLY)

#if UNIFORM_FRAG_DISTRIBUTION
	void setPixelTailID				(const uint val	 ) {		imageStore(image_pointers, ivec3(gl_FragCoord.xy, BUCKET_SIZE), uvec4(val,0u,0u,0u));}
	void setPixelMiddleID			(const  int index, const uint val) 
													   {		imageStore(image_pointers, ivec3(gl_FragCoord.xy, index		 ), uvec4(val,0u,0u,0u)); }
#else

#endif

#if		defined (BUFFER_IMAGE)
	void sharedPoolSetIdDepthValue	(const uint index, const  vec4 val) { imageStore(image_peel_id_depth, int(index), val);}
#endif
#else
	uniform int	uniform_layer;

	layout(location = 0, index = 0) out vec4 out_frag_color;
#endif
	
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
#if		defined (BUFFER_IMAGE)
			vec2 peel = sharedPoolGetIdDepthValue(index).rg;
			fragments[counter] = vec2(float(index), peel.g);
			index	= floatBitsToUint(peel.r);
#elif	defined (BUFFER_STRUCT)
			fragments [counter] = vec2(float(index), nodes[index].depth);
			index	= nodes[index].next;
#endif
			counter++;
		}

		// 2. SORT
		sort(counter);

#if defined (RESOLVE_LAYER)
		// 4. RESOLVE LAYER
		if(uniform_layer < counter)
#if		defined (BUFFER_IMAGE)
			out_frag_color = unpackUnorm4x8(sharedPoolGetDataValue(uint(fragments [uniform_layer].r)).r);
#elif	defined (BUFFER_STRUCT)
			out_frag_color = unpackUnorm4x8(data[uint(fragments [uniform_layer].r)].albedo);
#endif	
		else
			discard;
#else

#if		defined (BUFFER_IMAGE)
			
		setPixelHeadID(uint(fragments [0].r));
		sharedPoolSetIdDepthValue(uint(fragments [0].r), vec4(fragments [1].r,fragments [0].g,0,0));

		setPixelTailID(uint(fragments [counter-1].r));
		sharedPoolSetIdDepthValue(uint(fragments [counter-1].r), 
			(counter>1)	?	  vec4(0,fragments [counter-1].g, fragments [counter-2].r,0)
							: vec4(0,fragments [counter-1].g, 0,0)
		);

		for(int i=1; i<counter-1; i++)
			sharedPoolSetIdDepthValue(uint(fragments [i].r), 
				vec4(fragments [i+1].r,fragments [i].g,fragments [i-1].r,0));

#if UNIFORM_FRAG_DISTRIBUTION
		if(counter > BUCKET_SIZE_1n)
		{
			int mid = 0;
			for (int b=0; b<BUCKET_SIZE_1n; b++)
			{
				mid	+= int( float(counter-mid) / float(BUCKET_SIZE-b) );

				setPixelMiddleID(b+1, uint(fragments [mid].r));
			}
		}
		else
		{
			for (int b=1; b<BUCKET_SIZE; b++)
				setPixelMiddleID(b, uint(fragments [0].r));
		}

#endif

#elif	defined (BUFFER_STRUCT)

		// 3. FIX PREV POINTERS
		for(int i=counter-1; i>0; i--)
			nodes[uint(fragments [i].r)].prev = uint(fragments [i-1].r);
		nodes[uint(fragments [0].r)].prev = 0U;

		// 4. FIX NEXT POINTERS
		for(int i=0; i<counter-1; i++)
			nodes[uint(fragments [i].r)].next = uint(fragments [i+1].r);
		nodes[uint(fragments [counter-1].r)].next = 0U;

#ifdef SPIN_LOCK
		setPixelHeadTailID(uvec2(fragments [0].r, fragments [counter-1].r));
#else
		setPixelHeadID(uint(fragments [0].r));
		setPixelTailID(uint(fragments [counter-1].r));
#endif // SPIN_LOCK

#endif

#endif
	}
	else
		discard;
}
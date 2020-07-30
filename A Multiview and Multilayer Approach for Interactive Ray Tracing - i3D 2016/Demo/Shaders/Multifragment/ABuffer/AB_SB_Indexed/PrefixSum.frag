// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled S-Buffer fragment implementation of Prefix Sum stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

layout(binding = 0, r32ui)  readonly  uniform uimage2D  image_counter;
layout(binding = 1, r32ui)  writeonly uniform uimage2D  image_head;
layout(binding = 4		 )	coherent  buffer  ADDRESS_MAP {uint head_s;};

void setPixelHeadAddress  (uint val ) {			imageStore	(image_head		, ivec2(gl_FragCoord.xy), uvec4(val, 0U, 0U, 0U) );}
uint getPixelFragCounter  (			) { return	imageLoad   (image_counter	, ivec2(gl_FragCoord.xy)).x ;}
uint addSharedHeadAddress (uint val ) { return	atomicAdd	(head_s, val);}
	
void main(void)
{
	uint counter = getPixelFragCounter();
	if(counter == 0U) 		discard;

	setPixelHeadAddress (addSharedHeadAddress (counter));
}
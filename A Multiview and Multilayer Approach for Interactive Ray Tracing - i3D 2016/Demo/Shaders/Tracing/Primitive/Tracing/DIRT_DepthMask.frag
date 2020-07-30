// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the creation of the mask texture via a depth texture. 
// This is very quick pass where a simple check against the head texture of the hit buffer is performed.
// Alternatively, this can be implemented using a stencil mask.

#include "version.h"

#define BUCKET_SIZE		__BUCKET_SIZE__
#define NUM_CUBEMAPS	__NUM_FACES__

layout(binding = 1, r32ui)		readonly uniform uimage2DArray  image_hit_buffer_head;

#define HIT_BUFFER_HEAD_LAYER 0
// gets the hit buffer head id for the current pixel
uint  getHitBufferHeadID	() { return imageLoad (image_hit_buffer_head, ivec3(ivec2(gl_FragCoord.xy), HIT_BUFFER_HEAD_LAYER)).x; }

void main(void)
{
	gl_FragDepth = (getHitBufferHeadID() == 0u) ? 0.0f : 1.0f;
}
// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled double linked-list with buckets fragment implementation of DepthBoundsClear stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

#define MAX_DEPTH_UINT 0xFFFFFFFFU

layout(binding = 2, r32ui) writeonly uniform uimage2DArray image_depth_bounds;

void  resetPixelFragMinDepth( ) { imageStore (image_depth_bounds, ivec3(gl_FragCoord.xy, 0), uvec4(MAX_DEPTH_UINT));}
void  resetPixelFragMaxDepth( ) { imageStore (image_depth_bounds, ivec3(gl_FragCoord.xy, 1), uvec4(0U));}

void main(void)
{
	resetPixelFragMinDepth ();
	resetPixelFragMaxDepth ();
}
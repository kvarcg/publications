// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
//
// Linked-list with buckets fragment implementation of DepthBoundsClear stage
// Depth-Fighting Aware Methods for Multifragment Rendering (TVCG 2013)
// http://dx.doi.org/10.1109/TVCG.2012.300
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

#define MAX_DEPTH_UINT 0xFFFFFFFFU

layout(binding = 1, r32ui) writeonly uniform uimage2DArray image_depth_bounds;

void  resetPixelFragMinDepth( ) { imageStore (image_depth_bounds, ivec3(gl_FragCoord.xy, 0), uvec4(MAX_DEPTH_UINT));}
void  resetPixelFragMaxDepth( ) { imageStore (image_depth_bounds, ivec3(gl_FragCoord.xy, 1), uvec4(0U));}
	
void main(void)
{
	resetPixelFragMinDepth ();
	resetPixelFragMaxDepth ();
}
// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// S-Buffer vertex implementation of Resolve stage
//
// S-buffer: Sparsity-aware Multi-fragment Rendering (Short Eurographics 2012)
// http://dx.doi.org/10.2312/conf/EG2012/short/101-104
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;

out vec2 TexCoord;
uniform mat4 uniform_mvp;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);
}

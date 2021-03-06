// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled S-Buffer vertex implementation of Accumulate stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

layout(location = 0) in vec3 position;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;

uniform mat4 uniform_mvp;

out vec2 TexCoord;
out vec4 vertex_color;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);

   vertex_color = color;
}
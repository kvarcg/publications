// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Linked-list vertex implementation of TraceTest stage
//
// Real-time concurrent linked list construction on the GPU (EGSR 2010)
// http://dx.doi.org/10.1111/j.1467-8659.2010.01725.x
// Implementation Authors: A.A. Vasilakis, K. Vardis

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
out vec2 TexCoord;
uniform mat4 uniform_mvp;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);
}

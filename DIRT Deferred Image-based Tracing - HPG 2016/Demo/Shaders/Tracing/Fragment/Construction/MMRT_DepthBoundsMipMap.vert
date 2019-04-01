// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Mipmap Depth Bounds pass
// The near value is stored with reverse sign
// NOTE: The depth bounds texture needs to be only vec2. However, vec2 blending wasn't working properly on NVIDIA, so a vec4 texture is allocated instead.

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
out vec2 TexCoord;
uniform mat4 uniform_mvp;			// simple projection matrix for the screen-space pass (this can be optimized out)

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);
}

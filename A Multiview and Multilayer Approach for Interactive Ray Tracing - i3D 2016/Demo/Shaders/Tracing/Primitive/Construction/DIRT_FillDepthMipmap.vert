// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Mipmap Depth pass
// The near value is stored with reverse sign

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
uniform mat4 uniform_mvp;			// simple projection matrix for the screen-space pass (this can be optimized out)

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
}

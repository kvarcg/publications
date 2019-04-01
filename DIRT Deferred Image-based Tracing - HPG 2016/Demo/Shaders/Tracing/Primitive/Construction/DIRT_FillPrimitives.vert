// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains example vertex implementation for the Fill Primitives pass
// It servers as a demonstration of how a separate vertex buffer can be used
// Note: to avoid missing geometry entirely parallel to the view, the primitives can be slightly shifted (not demonstrated here)

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

out vec2 vTexCoord;		// outgoing vertex data
out vec3 vposition;

void main(void)
{
	vposition = position;
	vTexCoord = vec2(texcoord0.x,texcoord0.y);
}

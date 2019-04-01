// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Fill Depth pass
// Incoming primitives are clipped and stored in the depth buffer texture
// The near value is stored with reverse sign to make the mipmap calculations simpler
// Note: This pass requires conservative rasterization otherwise oblique primitives might not be rasterized

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

out vec2 vTexCoord;					// outgoing vertex data
out vec3 vposition;					// we also pass data that is not needed for the Fill Depth pass
out vec3 vnormal;					// because we also fill the (explicit) vertex buffer during the geometry shader invocation
out vec3 vtangent;
out vec4 vvertex_color;

void main(void)
{
	vposition = position;
	vTexCoord = vec2(texcoord0.x,texcoord0.y);
	vnormal = normal;
	vtangent = tangent;
	vvertex_color = color;
}

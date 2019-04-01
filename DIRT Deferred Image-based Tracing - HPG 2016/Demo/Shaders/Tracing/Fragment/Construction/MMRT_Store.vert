// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Store pass
// Incoming primitives are allocated to their corresponding bucket and stored in the ID and Data buffers
#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

out vec2 vTexCoord;			// outgoing vertex data
out vec3 vposition;
out vec3 vnormal;
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

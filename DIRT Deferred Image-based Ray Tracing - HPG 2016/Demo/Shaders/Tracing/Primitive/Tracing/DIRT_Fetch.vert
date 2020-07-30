// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the Fetch pass
// For each rasterized primitive, the hit buffer is iterated and checked for equality.
// On each successful comparison, the hit record is fetched where (i) the barycentric coordinates are used to interpolate the shading information
// and (ii) the interpolated information is stored at G[k+2] location of the shading buffer. This location is stored in the hit record as well (the variable's name is owner).
// It is practically the pixel location on which the tracing started.

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

out vec2 vTexCoord;					// outgoing vertex data
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

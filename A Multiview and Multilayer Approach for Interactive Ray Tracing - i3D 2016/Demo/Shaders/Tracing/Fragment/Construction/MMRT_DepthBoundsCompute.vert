// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the geometry implementation for the Depth Bounds pass
// The eye-space position of the incoming fragments is stored using blending to capture the pixel's extents.
// NOTE: The depth bounds texture needs to be only vec2. However, vec2 blending wasn't working properly on NVIDIA, so a vec4 texture is allocated instead.

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

out vec2 vTexCoord;			// outgoing vertex data
out vec3 vposition;			

void main(void)
{
	vposition = position;
	vTexCoord = texcoord0;
}

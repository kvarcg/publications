// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the vertex implementation for the optional Direct Visibility pass
// This is a standard rasterization pass. However, since it is stored in the shading buffer and a Z-buffer is not available at the current implementation,
// a spinlock mechanism is used. In an NVIDIA Maxwell architecture, the GL_NV_fragment_shader_interlock can be used. This is not a requirement though.
// Note: This pass should NOT use conservative rasterization due to attribute extrapolation
// Note 2: There is a chance that the spinlock mechanism will cause a deadlock on NVIDIA GPUs.

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

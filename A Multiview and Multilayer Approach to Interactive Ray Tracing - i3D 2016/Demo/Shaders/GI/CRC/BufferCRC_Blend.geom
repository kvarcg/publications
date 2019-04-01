// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the geometry implementation for the blending stage (simple pass-through)

#version 330 core

layout(triangles) in;
layout (triangle_strip, max_vertices=3) out;

flat in int vInstance[3];
flat out int vCurrentLayer;
in vec2 vTexCoord[3];
out vec2 TexCoord;

void main()
{
	gl_Layer = vInstance[0];
	vCurrentLayer = vInstance[0];

	gl_Position = gl_in[0].gl_Position;
	TexCoord = vTexCoord[0];
	EmitVertex();

	gl_Position = gl_in[1].gl_Position;
	TexCoord = vTexCoord[1];
	EmitVertex();

	gl_Position = gl_in[2].gl_Position;
	TexCoord = vTexCoord[2];
	EmitVertex();

	EndPrimitive();
}

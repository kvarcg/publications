// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the geometry implementation for the occupancy optimization stage (simple pass-through)

#version 330 core

layout(triangles) in;
layout (triangle_strip, max_vertices=3) out;

flat in int vInstance[3];
flat out int vCurrentLayer;

void main()
{
	gl_Layer = vInstance[0];
	vCurrentLayer = vInstance[0];

	gl_Position = gl_in[0].gl_Position;
	EmitVertex();

	gl_Position = gl_in[1].gl_Position;
	EmitVertex();

	gl_Position = gl_in[2].gl_Position;
	EmitVertex();

	EndPrimitive();
}

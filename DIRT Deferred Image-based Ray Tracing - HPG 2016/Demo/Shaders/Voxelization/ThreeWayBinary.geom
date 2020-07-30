// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the geometry implementation for the creation stage of the geometry volume

#version 330 core
#extension GL_ARB_viewport_array : enable
layout(triangles) in;
layout (triangle_strip, max_vertices=9) out;

uniform mat4 uniform_view_proj[3];
uniform uvec3 uniform_size;
flat out uint depth;

#define X_AXIS_LAYER 0
#define Y_AXIS_LAYER 1
#define Z_AXIS_LAYER 2

//#define THREEAXISVOXELIZATION
#define DOMINANTAXISVOXELIZATION

 void main()
{
#ifdef THREEAXISVOXELIZATION
	// Three axis voxelization
	for (int i = 0; i < 3; ++i)
	{
		gl_Layer = i;
		gl_ViewportIndex = i;	
		depth = uniform_size[i];

		for(int j = 0; j < gl_in.length(); j++)
		{
			// copy attributes
			gl_Position = uniform_view_proj[i] * gl_in[j].gl_Position;
	
			// done with the vertex
			EmitVertex();
		}
		// done with the primitive
		EndPrimitive();
	}
#endif // THREEAXISVOXELIZATION

#ifdef DOMINANTAXISVOXELIZATION
	// normal
	vec3 v0 = gl_in[0].gl_Position.xyz;
	vec3 v1 = gl_in[1].gl_Position.xyz;
	vec3 v2 = gl_in[2].gl_Position.xyz;
	vec3 normal0 = normalize(cross(v1 - v0, v2 - v0));

	vec3 absnormal = abs(normal0);
	int index = X_AXIS_LAYER;
	if (absnormal.y >= absnormal.x && absnormal.y >= absnormal.z) index = Y_AXIS_LAYER;
	else if (absnormal.z >= absnormal.x && absnormal.z >= absnormal.y) index = Z_AXIS_LAYER;

	gl_Layer = index;
	gl_ViewportIndex = index;
	depth = uniform_size[index];
	gl_Position = uniform_view_proj[index] * gl_in[0].gl_Position;
	EmitVertex();
	gl_Position = uniform_view_proj[index] * gl_in[1].gl_Position;
	EmitVertex();
	gl_Position = uniform_view_proj[index] * gl_in[2].gl_Position;
	EmitVertex();
	EndPrimitive();
#endif // DOMINANTAXISVOXELIZATION
}

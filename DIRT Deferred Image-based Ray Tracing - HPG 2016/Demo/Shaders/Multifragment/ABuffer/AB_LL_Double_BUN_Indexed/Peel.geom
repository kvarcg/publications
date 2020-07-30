// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// Decoupled double linked-list with buckets geometry implementation of Peel stage
// Implementation Authors: A.A. Vasilakis, K. Vardis

#include "version.h"

layout(triangles) in;
layout (triangle_strip, max_vertices=12) out;

#define BUCKET_SIZE				__BUCKET_SIZE__

in vec2 vTexCoord[3];
in vec3 vNecs[3];
in vec3 vTecs[3];
in vec3 vBecs[3];
in vec4 vvertex_color[3];
in vec3 vpecs[3];

out vec2 TexCoord;
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4 vertex_color;
out float pecsZ;

uniform mat4	uniform_proj_array[BUCKET_SIZE];

 void main()
{
	for (int i = 0; i < BUCKET_SIZE; ++i)
	{
		gl_ViewportIndex = i;

		for(int j = 0; j < gl_in.length(); j++)
		{	
			TexCoord = vTexCoord[j];
			Necs = vNecs[j];
			Tecs = vTecs[j];
			Becs = vBecs[j];
			vertex_color = vvertex_color[j];
			pecsZ = vpecs[j].z;

			// copy attributes
			gl_Position = uniform_proj_array[i] * vec4(vpecs[j], 1);
	
			// done with the vertex
			EmitVertex();
		}
		// done with the primitive
		EndPrimitive();
	}
}

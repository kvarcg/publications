// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the geometry implementation for the Store pass
// Incoming primitives are allocated to their corresponding bucket and stored in the ID and Data buffers
#include "version.h"

layout(triangles) in;
#define NUM_CUBEMAPS __NUM_FACES__
layout (triangle_strip, max_vertices=NUM_CUBEMAPS*3) out;

in vec2 vTexCoord[3];							// incoming vertex data from the geometry shader
in vec3 vposition[3];
in vec3 vnormal[3];
in vec3 vtangent[3];
in vec4 vvertex_color[3];

out vec2 TexCoord;								// outgoing data to the fragment shader
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4 vertex_color;
out float pecsZ;
flat out int uniform_cube_index;				// the view index from the geometry shader
												
uniform mat4 uniform_mv[NUM_CUBEMAPS];			// object->eye transformation
uniform mat4 uniform_mvp[NUM_CUBEMAPS];			// object->projection transformation
												
void main()										
{
	for (int i = 0; i < NUM_CUBEMAPS; ++i)
	{
		gl_ViewportIndex = i;
		uniform_cube_index = i;
		for(int j = 0; j < gl_in.length(); j++)
		{	
			TexCoord = vTexCoord[j];
			
			Necs = normalize ((uniform_mv[i] * vec4(vnormal[j],0)).xyz );
			Tecs = normalize ((uniform_mv[i] * vec4(vtangent[j],0)).xyz );
			Becs = cross(Necs,Tecs);

			pecsZ = (uniform_mv[i] * vec4(vposition[j], 1)).z;

			vertex_color = vvertex_color[j];

			gl_Position = uniform_mvp[i] * vec4(vposition[j], 1);
	
			// done with the vertex
			EmitVertex();
		}
		// done with the primitive
		EndPrimitive();
	}
}

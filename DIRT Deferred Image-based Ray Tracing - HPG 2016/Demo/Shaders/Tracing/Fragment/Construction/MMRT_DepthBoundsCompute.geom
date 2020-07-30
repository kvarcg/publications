// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the geometry implementation for the Depth Bounds pass
// The eye-space position of the incoming fragments is stored using blending to capture the pixel's extents.
// NOTE: The depth bounds texture needs to be only vec2. However, vec2 blending wasn't working properly on NVIDIA, so a vec4 texture is allocated instead.
#include "version.h"

layout(triangles) in;
#define NUM_CUBEMAPS __NUM_FACES__
layout (triangle_strip, max_vertices=NUM_CUBEMAPS*3) out;

in vec2 vTexCoord[3];						// incoming vertex data
in vec3 vposition[3];						

out vec2 TexCoord;							// uv coordinates
out float pecsZ;							// eye-space Z

uniform mat4 uniform_mv[NUM_CUBEMAPS];		// object to view matrix for all views
uniform mat4 uniform_mvp[NUM_CUBEMAPS];		// object to projection matrix for all views

void main()
{
	for (int i = 0; i < NUM_CUBEMAPS; ++i)
	{
		gl_ViewportIndex = i;
		gl_Layer = i;
		for(int j = 0; j < gl_in.length(); j++)
		{	
			TexCoord = vTexCoord[j];

			pecsZ = (uniform_mv[i] * vec4(vposition[j], 1)).z;
			
			gl_Position = uniform_mvp[i] * vec4(vposition[j], 1);
	
			// done with the vertex
			EmitVertex();
		}
		// done with the primitive
		EndPrimitive();
	}
}

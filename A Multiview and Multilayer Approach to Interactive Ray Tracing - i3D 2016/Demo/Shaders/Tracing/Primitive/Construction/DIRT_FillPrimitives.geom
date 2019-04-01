// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains example geometry implementation for the Fill Primitives pass
// It servers as a demonstration of how a separate vertex buffer can be used
// Note: to avoid missing geometry entirely parallel to the view, the primitives can be slightly shifted (not demonstrated here)

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"

layout(triangles) in;
#define NUM_CUBEMAPS __NUM_FACES__
layout (triangle_strip, max_vertices=NUM_CUBEMAPS*3) out;
layout(binding = 3, std430)		coherent buffer  LLD_PRIMITIVE	 { NodeTypePrimitive nodes_primitives[]; }; // the vertex buffer

in vec2 vTexCoord[3];								// incoming vertex data
in vec3 vposition[3];
in vec3 vnormal[3];
in vec3 vtangent[3];
in vec4 vvertex_color[3];

out vec2 TexCoord;									// uv coordinates
flat out int uniform_cube_index;					// the view index
flat out uint primitive_id;							// the primitive id

uniform uint uniform_current_total_primitives;		// primitive counter (for multi-draw calls)
uniform mat4 uniform_m;								// object->world transformation for the incoming vertices
uniform mat4 uniform_mv[NUM_CUBEMAPS];				// object->eye transformation for all views
uniform mat4 uniform_mvp[NUM_CUBEMAPS];				// object->projection transformation for all views

void main()
{
	// the current primitive id
	primitive_id = uniform_current_total_primitives + uint(gl_PrimitiveIDIn);

	for (int i = 0; i < NUM_CUBEMAPS; ++i)
	{
		gl_ViewportIndex = i;
		uniform_cube_index = i;
		for(int j = 0; j < gl_in.length(); j++)
		{	
			TexCoord = vTexCoord[j];

			// copy attributes
			gl_Position = uniform_mvp[i] * vec4(vposition[j], 1);
	
			// done with the vertex
			EmitVertex();
		}
		// done with the primitive
		EndPrimitive();
	}
}

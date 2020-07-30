// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the geometry implementation for the Fetch pass
// For each rasterized primitive, the hit buffer is iterated and checked for equality.
// On each successful comparison, the hit record is fetched where (i) the barycentric coordinates are used to interpolate the shading information
// and (ii) the interpolated information is stored at G[k+2] location of the shading buffer. This location is stored in the hit record as well (the variable's name is owner).
// It is practically the pixel location on which the tracing started.

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"

layout(triangles) in;
#define NUM_CUBEMAPS __NUM_FACES__
layout (triangle_strip, max_vertices=NUM_CUBEMAPS*3) out;
layout(binding = 5, std430)		coherent buffer  LLD_PRIMITIVE	 { NodeTypePrimitive nodes_primitives[]; };

in vec2 vTexCoord[3];				// incoming vertex data from the vertex shader
in vec3 vposition[3];
in vec3 vnormal[3];
in vec3 vtangent[3];
in vec4 vvertex_color[3];

out vec2 TexCoord;					// outgoing vertex data from the geometry shader
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4 vertex_color;
out float pecsZ;
flat out int uniform_cube_index;	// view index
flat out uint primitive_id;			// the primitive id

out vec2 prim_TexCoord[3];
out vec3 prim_Necs[3];
out vec3 prim_Tecs[3];
out vec3 prim_Becs[3];

uniform uint uniform_current_total_primitives;	// primitive counter (for multi-draw calls)

uniform mat4 uniform_m;							// object->world matrix
uniform mat4 uniform_mv[NUM_CUBEMAPS];			// object->eye matrix for all views
uniform mat4 uniform_mvp[NUM_CUBEMAPS];			// object->projection for all views

out mat4 m_inv;									// world->object matrix

void main()
{
	m_inv = inverse(uniform_m);
	primitive_id = uniform_current_total_primitives + uint(gl_PrimitiveIDIn);
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

			prim_TexCoord[j] = TexCoord;
			
			prim_Necs[j] = Necs;
			prim_Tecs[j] = Tecs;
			prim_Becs[j] = Becs;

			pecsZ = (uniform_mv[i] * vec4(vposition[j], 1)).z;

			vertex_color = vvertex_color[j];

			// copy attributes
			gl_Position = uniform_mvp[i] * vec4(vposition[j], 1);
	
			// done with the vertex
			EmitVertex();
		}
		// done with the primitive
		EndPrimitive();
	}
}


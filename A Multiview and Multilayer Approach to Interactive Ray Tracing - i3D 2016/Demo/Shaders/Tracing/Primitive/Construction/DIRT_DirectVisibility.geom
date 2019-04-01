// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the geometry implementation for the optional Direct Visibility pass
// The geometry shader is a simple pass-through mechanism that also captures the primitive id (for multi-draw calls)
// This is a standard rasterization pass. However, since it is stored in the shading buffer and a Z-buffer is not available at the current implementation,
// a spinlock mechanism is used. In an NVIDIA Maxwell architecture, the GL_NV_fragment_shader_interlock can be used. This is not a requirement though.
// Note: This pass should NOT use conservative rasterization due to attribute extrapolation
// Note 2: There is a chance that the spinlock mechanism will cause a deadlock on NVIDIA GPUs.

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"

layout(triangles) in;
layout (triangle_strip, max_vertices=3) out;

in vec2 vTexCoord[3];								// incoming vertex data from the geometry shader
in vec3 vposition[3];
in vec3 vnormal[3];
in vec3 vtangent[3];
in vec4 vvertex_color[3];

out vec2 TexCoord;									// outgoing data to the fragment shader
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4 vertex_color;
out float pecsZ;
out vec3 pecs;
flat out int uniform_cube_index;					// the view index from the geometry shader
flat out uint primitive_id;							// the primitive id
														
uniform uint uniform_current_total_primitives;		// primitive counter (for multi-draw calls)
uniform mat4 uniform_m;								// object->world transformation for the incoming vertices
uniform mat4 uniform_mv[1];							// object->eye transformation
uniform mat4 uniform_mvp[1];						// object->projection transformation

void main()
{
	// the current primitive id
	primitive_id = uniform_current_total_primitives + uint(gl_PrimitiveIDIn);

	gl_ViewportIndex = 0;
	uniform_cube_index = 0;
	for(int j = 0; j < gl_in.length(); j++)
	{	
		TexCoord = vTexCoord[j];
			
		Necs = normalize ((uniform_mv[0] * vec4(vnormal[j],0)).xyz );
		Tecs = normalize ((uniform_mv[0] * vec4(vtangent[j],0)).xyz );
		Becs = cross(Necs,Tecs);
		vertex_color = vvertex_color[j];
		
		pecs = (uniform_mv[0] * vec4(vposition[j], 1)).xyz;

		gl_Position = uniform_mvp[0] * vec4(vposition[j], 1);
	
		// done with the vertex
		EmitVertex();
	}
	// done with the primitive
	EndPrimitive();
}

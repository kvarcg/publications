// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the geometry implementation for the Fill Depth pass
// Incoming primitives are clipped and stored in the depth buffer texture
// The near value is stored with reverse sign to make the mipmap calculations simpler
// Note: This pass requires conservative rasterization otherwise oblique primitives might not be rasterized

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

layout(triangles) in;
#define NUM_CUBEMAPS __NUM_FACES__
layout (triangle_strip, max_vertices=NUM_CUBEMAPS*3) out;

in vec2 vTexCoord[3];							// incoming vertex data
in vec3 vposition[3];
in vec3 vnormal[3];
in vec3 vtangent[3];
in vec4 vvertex_color[3];

out vec2 TexCoord;								// uv coordinates
flat out int uniform_cube_index;				// view index

flat out vec4 prim_vertex_wcs[3];				// primitive vertices in world space


uniform uint uniform_current_total_primitives;	// primitive counter (for multi-draw calls)
uniform mat4 uniform_m;							// object to world matrix
uniform mat4 uniform_mvp[NUM_CUBEMAPS];			// object to projection matrix for all views

layout(binding = 3, std430)		coherent buffer  LLD_PRIMITIVE	 { NodeTypePrimitive nodes_primitives[]; };

void main()
{
	// the current primitive id
	uint primitive_id = uniform_current_total_primitives + uint(gl_PrimitiveIDIn);

	// transform incoming positions to world space
	// and send them for clipping to the fragment shader
	prim_vertex_wcs[0] = uniform_m * vec4(vposition[0], 1);
	prim_vertex_wcs[1] = uniform_m * vec4(vposition[1], 1);
	prim_vertex_wcs[2] = uniform_m * vec4(vposition[2], 1);
	
	// store vertex buffer data	
	nodes_primitives[primitive_id].vertex1 = vec4(prim_vertex_wcs[0].xyz, vnormal[0].x);
	nodes_primitives[primitive_id].vertex2 = vec4(prim_vertex_wcs[1].xyz, vnormal[0].y);
	nodes_primitives[primitive_id].vertex3 = vec4(prim_vertex_wcs[2].xyz, vnormal[0].z);

	nodes_primitives[primitive_id].normal2_tangent1x = vec4(vnormal[1].xyz,   vtangent[0].x);
	nodes_primitives[primitive_id].normal3_tangent1y = vec4(vnormal[2].xyz,   vtangent[0].y);
	nodes_primitives[primitive_id].tangent2_tangent1z = vec4(vtangent[1].xyz, vtangent[0].z);

	nodes_primitives[primitive_id].tangent3 = vec4(vtangent[2].xyz, 0.0);
	nodes_primitives[primitive_id].texcoord1_texcoord2 = vec4(vTexCoord[0].xy, vTexCoord[1].xy);
	nodes_primitives[primitive_id].texcoord3 = vec4(vTexCoord[2].xy, 0.0, 0.0);

	nodes_primitives[primitive_id].e_1.xyz = prim_vertex_wcs[1].xyz - prim_vertex_wcs[0].xyz;
	nodes_primitives[primitive_id].e_2.xyz = prim_vertex_wcs[2].xyz - prim_vertex_wcs[0].xyz;
	nodes_primitives[primitive_id].fn.xyz  = -normalize(cross(nodes_primitives[primitive_id].e_1.xyz, nodes_primitives[primitive_id].e_2.xyz));

	// emit primitives to each view
	for (int i = 0; i < NUM_CUBEMAPS; ++i)
	{
		// change the viewport (could be different for each view)
		gl_ViewportIndex = i;
		// set the view index
		uniform_cube_index = i;
		gl_Layer = i;
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
